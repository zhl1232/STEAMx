import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return jsonError('服务端未配置 SUPABASE_SERVICE_ROLE_KEY', 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('请求体必须是 JSON', 400)
  }
  if (!body || typeof body !== 'object') {
    return jsonError('请求体无效', 400)
  }

  const { newPassword } = body as { newPassword?: string }
  if (!newPassword || newPassword.length < 6) {
    return jsonError('新密码至少 6 位', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return jsonError('未登录', 401)
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })
  if (error) {
    return jsonError(error.message || '修改失败，请稍后重试', 400)
  }

  return NextResponse.json({ ok: true })
}
