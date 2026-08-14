import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUUID, validateContentSafe } from '@/lib/api/validation'
import {
  checkMessagePrivacyGate,
  checkStrangerMessageGate,
  resolveMessageRelationship,
} from '@/lib/messages/stranger-gate'
import { assertUsersNotBlocked, createModerationCase, getContentSnapshot, moderateTextContent } from '@/lib/safety/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-messages-send', limit: 20, windowMs: 60_000 })
    await requireInteractionAccess(supabase, user, 'message')
    const body = await request.json()

    const receiverId = validateUUID(body?.receiverId, 'receiverId')
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (receiverId === user.id) {
      return NextResponse.json({ error: 'Invalid receiver' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '消息不能超过 2000 字' }, { status: 400 })
    }

    validateContentSafe(content, '消息内容')
    await assertUsersNotBlocked(supabase, user.id, receiverId)

    const { data: receiverProfile, error: profileError } = await supabase
      .from('profiles')
      .select('message_privacy')
      .eq('id', receiverId)
      .single()

    if (profileError || !receiverProfile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 分成「对方回过没有」和「我发了几条」两个查询：条数限制只在对方没回复时才生效，
    // 此时我发出的总条数就是回复前的条数，不需要再去猜会话的前几条长什么样。
    const [replyResponse, sentCountResponse, followsResponse] = await Promise.all([
      supabase
        .from('messages')
        .select('id')
        .eq('sender_id', receiverId)
        .eq('receiver_id', user.id)
        .limit(1),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('receiver_id', receiverId),
      supabase
        .from('follows')
        .select('follower_id, following_id')
        .or(`and(follower_id.eq.${user.id},following_id.eq.${receiverId}),and(follower_id.eq.${receiverId},following_id.eq.${user.id})`),
    ])

    if (replyResponse.error) throw replyResponse.error
    if (sentCountResponse.error) throw sentCountResponse.error
    if (followsResponse.error) throw followsResponse.error

    const follows = followsResponse.data ?? []
    const senderFollowsReceiver = follows.some(
      (row) => row.follower_id === user.id && row.following_id === receiverId,
    )
    const receiverFollowsSender = follows.some(
      (row) => row.follower_id === receiverId && row.following_id === user.id,
    )

    const relationship = resolveMessageRelationship({
      hasReply: (replyResponse.data ?? []).length > 0,
      isMutualFollow: senderFollowsReceiver && receiverFollowsSender,
    })

    const privacy = (receiverProfile as { message_privacy: string }).message_privacy
    const privacyGate = checkMessagePrivacyGate({ privacy, relationship })
    if (!privacyGate.allowed) {
      return NextResponse.json({ error: privacyGate.error }, { status: privacyGate.status })
    }

    const strangerGate = checkStrangerMessageGate({
      relationship,
      sentBeforeReply: sentCountResponse.count ?? 0,
      content,
    })
    if (!strangerGate.allowed) {
      return NextResponse.json({ error: strangerGate.error }, { status: strangerGate.status })
    }

    const moderation = moderateTextContent(content, 'message')
    if (moderation.state === 'rejected') {
      return NextResponse.json({ error: moderation.reason || '消息未通过安全检查', code: 'CONTENT_REJECTED' }, { status: 422 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: '消息审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' }, { status: 503 })
    }

    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
        moderation_state: moderation.state,
      } as never)
      .select('id, sender_id, receiver_id, content, moderation_state, read_at, created_at')
      .single()

    if (error) throw error

    if (moderation.state === 'pending') {
      const snapshot = await getContentSnapshot(supabase, 'message', data.id)
      const caseId = await createModerationCase({
        contentType: 'message',
        contentId: data.id,
        authorId: user.id,
        riskLevel: moderation.riskLevel,
        category: moderation.category,
        reason: moderation.reason,
        modelName: moderation.modelName,
        snapshot: snapshot ?? { authorId: user.id, text: content, metadata: { receiverId } },
      })
      return NextResponse.json({
        message: data,
        moderation: { state: 'pending', caseId },
      }, { status: 202 })
    }

    return NextResponse.json({ message: data, moderation: { state: 'approved' } })
  } catch (error) {
    return handleApiError(error)
  }
}
