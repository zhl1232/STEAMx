import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isAliyunConfigured, checkSmsVerifyCode } from '@/lib/sms/aliyun'

const PHONE_EMAIL_PREFIX = 'p_'
const PHONE_EMAIL_SUFFIX = '@phone.local'

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${PHONE_EMAIL_PREFIX}${digits}${PHONE_EMAIL_SUFFIX}`
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('86') && digits.length >= 11) return `+${digits}`
  if (digits.length >= 11) return `+86${digits}`
  return ''
}

export async function POST(req: Request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: '服务端未配置 SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      )
    }
    const body = await req.json()
    const { phone: rawPhone, code, password, type = 'login' } = body as {
      phone?: string
      code?: string
      password?: string
      type?: 'login' | 'phone_change'
    }
    const phone = toE164(rawPhone || '')
    const token = String(code || '').trim()
    if (!phone || !token) {
      return NextResponse.json(
        { error: '请输入手机号和验证码' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    let otpValid = false

    if (type === 'phone_change') {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: '绑定手机号需要登录' },
          { status: 401 }
        )
      }
      if (user.phone) {
        return NextResponse.json(
          { error: '手机号已绑定，暂不支持换绑' },
          { status: 409 }
        )
      }

      const { data: existingForUser } = await supabaseAdmin
        .from('phone_to_user')
        .select('phone')
        .eq('user_id', user.id)
        .limit(1)

      if (existingForUser && existingForUser.length > 0) {
        const existingPhone = existingForUser[0]?.phone
        if (existingPhone && existingPhone !== phone) {
          return NextResponse.json(
            { error: '手机号已绑定，暂不支持换绑' },
            { status: 409 }
          )
        }
      }

      const { data: existingForPhone } = await supabaseAdmin
        .from('phone_to_user')
        .select('user_id')
        .eq('phone', phone)
        .limit(1)

      if (existingForPhone && existingForPhone.length > 0 && existingForPhone[0]?.user_id !== user.id) {
        return NextResponse.json(
          { error: '该手机号已被绑定' },
          { status: 409 }
        )
      }

      if (isAliyunConfigured()) {
        const aliyunResult = await checkSmsVerifyCode(phone, token)
        if (aliyunResult.ok) otpValid = true
      }
      if (!otpValid) {
        const { data: rows, error: fetchError } = await supabaseAdmin
          .from('phone_otps')
          .select('id, type')
          .eq('phone', phone)
          .eq('code', token)
          .eq('type', 'phone_change')
          .eq('user_id', user.id)
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .limit(1)

        if (fetchError || !rows?.length) {
          return NextResponse.json(
            { error: '验证码错误或已过期，请重新获取' },
            { status: 400 }
          )
        }
        await supabaseAdmin
          .from('phone_otps')
          .delete()
          .eq('phone', phone)
          .eq('code', token)
          .eq('type', 'phone_change')
          .eq('user_id', user.id)
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        phone,
        phone_confirm: true,
      })
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || '绑定失败，请稍后重试' },
          { status: 400 }
        )
      }

      const { error: mapError } = await supabaseAdmin
        .from('phone_to_user')
        .upsert({ phone, user_id: user.id }, { onConflict: 'phone' })
      if (mapError) {
        return NextResponse.json(
          { error: mapError.message || '绑定失败，请稍后重试' },
          { status: 400 }
        )
      }

      return NextResponse.json({ ok: true })
    }

    if (isAliyunConfigured()) {
      const aliyunResult = await checkSmsVerifyCode(phone, token)
      if (aliyunResult.ok) otpValid = true
    }
    if (!otpValid) {
      const { data: rows, error: fetchError } = await supabaseAdmin
        .from('phone_otps')
        .select('id, type')
        .eq('phone', phone)
        .eq('code', token)
        .eq('type', 'login')
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError || !rows?.length) {
        return NextResponse.json(
          { error: '验证码错误或已过期，请重新获取' },
          { status: 400 }
        )
      }
      await supabaseAdmin
        .from('phone_otps')
        .delete()
        .eq('phone', phone)
        .eq('code', token)
    }

    let userId: string
    let loginEmail = phoneToEmail(phone)
    let userMetadata: Record<string, unknown> | null = null

    const { data: mapping } = await supabaseAdmin
      .from('phone_to_user')
      .select('user_id')
      .eq('phone', phone)
      .single()

    if (mapping?.user_id) {
      userId = mapping.user_id
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authData?.user?.email) loginEmail = authData.user.email
      if (authData?.user && !authData.user.phone) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          phone,
          phone_confirm: true,
        })
      }
      userMetadata = (authData?.user?.user_metadata as Record<string, unknown> | null) || null
    } else {
      const username = `user_${Math.random().toString(36).slice(2, 10)}`
      const displayName = phone.replace(/^\+86/, '') || '用户'
      const userPassword = password && password.length >= 6 ? password : undefined
      if (!userPassword) {
        const randomPass = Math.random().toString(36).slice(2) + 'A1!'
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: loginEmail,
          password: randomPass,
          email_confirm: true,
          phone,
          phone_confirm: true,
          user_metadata: {
            username,
            full_name: displayName,
            phone,
          },
        })
        if (createError) {
          return NextResponse.json(
            { error: createError.message || '创建账号失败' },
            { status: 400 }
          )
        }
        userId = newUser.user.id
        loginEmail = newUser.user.email ?? loginEmail
        userMetadata = (newUser.user.user_metadata as Record<string, unknown> | null) || null
      } else {
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: loginEmail,
          password: userPassword,
          email_confirm: true,
          phone,
          phone_confirm: true,
          user_metadata: {
            username: `user_${Math.random().toString(36).slice(2, 10)}`,
            full_name: displayName,
            phone,
          },
        })
        if (createError) {
          return NextResponse.json(
            { error: createError.message || '创建账号失败' },
            { status: 400 }
          )
        }
        userId = newUser.user.id
        loginEmail = newUser.user.email ?? loginEmail
        userMetadata = (newUser.user.user_metadata as Record<string, unknown> | null) || null
      }
      await supabaseAdmin.from('phone_to_user').upsert(
        { phone, user_id: userId },
        { onConflict: 'phone' }
      )
    }

    if (!userMetadata) {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId)
      userMetadata = (authData?.user?.user_metadata as Record<string, unknown> | null) || null
      if (authData?.user?.email) loginEmail = authData.user.email
      if (authData?.user && !authData.user.phone) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          phone,
          phone_confirm: true,
        })
      }
    }

    const username = (userMetadata?.username as string | undefined) || `user_${Math.random().toString(36).slice(2, 10)}`
    const displayName = (userMetadata?.full_name as string | undefined) || phone.replace(/^\+86/, '') || '用户'
    const avatarUrl = (userMetadata?.avatar_url as string | undefined) || '/avatars/default-1.svg'
    await supabaseAdmin
      .from('profiles')
      .upsert(
        { id: userId, username, display_name: displayName, avatar_url: avatarUrl },
        { onConflict: 'id', ignoreDuplicates: true }
      )

    await supabaseAdmin.from('phone_to_user').upsert(
      { phone, user_id: userId },
      { onConflict: 'phone' }
    )

    const origin =
      req.headers.get('origin') ||
      req.headers.get('referer')?.replace(/\/[^/]*$/, '') ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof process.env.VERCEL_URL === 'string' ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const redirectTo = origin.replace(/\/$/, '') + '/'

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
      options: { redirectTo },
    })
    const props =
      linkData?.properties ??
      (linkData as unknown as { properties?: { action_link?: string; hashed_token?: string } } | undefined)
        ?.properties ??
      (linkData as unknown as { action_link?: string; hashed_token?: string } | undefined)
    let actionLink = props?.action_link
    const tokenHash = props?.hashed_token
    if (linkError || (!actionLink && !tokenHash)) {
      return NextResponse.json(
        { error: '生成登录链接失败，请重试' },
        { status: 500 }
      )
    }

    try {
      if (actionLink) {
        const url = new URL(actionLink)
        url.searchParams.set('redirect_to', redirectTo)
        actionLink = url.toString()
      }
    } catch {
      // 若拼链失败则用原链接
    }

    return NextResponse.json({ tokenHash, redirectTo, redirectUrl: actionLink })
  } catch (e) {
    console.error('[auth/sms/verify]', e)
    return NextResponse.json(
      { error: '验证失败，请稍后重试' },
      { status: 500 }
    )
  }
}
