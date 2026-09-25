import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  sendSms: vi.fn(),
  request: undefined as Record<string, unknown> | undefined,
  runtime: undefined as Record<string, unknown> | undefined,
}))

vi.mock('@alicloud/dysmsapi20170525', () => ({
  default: class Client {
    constructor(_config: unknown) {}
    sendSmsWithOptions(request: Record<string, unknown>, runtime: Record<string, unknown>) {
      sdk.request = request
      sdk.runtime = runtime
      return sdk.sendSms()
    }
  },
  SendSmsRequest: class Request {
    constructor(values: Record<string, unknown>) {
      Object.assign(this, values)
    }
  },
}))

import { sendSmsVerifyCode } from './aliyun'

describe('Aliyun SMS transport', () => {
  beforeEach(() => {
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', '')
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_SECRET', '')
    sdk.sendSms.mockReset()
    sdk.request = undefined
    sdk.runtime = undefined
  })

  afterEach(() => vi.unstubAllEnvs())

  it('fails closed when credentials are missing', async () => {
    await expect(sendSmsVerifyCode('+8613800138000', '123456')).resolves.toEqual({
      ok: false,
      error: 'SMS provider is not configured',
    })
    expect(sdk.sendSms).not.toHaveBeenCalled()
  })

  it('sends the approved template and accepts only business OK', async () => {
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', 'id')
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_SECRET', 'secret')
    sdk.sendSms.mockResolvedValueOnce({ body: { code: 'OK' } })

    await expect(sendSmsVerifyCode('+8613800138000', '123456')).resolves.toEqual({ ok: true })
    expect(sdk.request).toMatchObject({
      phoneNumbers: '13800138000',
      signName: '北京创探科技',
      templateCode: 'SMS_332130837',
      templateParam: JSON.stringify({ code: '123456' }),
    })
    expect(sdk.runtime).toMatchObject({ autoretry: false, maxAttempts: 1 })

    sdk.sendSms.mockResolvedValueOnce({ body: { code: 'isv.BUSINESS_LIMIT_CONTROL' } })
    await expect(sendSmsVerifyCode('+8613800138000', '123456')).resolves.toEqual({
      ok: false,
      error: 'SMS provider rejected the request (isv.BUSINESS_LIMIT_CONTROL)',
    })
  })

  it('does not expose SDK exceptions', async () => {
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', 'id')
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_SECRET', 'secret')
    sdk.sendSms.mockRejectedValueOnce(new Error('secret credential and OTP 123456'))

    await expect(sendSmsVerifyCode('+8613800138000', '123456')).resolves.toEqual({
      ok: false,
      error: 'SMS provider request failed',
    })
  })
})
