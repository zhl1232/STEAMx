import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * 管理员手动创建用户（邮箱 + 密码），不依赖短信或邮箱验证。
 * POST body: { email, password, displayName? }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    await requireRole(supabase, ['admin'])
  } catch (e) {
    return handleApiError(e)
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { email, password, displayName } = body as {
      email?: string
      password?: string
      displayName?: string
    }
    const emailTrim = typeof email === 'string' ? email.trim() : ''
    const passwordTrim = typeof password === 'string' ? password : ''
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      return NextResponse.json({ error: '请输入有效邮箱' }, { status: 400 })
    }
    if (passwordTrim.length < 6) {
      return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
    }

    const username = `user_${Math.random().toString(36).slice(2, 10)}`
    const fullName = (displayName?.trim() || emailTrim.split('@')[0]) as string

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailTrim,
      password: passwordTrim,
      email_confirm: true,
      user_metadata: {
        username,
        full_name: fullName,
      },
    })

    if (error) {
      const msg = error.message || '创建用户失败'
      if (msg.includes('already') || msg.includes('registered')) {
        return NextResponse.json({ error: '该邮箱已被注册' }, { status: 400 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    return NextResponse.json({
      id: data.user?.id,
      email: data.user?.email,
      message: '用户已创建，可使用该邮箱和密码登录。',
    })
  } catch (e) {
    return handleApiError(e)
  }
}
