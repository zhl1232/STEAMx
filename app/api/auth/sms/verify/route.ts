import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/api/auth'
import { requireRequestRateLimit } from '@/lib/api/auth-rate-limit'
import {
  createDefaultDisplayName,
  isPhoneBasedDisplayName,
} from '@/lib/auth/default-display-name'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import { PLATFORM_ONBOARDING_HREF } from '@/lib/product/onboarding'
import { isSupabasePhoneProvider } from '@/lib/auth/phone-provider'

const PHONE_EMAIL_PREFIX = 'p_'
const PHONE_EMAIL_SUFFIX = '@phone.local'

function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `${PHONE_EMAIL_PREFIX}${digits}${PHONE_EMAIL_SUFFIX}`
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('86') && digits.length >= 13) return `+${digits}`
  if (digits.length === 11) return `+86${digits}`
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

    requireRequestRateLimit(req, {
      key: `auth-sms-verify:${type}`,
      limit: 10,
      windowMs: 10 * 60_000,
      suffix: phone,
    })

    if (isSupabasePhoneProvider()) {
      const verificationClient = createPublicClient()

      if (type === 'phone_change') {
        const supabase = await createClient()
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()
        if (!currentUser) {
          return NextResponse.json({ error: '绑定手机号需要登录' }, { status: 401 })
        }
        if (currentUser.phone_confirmed_at) {
          return NextResponse.json({ error: '手机号已绑定，暂不支持换绑' }, { status: 409 })
        }

        const { data: existingForUser, error: userMappingError } = await supabaseAdmin
          .from('phone_to_user')
          .select('phone')
          .eq('user_id', currentUser.id)
          .limit(1)
        if (userMappingError) {
          return NextResponse.json({ error: '手机号绑定状态读取失败，请稍后重试' }, { status: 500 })
        }
        if (existingForUser?.some((row) => row.phone && row.phone !== phone)) {
          return NextResponse.json({ error: '手机号已绑定，暂不支持换绑' }, { status: 409 })
        }
        const { data: existingForPhone, error: phoneMappingError } = await supabaseAdmin
          .from('phone_to_user')
          .select('user_id')
          .eq('phone', phone)
          .limit(1)
        if (phoneMappingError) {
          return NextResponse.json({ error: '手机号绑定状态读取失败，请稍后重试' }, { status: 500 })
        }
        if (existingForPhone?.some((row) => row.user_id !== currentUser.id)) {
          return NextResponse.json({ error: '该手机号已被绑定' }, { status: 409 })
        }

        const { data, error } = await verificationClient.auth.verifyOtp({
          phone,
          token,
          type: 'phone_change',
        })
        if (error || !data.user) {
          return NextResponse.json(
            { error: error?.message || '验证码错误或已过期，请重新获取' },
            { status: 400 },
          )
        }
        if (data.user.id !== currentUser.id) {
          return NextResponse.json({ error: '手机号绑定身份校验失败' }, { status: 409 })
        }
        if (toE164(data.user.phone || '') !== phone || !data.user.phone_confirmed_at) {
          return NextResponse.json({ error: '手机号验证未完成，请重新获取验证码' }, { status: 400 })
        }

        const { error: mapError } = await supabaseAdmin
          .from('phone_to_user')
          .upsert({ phone, user_id: currentUser.id }, { onConflict: 'phone', ignoreDuplicates: true })
        if (mapError) {
          return NextResponse.json({ error: mapError.message || '绑定失败，请稍后重试' }, { status: 400 })
        }
        const { data: finalMapping, error: finalMappingError } = await supabaseAdmin
          .from('phone_to_user')
          .select('user_id')
          .eq('phone', phone)
          .limit(1)
        if (finalMappingError || finalMapping?.[0]?.user_id !== currentUser.id) {
          return NextResponse.json({ error: '手机号已被绑定，请稍后重试' }, { status: 409 })
        }
        return NextResponse.json({ ok: true })
      }

      const { data, error } = await verificationClient.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      })
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || '验证码错误或已过期，请重新获取' },
          { status: 400 },
        )
      }
      if (!data.session) {
        return NextResponse.json({ error: '登录会话建立失败，请稍后重试' }, { status: 500 })
      }

      const { data: mapping, error: mappingError } = await supabaseAdmin
        .from('phone_to_user')
        .select('user_id')
        .eq('phone', phone)
        .limit(1)
      if (mappingError) {
        return NextResponse.json({ error: '登录账号映射读取失败，请稍后重试' }, { status: 500 })
      }
      if (mapping?.[0] && mapping[0].user_id !== data.user.id) {
        return NextResponse.json({ error: '手机号已绑定其他账号，请联系管理员处理' }, { status: 409 })
      }
      const isNewUser = !mapping?.[0]

      const { error: mapError } = await supabaseAdmin
        .from('phone_to_user')
        .upsert({ phone, user_id: data.user.id }, { onConflict: 'phone', ignoreDuplicates: true })
      if (mapError) {
        return NextResponse.json({ error: mapError.message || '登录账号映射保存失败，请稍后重试' }, { status: 500 })
      }

      const { data: finalMapping, error: finalMappingError } = await supabaseAdmin
        .from('phone_to_user')
        .select('user_id')
        .eq('phone', phone)
        .limit(1)
      if (finalMappingError || finalMapping?.[0]?.user_id !== data.user.id) {
        return NextResponse.json({ error: '手机号已绑定其他账号，请联系管理员处理' }, { status: 409 })
      }

      const sessionClient = await createClient()
      const { error: sessionError } = await sessionClient.auth.setSession(data.session)
      if (sessionError) {
        return NextResponse.json({ error: sessionError.message || '登录会话建立失败，请稍后重试' }, { status: 500 })
      }
      return NextResponse.json(
        {
          ok: true,
          isNewUser,
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const now = new Date().toISOString()

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

      const { data: consumed, error: consumeError } = await supabaseAdmin
        .from('phone_otps')
        .delete()
        .eq('phone', phone)
        .eq('code', token)
        .eq('type', 'phone_change')
        .eq('user_id', user.id)
        .gt('expires_at', now)
        .select('id')

      if (consumeError || !consumed?.length) {
        if (consumeError) logger.error('[auth/sms/verify] consume phone_change OTP', { error: consumeError })
        return NextResponse.json(
          { error: '验证码错误或已过期，请重新获取' },
          { status: consumeError ? 500 : 400 }
        )
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

    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from('phone_otps')
      .delete()
      .eq('phone', phone)
      .eq('code', token)
      .eq('type', 'login')
      .is('user_id', null)
      .gt('expires_at', now)
      .select('id')

    if (consumeError || !consumed?.length) {
      if (consumeError) logger.error('[auth/sms/verify] consume login OTP', { error: consumeError })
      return NextResponse.json(
        { error: '验证码错误或已过期，请重新获取' },
        { status: consumeError ? 500 : 400 }
      )
    }

    let userId: string
    let loginEmail = phoneToEmail(phone)
    let userMetadata: Record<string, unknown> | null = null
    // 手机号验证码同时承担登录和注册，落地页要靠这个标记区分老用户和刚建号的人
    let isNewUser = false

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
      isNewUser = true
      const username = `user_${Math.random().toString(36).slice(2, 10)}`
      const displayName = createDefaultDisplayName()
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
    const metadataDisplayName = userMetadata?.full_name as string | undefined
    const displayName =
      !metadataDisplayName || isPhoneBasedDisplayName(metadataDisplayName, phone)
        ? createDefaultDisplayName()
        : metadataDisplayName

    if (displayName !== metadataDisplayName) {
      userMetadata = { ...userMetadata, full_name: displayName }
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: userMetadata,
      })

      if (metadataDisplayName) {
        await supabaseAdmin
          .from('profiles')
          .update({ display_name: displayName } as never)
          .eq('id', userId)
          .eq('display_name', metadataDisplayName)
      }
    }

    const avatarUrl = getDefaultAvatarPath(userId)
    await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: userId,
          username,
          display_name: displayName,
          avatar_url: avatarUrl,
        } as never,
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
      'http://localhost:3000'
    // 新注册的人进入平台方向指南，老用户回首页
    const redirectTo = origin.replace(/\/$/, '') + (isNewUser ? PLATFORM_ONBOARDING_HREF : '/')

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

    return NextResponse.json({ tokenHash, redirectTo, redirectUrl: actionLink, isNewUser })
  } catch (e) {
    if (!(e instanceof Error) || e.name !== 'RateLimitError') {
      logger.error('[auth/sms/verify]', { error: e })
    }
    return handleApiError(e)
  }
}
