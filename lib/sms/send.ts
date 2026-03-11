/**
 * 自定义短信发送：对接自有或第三方短信接口，不依赖 Supabase 官方短信（无需 Twilio 等资质）
 *
 * 优先级：阿里云密钥已配置 → 用阿里云；否则 SMS_PROVIDER=custom 且 URL 已配置 → 自定义 HTTP；否则 log 模式（仅打日志）
 * 环境变量：SMS_ALIYUN_ACCESS_KEY_ID + SMS_ALIYUN_ACCESS_KEY_SECRET 即走阿里云（签名/模板在代码内写死）
 */

export type SmsResult = { ok: true } | { ok: false; error: string }

function hasAliyunConfig(): boolean {
  return !!(process.env.SMS_ALIYUN_ACCESS_KEY_ID && process.env.SMS_ALIYUN_ACCESS_KEY_SECRET)
}

/** 发送验证码短信 */
export async function sendVerificationSms(phone: string, code: string): Promise<SmsResult> {
  const normalized = phone.replace(/\D/g, '')
  if (normalized.length < 11) {
    return { ok: false, error: 'Invalid phone number' }
  }

  if (hasAliyunConfig()) return sendAliyun(phone, code)
  if (process.env.SMS_PROVIDER === 'custom' && process.env.SMS_CUSTOM_URL) return sendCustom(phone, code)

  if (process.env.NODE_ENV === 'development') {
    console.warn(`[SMS] log 模式，未真实发送: ${phone} code=${code}`)
  }
  return { ok: true }
}

async function sendAliyun(phone: string, code: string): Promise<SmsResult> {
  const { sendSmsVerifyCode } = await import('@/lib/sms/aliyun')
  return sendSmsVerifyCode(phone, code)
}

async function sendCustom(phone: string, code: string): Promise<SmsResult> {
  const url = process.env.SMS_CUSTOM_URL
  if (!url) return { ok: false, error: 'SMS_CUSTOM_URL not set' }
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const h = process.env.SMS_CUSTOM_HEADERS
    if (h) headers = { ...headers, ...JSON.parse(h) }
  } catch {
    return { ok: false, error: 'SMS_CUSTOM_HEADERS invalid JSON' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, code }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `${res.status}: ${text}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
