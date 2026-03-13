import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-messages-send', limit: 20, windowMs: 60_000 })
    const body = await request.json()

    const receiverId = typeof body?.receiverId === 'string' ? body.receiverId : ''
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!receiverId || receiverId === user.id) {
      return NextResponse.json({ error: 'Invalid receiver' }, { status: 400 })
    }
    if (!content) {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '消息不能超过 2000 字' }, { status: 400 })
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
