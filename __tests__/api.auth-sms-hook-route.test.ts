import { Webhook } from 'standardwebhooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/sms/aliyun', () => ({ sendSmsVerifyCodeWithTimeout: mocks.send }))
vi.mock('@/lib/logger', () => ({ logger: mocks.logger }))

import { POST } from '@/app/api/auth/sms/hook/route'
import {
  DEFAULT_SEND_SMS_TIMEOUT_MS,
  parseHookSecrets,
  resolveSmsTimeoutMs,
} from '@/lib/auth/send-sms-hook'

// Fixed test-only secret (random bytes, base64). Not used anywhere else.
const RAW_SECRET = 'dGVzdC1vbmx5LXNlbmQtc21zLWhvb2stc2VjcmV0LTEyMzQ='
const HOOK_SECRET = `v1,whsec_${RAW_SECRET}`
const OTHER_SECRET = 'v1,whsec_b3RoZXItdGVzdC1zZWNyZXQtbm90LWNvbmZpZ3VyZWQ='

type SamplePayload = { user: { id: string; phone: string }; sms: { otp: string; phone?: string } }

function samplePayload(overrides: Partial<SamplePayload> = {}): SamplePayload {
  return {
    user: { id: '6481a5c1-3d37-4a56-9f6a-bee08c554965', phone: '8613800138000' },
    sms: { otp: '561166' },
    ...overrides,
  }
}

function signedRequest(body: unknown, secret = HOOK_SECRET, timestamp = new Date()): Request {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  const msgId = 'msg_test_1'
  const signature = new Webhook(secret.replace('v1,whsec_', '')).sign(msgId, timestamp, payload)
  return new Request('https://steam.bj.cn/api/auth/sms/hook', {
    method: 'POST',
    body: payload,
    headers: {
      'content-type': 'application/json',
      'webhook-id': msgId,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': signature,
    },
  })
}

