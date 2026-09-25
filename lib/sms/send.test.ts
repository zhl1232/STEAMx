import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendAliyun = vi.hoisted(() => vi.fn())
vi.mock('@/lib/sms/aliyun', () => ({ sendSmsVerifyCode: sendAliyun }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))

import { sendVerificationSms } from './send'

describe('sendVerificationSms configuration', () => {
  beforeEach(() => {
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_ID', '')
    vi.stubEnv('SMS_ALIYUN_ACCESS_KEY_SECRET', '')
    vi.stubEnv('SMS_PROVIDER', '')
    vi.stubEnv('SMS_CUSTOM_URL', '')
    sendAliyun.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('fails closed in production when no provider is configured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(sendVerificationSms('+8613800138000', '123456')).resolves.toEqual({
      ok: false,
      error: 'SMS provider is not configured',
    })
  })

  it('allows development log mode without calling a provider', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    await expect(sendVerificationSms('+8613800138000', '123456')).resolves.toEqual({ ok: true })
    expect(sendAliyun).not.toHaveBeenCalled()
  })
})
