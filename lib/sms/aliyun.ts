/**
 * 阿里云号码认证服务（Dypnsapi）发送与校验短信验证码
 * 环境变量仅需：SMS_ALIYUN_ACCESS_KEY_ID, SMS_ALIYUN_ACCESS_KEY_SECRET
 * 签名与模板已写死，如需修改请改下方常量
 *
 * 注意：Dypnsapi 依赖 @alicloud/openapi-core，Config 需用 plain object（accessKeyId/accessKeySecret/endpoint）
 */

import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525'
import * as $Util from '@alicloud/tea-util'

/** 短信签名（阿里云控制台配置） */
const ALIYUN_SIGN_NAME = '速通互联验证码'
/** 短信模板 code（阿里云控制台配置，模板需含变量 code、min） */
const ALIYUN_TEMPLATE_CODE = '100001'

export type AliyunSendResult = { ok: true } | { ok: false; error: string }
export type AliyunCheckResult = { ok: true } | { ok: false; error: string }

function getEnv() {
  const accessKeyId = process.env.SMS_ALIYUN_ACCESS_KEY_ID
  const accessKeySecret = process.env.SMS_ALIYUN_ACCESS_KEY_SECRET
  if (!accessKeyId || !accessKeySecret) return null
  return { accessKeyId, accessKeySecret }
}

/** 创建 Dypnsapi 客户端（openapi-core 接受 plain object） */
function createClient(): Dypnsapi20170525 {
  const cfg = getEnv()
  if (!cfg) throw new Error('SMS_ALIYUN_* env not set')
  const config = {
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    endpoint: 'dypnsapi.aliyuncs.com',
  }
  return new Dypnsapi20170525(config as never)
}

/** 发送短信验证码（templateParam 传我们自己的 code，模板里用 ${code} 占位） */
export async function sendSmsVerifyCode(phone: string, code: string): Promise<AliyunSendResult> {
  const cfg = getEnv()
  if (!cfg) return { ok: false, error: 'SMS_ALIYUN_* env not set' }
  const phoneNumber = phone.replace(/\D/g, '').replace(/^86/, '')
  if (phoneNumber.length < 11) return { ok: false, error: 'Invalid phone number' }
  try {
    const client = createClient()
    const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
      phoneNumber,
      countryCode: '86',
      signName: ALIYUN_SIGN_NAME,
      templateCode: ALIYUN_TEMPLATE_CODE,
      templateParam: JSON.stringify({ code, min: '5' }),
      codeLength: 6,
    })
    const runtime = new $Util.RuntimeOptions({})
    await client.sendSmsVerifyCodeWithOptions(request, runtime)
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/** 是否已配置阿里云（用于 verify 时决定是否走阿里云校验） */
export function isAliyunConfigured(): boolean {
  return getEnv() !== null
}

/** 校验短信验证码（阿里云侧校验，仅当使用 ##code## 由阿里云生成验证码时需要用此接口） */
export async function checkSmsVerifyCode(phone: string, verifyCode: string): Promise<AliyunCheckResult> {
  const cfg = getEnv()
  if (!cfg) return { ok: false, error: 'SMS_ALIYUN_* env not set' }
  const phoneNumber = phone.replace(/\D/g, '').replace(/^86/, '')
  if (phoneNumber.length < 11 || !verifyCode.trim()) return { ok: false, error: 'Invalid phone or code' }
  try {
    const client = createClient()
    const request = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
      phoneNumber,
      countryCode: '86',
      verifyCode: verifyCode.trim(),
    })
    const runtime = new $Util.RuntimeOptions({})
    const resp = await client.checkSmsVerifyCodeWithOptions(request, runtime)
    const body = (resp as { body?: { code?: string; message?: string; success?: boolean; model?: { verifyResult?: string } } })?.body
    const ok = body?.code === 'OK' && (body?.model?.verifyResult === 'PASS' || body?.success === true)
    if (ok) return { ok: true }
    return { ok: false, error: body?.message || '验证失败' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
