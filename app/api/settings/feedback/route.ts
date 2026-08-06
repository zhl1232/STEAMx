import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'
import { moderateTextContent } from '@/lib/safety/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_FEEDBACK_LENGTH = 1800

async function findSupportUser(userId: string) {
  if (!supabaseAdmin) return null

  const configuredId = process.env.SUPPORT_USER_ID?.trim()
  let query = supabaseAdmin
    .from('profiles')
    .select('id, display_name, username')
    .eq('role', 'admin')
    .neq('id', userId)

  if (configuredId) {
    query = query.eq('id', configuredId)
  } else {
    query = query.order('created_at', { ascending: true })
  }

  const { data, error } = await query.limit(1).maybeSingle()
  if (error) throw error
  return data as { id: string; display_name: string | null; username: string | null } | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, {
      key: 'api-settings-feedback',
      limit: 5,
      windowMs: 60 * 60_000,
    })

    if (!supabaseAdmin) {
      return NextResponse.json({ error: '反馈服务暂时不可用，请稍后重试' }, { status: 503 })
    }

    const body = await request.json().catch(() => null)
    if (typeof body?.content !== 'string' || !body.content.trim()) {
      return NextResponse.json({ error: '请写下你想反馈的问题或建议' }, { status: 400 })
    }

    const content = body.content.trim()
    if (content.length > MAX_FEEDBACK_LENGTH) {
      return NextResponse.json({ error: `反馈内容不能超过 ${MAX_FEEDBACK_LENGTH} 字` }, { status: 400 })
    }

    validateContentSafe(content, '反馈内容')
    const moderation = moderateTextContent(content, 'public')
    if (moderation.state === 'rejected') {
      return NextResponse.json({ error: moderation.reason || '反馈内容不适合提交' }, { status: 422 })
    }

    const supportUser = await findSupportUser(user.id)
    if (!supportUser) {
      return NextResponse.json({ error: '平台客服账号暂未配置，请稍后重试' }, { status: 503 })
    }

    const { error } = await supabaseAdmin.from('messages').insert({
      sender_id: user.id,
      receiver_id: supportUser.id,
      content: `【问题反馈】\n${content}`,
      moderation_state: 'approved',
    } as never)

    if (error) throw error

    return NextResponse.json({
      success: true,
      recipientName: supportUser.display_name || supportUser.username || '平台管理员',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
