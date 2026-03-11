import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendVerificationSms } from '@/lib/sms/send'
import { createClient } from '@/lib/supabase/server'

const OTP_EXPIRY_MINUTES = 10
const OTP_LENGTH = 6
const COOLDOWN_SECONDS = 60

function generateCode(): string {
  const digits = '0123456789'
  let code = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * digits.length)]
  }
  return code
}

/** 规范为 E.164 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('86') && digits.length >= 11) return `+${digits}`
  if (digits.length >= 11) return `+86${digits}`
  return ''
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('请求体必须是 JSON', 400)
  }
  if (!body || typeof body !== 'object') {
    return jsonError('请求体无效', 400)
  }
  if (!supabaseAdmin) {
    return jsonError(
      '服务端未配置 SUPABASE_SERVICE_ROLE_KEY，请在 .env.local 中配置后重启',
      500
    )
  }
  try {
    const { phone: rawPhone, type = 'login' } = body as {
      phone?: string
      type?: 'login' | 'phone_change'
    }
    const phone = toE164(String(rawPhone ?? ''))
    if (!phone || phone.length < 12) {
      return jsonError('请输入有效的手机号', 400)
    }
    let userId: string | null = null
    if (type === 'phone_change') {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        return jsonError('绑定手机号需要登录', 401)
      }
      userId = user.id
      if (user.phone) {
        return jsonError('手机号已绑定，暂不支持换绑', 409)
      }

      const { data: existingForUser } = await supabaseAdmin
        .from('phone_to_user')
        .select('phone')
        .eq('user_id', userId)
        .limit(1)

      if (existingForUser && existingForUser.length > 0) {
        const existingPhone = existingForUser[0]?.phone
        if (existingPhone && existingPhone !== phone) {
          return jsonError('手机号已绑定，暂不支持换绑', 409)
        }
      }

      const { data: existingForPhone } = await supabaseAdmin
        .from('phone_to_user')
        .select('user_id')
        .eq('phone', phone)
        .limit(1)

      if (existingForPhone && existingForPhone.length > 0 && existingForPhone[0]?.user_id !== userId) {
        return jsonError('该手机号已被绑定', 409)
      }
    }

    const now = new Date()
    const cooldownStart = new Date(now.getTime() - COOLDOWN_SECONDS * 1000)

    const { data: recent } = await supabaseAdmin
      .from('phone_otps')
      .select('id')
      .eq('phone', phone)
      .gte('created_at', cooldownStart.toISOString())
      .limit(1)

    if (recent && recent.length > 0) {
      return jsonError(`请 ${COOLDOWN_SECONDS} 秒后再请求验证码`, 429)
    }

    const code = generateCode()
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000)

    const { error: insertError } = await supabaseAdmin.from('phone_otps').insert({
      phone,
      code,
      type,
      user_id: type === 'phone_change' ? userId : null,
      expires_at: expiresAt.toISOString(),
    })
    if (insertError) {
      console.error('[auth/sms/send] insert phone_otps:', insertError)
      const msg =
        process.env.NODE_ENV === 'development'
          ? `存储验证码失败: ${insertError.message}（若提示 relation "phone_otps" 不存在，请执行 supabase db push 或应用迁移）`
          : '发送失败，请稍后重试'
      return jsonError(msg, 500)
    }

    const result = await sendVerificationSms(phone, code)
    if (!result.ok) {
      return jsonError(result.error || '发送验证码失败', 502)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/sms/send]', e)
    const message = e instanceof Error ? e.message : String(e)
    return jsonError(message || '发送失败，请稍后重试', 500)
  }
}
