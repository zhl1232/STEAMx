/** Legacy SMS delivery through Alibaba Cloud SMS API. */
import Dysmsapi20170525, * as $Dysmsapi20170525 from '@alicloud/dysmsapi20170525'
import * as $Util from '@alicloud/tea-util'

const ALIYUN_SIGN_NAME = '北京创探科技'
const ALIYUN_TEMPLATE_CODE = 'SMS_332130837'
const ENDPOINT = 'dysmsapi.aliyuncs.com'
const CONNECT_TIMEOUT_MS = 3_000
const READ_TIMEOUT_MS = 5_000

export type AliyunSendResult = { ok: true } | { ok: false; error: string }

function getEnv() {
  const accessKeyId = process.env.SMS_ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = process.env.SMS_ALIYUN_ACCESS_KEY_SECRET
  if (!accessKeyId || !accessKeySecret) return null
  return { accessKeyId, accessKeySecret }
}

function createClient(): Dysmsapi20170525 {
  const cfg = getEnv()
  if (!cfg) throw new Error('SMS provider is not configured')
  return new Dysmsapi20170525({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    endpoint: ENDPOINT,
  } as never)
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('86') && digits.length === 13 ? digits.slice(2) : digits
}

/** Send exactly one verification message. SDK retry is disabled to avoid duplicate OTPs. */
export async function sendSmsVerifyCode(phone: string, code: string): Promise<AliyunSendResult> {
  if (!getEnv()) return { ok: false, error: 'SMS provider is not configured' }
  const phoneNumber = normalizePhone(phone)
  if (!/^1\d{10}$/.test(phoneNumber) || !/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Invalid phone number or code' }
  }

  try {
    const request = new $Dysmsapi20170525.SendSmsRequest({
      phoneNumbers: phoneNumber,
      signName: ALIYUN_SIGN_NAME,
      templateCode: ALIYUN_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code }),
    })
    const runtime = new $Util.RuntimeOptions({
      autoretry: false,
      maxAttempts: 1,
      connectTimeout: CONNECT_TIMEOUT_MS,
      readTimeout: READ_TIMEOUT_MS,
    })
    const response = await createClient().sendSmsWithOptions(request, runtime)
    const body = (response as { body?: { code?: string } })?.body
    if (body?.code === 'OK') return { ok: true }
    const providerCode = typeof body?.code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(body.code)
      ? body.code
      : 'unknown'
    return { ok: false, error: `SMS provider rejected the request (${providerCode})` }
  } catch {
    return { ok: false, error: 'SMS provider request failed' }
  }
}
