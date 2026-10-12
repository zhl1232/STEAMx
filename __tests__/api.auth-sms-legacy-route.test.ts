import { ensureProfile } from '@/lib/auth/ensure-profile'
vi.mock('@/lib/auth/ensure-profile', () => ({ ensureProfile: vi.fn(async () => ({ ok: false, created: false })) }))
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Otp = { id: string; phone: string; code: string; type: string; user_id: string | null; expires_at: string }
const state = vi.hoisted(() => ({ rows: [] as Otp[], dbError: false, binding: false }))
const admin = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { admin: {
    getUserById: vi.fn(), updateUserById: vi.fn(), generateLink: vi.fn(),
  } },
}))

// Simulates DELETE ... WHERE ... RETURNING at the database boundary.
// A SELECT without DELETE cannot consume a row, and a second request sees no row.
function otpQuery() {
  const predicates: Array<(row: Otp) => boolean> = []
  let deleting = false
  const query = {
    delete: () => { deleting = true; return query },
    eq: (field: keyof Otp, value: unknown) => { predicates.push(row => row[field] === value); return query },
    is: (field: keyof Otp, value: unknown) => { predicates.push(row => row[field] === value); return query },
    gt: (field: keyof Otp, value: string) => { predicates.push(row => String(row[field]) > value); return query },
    select: () => query,
    then: (resolve: (result: unknown) => unknown) => {
      if (state.dbError) return Promise.resolve({ data: null, error: { message: 'database unavailable' } }).then(resolve)
      const matches = state.rows.filter(row => predicates.every(predicate => predicate(row)))
      if (deleting) state.rows = state.rows.filter(row => !matches.includes(row))
      return Promise.resolve({ data: matches, error: null }).then(resolve)
    },
  }
  return query
}
function otherQuery(table: string) {
  const query = {
    select: () => query, eq: () => query,
    single: async () => ({ data: { user_id: 'user-1' }, error: null }),
    limit: async () => ({ data: [], error: null }),
    upsert: async () => ({ error: null }),
    update: () => query,
    then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: table === 'profiles' ? [] : null, error: null }).then(resolve),
  }
  return query
}
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: admin }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1', phone: null } } }) } }),
  createPublicClient: vi.fn(),
}))
vi.mock('@/lib/api/auth-rate-limit', () => ({ requireRequestRateLimit: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ handleApiError: vi.fn(() => Response.json({ error: 'unexpected' }, { status: 500 })) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/auth/phone-provider', () => ({ isSupabasePhoneProvider: () => false }))

import { POST } from '@/app/api/auth/sms/verify/route'

function request(type = 'login') {
  return new Request('http://localhost/api/auth/sms/verify', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: '13800138000', code: '123456', type }),
  })
}
describe('legacy SMS verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.dbError = false
    state.rows = [{ id: 'otp-1', phone: '+8613800138000', code: '123456', type: 'login', user_id: null, expires_at: '2099-01-01T00:00:00.000Z' }]
    admin.from.mockImplementation(table => table === 'phone_otps' ? otpQuery() : otherQuery(table))
    admin.auth.admin.getUserById.mockResolvedValue({ data: { user: {
      id: 'user-1', email: 'u@example.test', phone: '+8613800138000',
      user_metadata: { username: 'user_one', full_name: '测试用户' },
    } }, error: null })
    admin.auth.admin.updateUserById.mockResolvedValue({ data: null, error: null })
    admin.auth.admin.generateLink.mockResolvedValue({ data: { properties: { action_link: 'https://auth.test/link' } }, error: null })
  })

  it('logs an existing user in once and consumes duplicate matching codes', async () => {
    state.rows.push({ ...state.rows[0], id: 'otp-2' })
    expect((await POST(request())).status).toBe(200)
    expect(ensureProfile).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', phone: '+8613800138000' }))
    expect(state.rows).toHaveLength(0)
    expect((await POST(request())).status).toBe(400)
    expect(admin.auth.admin.generateLink).toHaveBeenCalledTimes(1)
  })

  it.each([
    { expires_at: '2000-01-01T00:00:00.000Z' },
    { type: 'phone_change' },
    { user_id: 'another-user' },
    { phone: '+8613900139000' },
    { code: '654321' },
  ])('rejects an OTP outside the login scope: %j', async patch => {
    Object.assign(state.rows[0], patch)
    expect((await POST(request())).status).toBe(400)
    expect(state.rows).toHaveLength(1)
    expect(admin.auth.admin.generateLink).not.toHaveBeenCalled()
  })

  it('fails closed when the database cannot consume the code', async () => {
    state.dbError = true
    expect((await POST(request())).status).toBe(500)
    expect(admin.auth.admin.generateLink).not.toHaveBeenCalled()
  })

  it('binds the signed-in user only after consuming their binding OTP', async () => {
    Object.assign(state.rows[0], { type: 'phone_change', user_id: 'user-1' })
    expect((await POST(request('phone_change'))).status).toBe(200)
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith('user-1', { phone: '+8613800138000', phone_confirm: true })
    expect((await POST(request('phone_change'))).status).toBe(400)
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledTimes(1)
  })

  it('rejects another user’s binding code', async () => {
    Object.assign(state.rows[0], { type: 'phone_change', user_id: 'another-user' })
    expect((await POST(request('phone_change'))).status).toBe(400)
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled()
  })
})
