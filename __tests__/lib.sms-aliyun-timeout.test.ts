import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  send: vi.fn(),
  runtimeOptions: vi.fn(),
  request: vi.fn(),
}))

vi.mock('@alicloud/dypnsapi20170525', () => {
  class Client {
    sendSmsVerifyCodeWithOptions(...args: unknown[]) {
      return sdk.send(...args)
    }
  }
  class SendSmsVerifyCodeRequest {
    constructor(input: unknown) {
      sdk.request(input)
    }
  }
  return { default: Client, SendSmsVerifyCodeRequest }
})
vi.mock('@alicloud/tea-util', () => ({
  RuntimeOptions: class {
    constructor(input: unknown) {
      sdk.runtimeOptions(input)
    }
  },
}))

import { sendSmsVerifyCodeWithTimeout } from '@/lib/sms/aliyun'

describe('sendSmsVerifyCodeWithTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', 'test-id')
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_SECRET', 'test-secret')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('sends with the legacy sign/template and SDK timeouts, and reports OK', async () => {
    sdk.send.mockResolvedValue({ body: { code: 'OK', requestId: 'req-1' } })

    await expect(sendSmsVerifyCodeWithTimeout('13800138000', '561166', { timeoutMs: 3000 })).resolves.toEqual({
      ok: true,
      requestId: 'req-1',
    })
    expect(sdk.request).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '13800138000',
        countryCode: '86',
        signName: '速通互联验证码',
        templateCode: '100001',
        templateParam: JSON.stringify({ code: '561166', min: '5' }),
      }),
    )
    expect(sdk.runtimeOptions).toHaveBeenCalledWith({ connectTimeout: 3000, readTimeout: 3000 })
  })

  it('treats a non-OK business code as failure', async () => {
    sdk.send.mockResolvedValue({ body: { code: 'biz.FREQUENCY', message: 'check frequency failed', requestId: 'req-2' } })

    await expect(sendSmsVerifyCodeWithTimeout('13800138000', '561166', { timeoutMs: 3000 })).resolves.toEqual({
      ok: false,
      code: 'biz.FREQUENCY',
      error: 'check frequency failed',
      requestId: 'req-2',
    })
  })

  it('surfaces SDK error codes', async () => {
    sdk.send.mockRejectedValue(Object.assign(new Error('Forbidden.NoPermission'), { code: 'Forbidden.NoPermission' }))

    await expect(sendSmsVerifyCodeWithTimeout('13800138000', '561166', { timeoutMs: 3000 })).resolves.toMatchObject({
      ok: false,
      code: 'Forbidden.NoPermission',
    })
  })

  it('resolves as timed out at the hard deadline even if the SDK never answers', async () => {
    vi.useFakeTimers()
    sdk.send.mockReturnValue(new Promise(() => undefined))

    const pending = sendSmsVerifyCodeWithTimeout('13800138000', '561166', { timeoutMs: 3000 })
    await vi.advanceTimersByTimeAsync(2999)
    let settled = false
    void pending.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toMatchObject({ ok: false, timedOut: true, code: 'TIMEOUT' })
  })

  it('fails fast without credentials', async () => {
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', '')
    await expect(sendSmsVerifyCodeWithTimeout('13800138000', '561166', { timeoutMs: 3000 })).resolves.toMatchObject({
      ok: false,
      code: 'CONFIG_MISSING',
    })
    expect(sdk.send).not.toHaveBeenCalled()
  })
})