function loggedText(): string {
  return [...mocks.logger.error.mock.calls, ...mocks.logger.warn.mock.calls, ...mocks.logger.info.mock.calls]
    .map((call) => call.map((part: unknown) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '))
    .join('\n')
}

describe('Supabase Send SMS hook route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SUPABASE_SEND_SMS_HOOK_SECRET', HOOK_SECRET)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    mocks.send.mockResolvedValue({ ok: true, requestId: 'req-1' })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('verifies the signature, sends the OTP to the normalized mainland number and returns 200 {}', async () => {
    const response = await POST(signedRequest(samplePayload()))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    await expect(response.json()).resolves.toEqual({})
    expect(mocks.send).toHaveBeenCalledWith('13800138000', '561166', { timeoutMs: DEFAULT_SEND_SMS_TIMEOUT_MS })
  })

  it('accepts +86 formatted phones and prefers sms.phone (phone change target)', async () => {
    const response = await POST(
      signedRequest(samplePayload({ user: { id: 'u', phone: '' }, sms: { otp: '123456', phone: '+86 139-0013-9000' } })),
    )

    expect(response.status).toBe(200)
    expect(mocks.send).toHaveBeenCalledWith('13900139000', '123456', expect.any(Object))
  })

  it('works regardless of Host (internal address) since the signature is the only boundary', async () => {
    const signed = signedRequest(samplePayload())
    const internal = new Request('http://10.0.0.8:3000/api/auth/sms/hook', {
      method: 'POST',
      headers: signed.headers,
      body: await signed.text(),
    })

    const response = await POST(internal)
    expect(response.status).toBe(200)
  })

  it('rejects a signature made with another secret with 401 and the hook error shape', async () => {
    const response = await POST(signedRequest(samplePayload(), OTHER_SECRET))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: { http_code: 401, message: 'Invalid webhook signature' } })
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('rejects missing signature headers with 401', async () => {
    const response = await POST(
      new Request('https://steam.bj.cn/api/auth/sms/hook', {
        method: 'POST',
        body: JSON.stringify(samplePayload()),
        headers: { 'content-type': 'application/json' },
      }),
    )

    expect(response.status).toBe(401)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('rejects a tampered body with 401', async () => {
    const signed = signedRequest(samplePayload())
    const tampered = new Request(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: JSON.stringify(samplePayload({ sms: { otp: '000000' } })),
    })

    const response = await POST(tampered)
    expect(response.status).toBe(401)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('rejects a stale timestamp (replay) with 401', async () => {
    const response = await POST(signedRequest(samplePayload(), HOOK_SECRET, new Date(Date.now() - 60 * 60 * 1000)))
    expect(response.status).toBe(401)
  })

  it('returns 400 error shape for malformed payloads without sending', async () => {
    for (const body of [
      '[]',
      { user: { phone: '8613800138000' } },
      samplePayload({ sms: { otp: 'abc' } }),
      samplePayload({ user: { id: 'u', phone: '' } }),
      samplePayload({ user: { id: 'u', phone: '14155552671' } }),
    ]) {
      const response = await POST(signedRequest(body))
      expect(response.status).toBe(400)
      const json = (await response.json()) as { error: { http_code: number; message: string } }
      expect(json.error.http_code).toBe(400)
      expect(json.error.message).toMatch(/^Invalid payload/)
    }
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('returns 500 when the hook secret is not configured', async () => {
    vi.stubEnv('SUPABASE_SEND_SMS_HOOK_SECRET', '')
    const response = await POST(signedRequest(samplePayload()))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: { http_code: 500, message: 'Send SMS hook is not configured' } })
  })

  it('maps provider failure to 502 and logs a masked, otp-free line', async () => {
    mocks.send.mockResolvedValue({
      ok: false,
      code: 'biz.FREQUENCY',
      error: 'frequency limit for 13800138000 code 561166',
      requestId: 'req-x',
    })

    const response = await POST(signedRequest(samplePayload()))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: { http_code: 502, message: 'SMS provider failed to send the message' },
    })
    const logs = loggedText()
    expect(logs).toContain('code=biz.FREQUENCY')
    expect(logs).toContain('phone=138****8000')
    expect(logs).not.toContain('13800138000')
    expect(logs).not.toContain('561166')
    expect(logs).not.toContain(RAW_SECRET)
  })

  it('maps a thrown sender error to 502', async () => {
    mocks.send.mockRejectedValue(new Error('socket hang up'))
    const response = await POST(signedRequest(samplePayload()))
    expect(response.status).toBe(502)
  })

  it('maps provider timeout to 504 and honours the configured timeout', async () => {
    vi.stubEnv('SUPABASE_SEND_SMS_HOOK_SMS_TIMEOUT_MS', '1200')
    mocks.send.mockResolvedValue({ ok: false, timedOut: true, code: 'TIMEOUT', error: 'timed out after 1200ms' })

    const response = await POST(signedRequest(samplePayload()))

    expect(mocks.send).toHaveBeenCalledWith('13800138000', '561166', { timeoutMs: 1200 })
    expect(response.status).toBe(504)
    await expect(response.json()).resolves.toEqual({ error: { http_code: 504, message: 'SMS provider timed out' } })
    expect(loggedText()).toContain('timedOut=yes')
  })
})

describe('send SMS hook helpers', () => {
  it('parses Supabase secret formats including rotation lists', () => {
    expect(parseHookSecrets('v1,whsec_abc=')).toEqual(['abc='])
    expect(parseHookSecrets('whsec_abc')).toEqual(['abc'])
    expect(parseHookSecrets('v1,whsec_a | v1,whsec_b')).toEqual(['a', 'b'])
    expect(parseHookSecrets(undefined)).toEqual([])
  })

  it('keeps the SMS timeout inside the 5s Supabase hook budget', () => {
    expect(DEFAULT_SEND_SMS_TIMEOUT_MS).toBe(3000)
    expect(resolveSmsTimeoutMs(undefined)).toBe(3000)
    expect(resolveSmsTimeoutMs('abc')).toBe(3000)
    expect(resolveSmsTimeoutMs('10000')).toBe(3500)
    expect(resolveSmsTimeoutMs('10')).toBe(500)
  })
})
