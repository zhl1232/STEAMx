/**
 * Supabase Auth「Send SMS Hook」（HTTP hook）服务端逻辑。
 *
 * Supabase Auth 生成 OTP 后按 Standard Webhooks 规范签名并 POST 到我们的接口，
 * 由本应用用既有阿里云号码认证（Dypnsapi SendSmsVerifyCode，签名/模板同 legacy）发送短信。
 * 签名校验是唯一的安全边界：接口不依赖 host、cookie、登录态或重定向。
 * 上线地址：https://steam.bj.cn/api/auth/sms/hook（托管 Supabase 仅支持 https hook）。
 *
 * 协议要点（https://supabase.com/docs/guides/auth/auth-hooks）：
 * - 成功：HTTP 200 + `{}`，Content-Type 必须是 application/json；
 * - 失败：`{ "error": { "http_code": number, "message": string } }`；
 *   只有 429/503 且带 retry-after 才会被 Supabase 重试，这里刻意不返回可重试错误，避免重复发短信；
 * - Supabase Auth HTTP hook 整体超时 5 秒（含重试）；短信调用默认 3 秒超时（上限 3.5 秒），
 *   加上验签/解析，整个处理保证约 4 秒内返回。
 */

import { Webhook } from 'standardwebhooks'

import { logger } from '@/lib/logger'
import { sendSmsVerifyCodeWithTimeout, type AliyunTimedSendResult } from '@/lib/sms/aliyun'
import { maskPhone, toMainlandMobile } from '@/lib/utils/phone'

export const SEND_SMS_HOOK_SECRET_ENV = 'SUPABASE_SEND_SMS_HOOK_SECRET'
export const SEND_SMS_HOOK_TIMEOUT_ENV = 'SUPABASE_SEND_SMS_HOOK_SMS_TIMEOUT_MS'
export const DEFAULT_SEND_SMS_TIMEOUT_MS = 3000
const MIN_SEND_SMS_TIMEOUT_MS = 500
const MAX_SEND_SMS_TIMEOUT_MS = 3500

const LOG_PREFIX = '[auth/sms/hook]'

export type HookResult = {
  status: number
  body: Record<string, unknown>
}

export type SmsSender = (phone: string, otp: string, options: { timeoutMs: number }) => Promise<AliyunTimedSendResult>

function hookError(httpCode: number, message: string): HookResult {
  return { status: httpCode, body: { error: { http_code: httpCode, message } } }
}

/**
 * 解析 Supabase 生成的 hook secret。支持：
 * - `v1,whsec_<base64>`（控制台原样复制）
 * - `whsec_<base64>` 或纯 `<base64>`
 * - 多个 secret 用 `|` 分隔（轮换期间同时生效）
 */
export function parseHookSecrets(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^v1,/, '').replace(/^whsec_/, '').trim())
    .filter(Boolean)
}

export function resolveSmsTimeoutMs(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(parsed)) return DEFAULT_SEND_SMS_TIMEOUT_MS
  return Math.min(MAX_SEND_SMS_TIMEOUT_MS, Math.max(MIN_SEND_SMS_TIMEOUT_MS, parsed))
}

/** 日志中去掉手机号与验证码，避免敏感信息落盘。 */
function sanitize(message: string, otp?: string): string {
  let out = message.replace(/(?:\+?86)?1[3-9]\d{9}/g, (m) => maskPhone(m))
  if (otp) out = out.split(otp).join('******')
  return out.slice(0, 500)
}

