import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ createUser: vi.fn(), ensure: vi.fn(), role: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { auth: { admin: { createUser: mocks.createUser } } } }))
vi.mock('@/lib/auth/ensure-profile', () => ({ ensureProfile: mocks.ensure }))
vi.mock('@/lib/api/auth', () => ({ requireRole: mocks.role, handleApiError: () => Response.json({}, { status: 403 }) }))
import { POST } from '@/app/api/admin/users/route'
const request = () => new Request('http://localhost/api/admin/users', { method: 'POST', body: JSON.stringify({ email: 'test@example.test', password: 'abcdef', displayName: '测试' }) })
beforeEach(() => {
  vi.resetAllMocks()
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'new', user_metadata: { full_name: '测试' } } }, error: null })
  mocks.ensure.mockResolvedValue({ ok: false, created: false })
})
it('ensures the created user and preserves success when recovery fails', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ id: 'new' })
  expect(mocks.ensure).toHaveBeenCalledWith({ userId: 'new', userMetadata: { full_name: '测试' }, phone: undefined })
})
it('does not ensure a failed creation', async () => {
  mocks.createUser.mockResolvedValue({ data: {}, error: { message: 'already registered' } })
  expect((await POST(request())).status).toBe(400)
  expect(mocks.ensure).not.toHaveBeenCalled()
})
it('requires admin privileges', async () => {
  mocks.role.mockRejectedValue(new Error('denied'))
  expect((await POST(request())).status).toBe(403)
  expect(mocks.createUser).not.toHaveBeenCalled()
})
