import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const supabase = {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
      updateUser: vi.fn(),
      setSession: vi.fn(),
    },
  }
  const admin = {
    from: vi.fn(),
  }
  return { supabase, admin }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => mocks.supabase),
  createPublicClient: vi.fn(() => mocks.supabase),
}))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: mocks.admin }))
vi.mock('@/lib/sms/send', () => ({ sendVerificationSms: vi.fn() }))
vi.mock('@/lib/sms/aliyun', () => ({ isAliyunConfigured: vi.fn(() => false), checkSmsVerifyCode: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ handleApiError: vi.fn((error) => Response.json({ error: String(error) }, { status: 500 })) }))
vi.mock('@/lib/api/auth-rate-limit', () => ({ requireRequestRateLimit: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

import { POST as sendOtp } from '@/app/api/auth/sms/send/route'
import { POST as verifyOtp } from '@/app/api/auth/sms/verify/route'

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/sms', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function adminRows(rows: unknown[] = []) {
  const state = { rows: [...rows] }
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: state.rows, error: null })),
    upsert: vi.fn(async (value: { phone: string; user_id: string }) => {
      if (!state.rows.length) state.rows.push({ user_id: value.user_id })
      return { error: null }
    }),
  }
  mocks.admin.from.mockReturnValue(query)
  return query
}

describe('native Supabase phone auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_PHONE_PROVIDER', 'supabase')
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    mocks.supabase.auth.setSession.mockResolvedValue({ error: null })
    adminRows()
  })

  it('dispatches login OTP through Supabase and requests user creation', async () => {
    mocks.supabase.auth.signInWithOtp.mockResolvedValue({ error: null })

    const response = await sendOtp(request({ phone: '13800138000', type: 'login' }))

    expect(response.status).toBe(200)
    expect(mocks.supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      phone: '+8613800138000',
      options: { shouldCreateUser: true },
    })
  })

  it('returns provider errors without falling back to custom SMS', async () => {
    mocks.supabase.auth.signInWithOtp.mockResolvedValue({ error: { message: 'provider unavailable' } })

    const response = await sendOtp(request({ phone: '13800138000', type: 'login' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'provider unavailable' })
  })

  it('preserves the native service timeout status for diagnostics', async () => {
    mocks.supabase.auth.signInWithOtp.mockResolvedValue({ error: { status: 504, message: 'Processing this request timed out, please retry after a moment.' } })
    const response = await sendOtp(request({ phone: '13800138000', type: 'login' }))
    expect(response.status).toBe(504)
    expect(mocks.supabase.auth.signInWithOtp).toHaveBeenCalledOnce()
  })

  it('verifies native OTP, stores a new compatibility mapping, and reports new user', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    })
    const query = adminRows([])

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      ok: true,
      isNewUser: true,
      session: { access_token: 'access', refresh_token: 'refresh' },
    })
    expect(mocks.supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+8613800138000',
      token: '123456',
      type: 'sms',
    })
    expect(query.upsert).toHaveBeenCalledWith(
      { phone: '+8613800138000', user_id: 'user-1' },
      { onConflict: 'phone', ignoreDuplicates: true },
    )
  })

  it('rejects a compatibility mapping owned by another user', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-2' }, session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    })
    adminRows([{ user_id: 'user-1' }])

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456' }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: '手机号已绑定其他账号，请联系管理员处理' })
    expect(mocks.supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('reports an existing mapped user as returning and installs its session after checks', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    })
    adminRows([{ user_id: 'user-1' }])

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      isNewUser: false,
      session: { access_token: 'access', refresh_token: 'refresh' },
    })
    expect(mocks.supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access',
      refresh_token: 'refresh',
    })
  })

  it('does not install a session when a concurrent mapping claims the phone', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    })
    const query = adminRows([])
    query.limit
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ user_id: 'other-user' }], error: null })

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456' }))

    expect(response.status).toBe(409)
    expect(mocks.supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('fails closed on invalid native OTP', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: '验证码错误或已过期，请重新获取' },
    })

    const response = await verifyOtp(request({ phone: '13800138000', code: '000000' }))

    expect(response.status).toBe(400)
    expect(mocks.supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('uses the authenticated user for native phone change', async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', phone: null } } })
    mocks.supabase.auth.updateUser.mockResolvedValue({ error: null })

    const sendResponse = await sendOtp(request({ phone: '13800138000', type: 'phone_change' }))

    expect(sendResponse.status).toBe(200)
    expect(mocks.supabase.auth.updateUser).toHaveBeenCalledWith({ phone: '+8613800138000' })

    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          phone: '8613800138000',
          phone_confirmed_at: '2026-09-20T00:00:00.000Z',
        },
      },
      error: null,
    })
    const verifyResponse = await verifyOtp(request({ phone: '13800138000', code: '123456', type: 'phone_change' }))

    expect(verifyResponse.status).toBe(200)
    expect(mocks.supabase.auth.verifyOtp).toHaveBeenCalledWith({
      phone: '+8613800138000',
      token: '123456',
      type: 'phone_change',
    })
  })

  it('rejects a phone-change OTP that verifies a different user', async () => {
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', phone: null } } })
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: {
        user: {
          id: 'other-user',
          phone: '8613800138000',
          phone_confirmed_at: '2026-09-20T00:00:00.000Z',
        },
      },
      error: null,
    })

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456', type: 'phone_change' }))

    expect(response.status).toBe(409)
    expect(mocks.supabase.auth.setSession).not.toHaveBeenCalled()
  })

  it('rejects phone change without an authenticated user or with a bound phone', async () => {
    const unauthenticated = await sendOtp(request({ phone: '13800138000', type: 'phone_change' }))
    expect(unauthenticated.status).toBe(401)

    mocks.supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1', phone: '+8613800138000', phone_confirmed_at: '2026-09-20T00:00:00.000Z' } },
    })
    const bound = await sendOtp(request({ phone: '13800138000', type: 'phone_change' }))
    expect(bound.status).toBe(409)
    expect(mocks.supabase.auth.updateUser).not.toHaveBeenCalled()
  })

  it('fails closed when the compatibility mapping cannot be read', async () => {
    mocks.supabase.auth.verifyOtp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 'access', refresh_token: 'refresh' } },
      error: null,
    })
    const query = adminRows([])
    query.limit.mockResolvedValue({ data: null, error: { message: 'database unavailable' } } as never)

    const response = await verifyOtp(request({ phone: '13800138000', code: '123456' }))

    expect(response.status).toBe(500)
    expect(mocks.supabase.auth.setSession).not.toHaveBeenCalled()
  })
})
