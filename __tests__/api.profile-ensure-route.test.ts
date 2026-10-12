import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), ensure: vi.fn(), limit: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }))
vi.mock('@/lib/auth/ensure-profile', () => ({ ensureProfile: mocks.ensure }))
vi.mock('@/lib/api/auth-rate-limit', () => ({ requireRequestRateLimit: mocks.limit }))
import { POST } from '@/app/api/profile/ensure/route'
import { RateLimitError } from '@/lib/api/auth'
const request = () => new Request('http://localhost/api/profile/ensure', { method: 'POST', body: JSON.stringify({ userId: 'victim' }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'current', user_metadata: {}, phone: null } } })
  mocks.ensure.mockResolvedValue({ ok: true, created: true })
})
it('rejects anonymous users', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  expect((await POST(request())).status).toBe(401)
  expect(mocks.ensure).not.toHaveBeenCalled()
})
it('uses only the authenticated user and rate limits them', async () => {
  expect(await (await POST(request())).json()).toEqual({ ok: true, created: true })
  expect(mocks.ensure).toHaveBeenCalledWith({ userId: 'current', userMetadata: {}, phone: null })
  expect(mocks.limit).toHaveBeenCalledWith(expect.any(Request), expect.objectContaining({ suffix: 'current' }))
})
it('returns recovery failure without internal errors', async () => {
  mocks.ensure.mockResolvedValue({ ok: false, created: false, error: 'internal' })
  expect(await (await POST(request())).json()).toEqual({ ok: false, created: false })
})
it('honors rate limits', async () => {
  mocks.limit.mockImplementation(() => { throw new RateLimitError('Too many requests', { limit: 10, remaining: 0, resetAt: 100, retryAfterSeconds: 60 }) })
  expect((await POST(request())).status).toBe(429)
  expect(mocks.ensure).not.toHaveBeenCalled()
})