function verifySignature(payload: string, headers: Headers, secrets: string[]): unknown {
  const webhookHeaders = {
    'webhook-id': headers.get('webhook-id') ?? '',
    'webhook-timestamp': headers.get('webhook-timestamp') ?? '',
    'webhook-signature': headers.get('webhook-signature') ?? '',
  }
  let lastError: unknown = null
  for (const secret of secrets) {
    try {
      return new Webhook(secret).verify(payload, webhookHeaders)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('No hook secret configured')
}

type ParsedEvent = { phone: string; otp: string; rawPhone: string }

function parseEvent(event: unknown): ParsedEvent | { error: string } {
  if (!event || typeof event !== 'object') return { error: 'payload must be a JSON object' }
  const { user, sms } = event as { user?: { phone?: unknown }; sms?: { otp?: unknown; phone?: unknown } }
  if (!sms || typeof sms !== 'object') return { error: 'missing sms' }
  const otp = typeof sms.otp === 'string' ? sms.otp.trim() : ''
  if (!/^\d{4,10}$/.test(otp)) return { error: 'missing or invalid sms.otp' }
  // 新版 Supabase Auth 在 sms.phone 给出本次目标号码（手机号换绑时 user.phone 仍为旧值/空），优先使用。
  const smsPhone = typeof sms.phone === 'string' ? sms.phone : ''
  const userPhone = user && typeof user === 'object' && typeof user.phone === 'string' ? user.phone : ''
  const rawPhone = smsPhone || userPhone
  if (!rawPhone) return { error: 'missing user.phone' }
  const phone = toMainlandMobile(rawPhone, { requireCountryCode: true })
  if (!phone) return { error: 'unsupported phone number (mainland China mobile only)' }
  return { phone, otp, rawPhone }
}

export async function handleSendSmsHook(
  req: Request,
  deps: { sender?: SmsSender; env?: NodeJS.ProcessEnv } = {},
): Promise<HookResult> {
  const env = deps.env ?? process.env
  const sender = deps.sender ?? sendSmsVerifyCodeWithTimeout
  const startedAt = Date.now()

  const secrets = parseHookSecrets(env[SEND_SMS_HOOK_SECRET_ENV])
  if (!secrets.length) {
    logger.error(`${LOG_PREFIX} ${SEND_SMS_HOOK_SECRET_ENV} is not configured`)
    return hookError(500, 'Send SMS hook is not configured')
  }

  let payload: string
  try {
    payload = await req.text()
  } catch {
    return hookError(400, 'Unable to read request body')
  }

  let event: unknown
  try {
    event = verifySignature(payload, req.headers, secrets)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    logger.warn(`${LOG_PREFIX} rejected: invalid webhook signature (${sanitize(reason)}) webhook-id=${req.headers.get('webhook-id') ?? '-'}`)
    return hookError(401, 'Invalid webhook signature')
  }

  const parsed = parseEvent(event)
  if ('error' in parsed) {
    logger.warn(`${LOG_PREFIX} rejected payload: ${parsed.error}`)
    return hookError(400, `Invalid payload: ${parsed.error}`)
  }

  const timeoutMs = resolveSmsTimeoutMs(env[SEND_SMS_HOOK_TIMEOUT_ENV])
  let result: AliyunTimedSendResult
  try {
    result = await sender(parsed.phone, parsed.otp, { timeoutMs })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    result = { ok: false, error: msg }
  }
  const elapsedMs = Date.now() - startedAt

  if (!result.ok) {
    const status = result.timedOut ? 504 : 502
    logger.error(
      `${LOG_PREFIX} aliyun send failed provider=aliyun-dypnsapi phone=${maskPhone(parsed.phone)} status=${status} code=${result.code ?? '-'} timedOut=${result.timedOut ? 'yes' : 'no'} elapsedMs=${elapsedMs} requestId=${result.requestId ?? '-'} message=${sanitize(result.error, parsed.otp)}`,
    )
    return hookError(status, result.timedOut ? 'SMS provider timed out' : 'SMS provider failed to send the message')
  }

  // logger.info 仅在开发环境输出；成功行也需要进生产容器日志，便于核对 Supabase 调用。
  console.info(`${LOG_PREFIX} sent provider=aliyun-dypnsapi phone=${maskPhone(parsed.phone)} elapsedMs=${elapsedMs} requestId=${result.requestId ?? '-'}`)
  return { status: 200, body: {} }
}
