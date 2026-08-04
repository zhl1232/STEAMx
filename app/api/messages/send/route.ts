import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUUID, validateContentSafe } from '@/lib/api/validation'
import { assertUsersNotBlocked, createModerationCase, moderateTextContent } from '@/lib/safety/server'
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

    const { data: priorMessages, error: priorMessagesError } = await supabase
      .from('messages')
      .select('sender_id, receiver_id')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(20)
    if (priorMessagesError) throw priorMessagesError

    const hasReply = (priorMessages ?? []).some((message) => message.sender_id === receiverId)
    const sentBeforeReply = (priorMessages ?? []).filter((message) => message.sender_id === user.id).length
    if (!hasReply && sentBeforeReply >= 3) {
      return NextResponse.json({ error: '对方回复前最多发送 3 条消息，请等待对方回复' }, { status: 429 })
    }
    if (!hasReply && (/(?:https?:\/\/|www\.)\S+/iu.test(content) || /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u.test(content) || /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/u.test(content))) {
      return NextResponse.json({ error: '新会话首条消息不能包含外链或联系方式' }, { status: 400 })
    }

    const moderation = moderateTextContent(content, 'message')
    if (moderation.state === 'rejected') {
      return NextResponse.json({ error: moderation.reason || '消息未通过安全检查', code: 'CONTENT_REJECTED' }, { status: 422 })
    }
    if (!supabaseAdmin) {
      return NextResponse.json({ error: '消息审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' }, { status: 503 })
    }

    const privacy = (receiverProfile as { message_privacy: string }).message_privacy

    if (privacy === 'nobody') {
      return NextResponse.json({ error: '对方已关闭私信功能' }, { status: 403 })
    }

    if (privacy === 'followers_only') {
      const { data: follow } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', receiverId)
        .maybeSingle()

      if (!follow) {
        return NextResponse.json({ error: '对方仅允许关注者私信' }, { status: 403 })
      }
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
      const caseId = await createModerationCase({
        contentType: 'message',
        contentId: data.id,
        authorId: user.id,
        riskLevel: moderation.riskLevel,
        category: moderation.category,
        reason: moderation.reason,
        modelName: moderation.modelName,
        snapshot: { authorId: user.id, text: content, metadata: { receiverId } },
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
