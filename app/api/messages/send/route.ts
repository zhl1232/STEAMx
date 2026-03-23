import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateUUID, validateContentSafe } from '@/lib/api/validation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-messages-send', limit: 20, windowMs: 60_000 })
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

    const { data: receiverProfile, error: profileError } = await supabase
      .from('profiles')
      .select('message_privacy')
      .eq('id', receiverId)
      .single()

    if (profileError || !receiverProfile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
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

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: user.id,
        receiver_id: receiverId,
        content,
      } as never)
      .select('id, sender_id, receiver_id, content, created_at')
      .single()

    if (error) throw error

    return NextResponse.json({ message: data })
  } catch (error) {
    return handleApiError(error)
  }
}
