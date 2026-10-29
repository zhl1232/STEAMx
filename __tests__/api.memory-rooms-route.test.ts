import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/playground/memory-rooms/route'
const mock = vi.hoisted(() => ({ requireAuth: vi.fn(), createClient: vi.fn() }))
vi.mock('@/lib/api/auth', () => ({ requireAuth: mock.requireAuth, handleApiError: () => new Response(null, { status: 401 }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mock.createClient }))
describe('legacy memory room creation', () => {
  beforeEach(() => { vi.clearAllMocks(); mock.createClient.mockResolvedValue({}); mock.requireAuth.mockResolvedValue({ id: 'user' }) })
  it('requires the new simultaneous race entry without creating a legacy room', async () => {
    const response = await POST()
    expect(response.status).toBe(410)
    expect((await response.json()).code).toBe('MEMORY_RACE_REQUIRED')
  })
  it('keeps authentication required on the retired entry', async () => {
    mock.requireAuth.mockRejectedValue(new Error('unauthorized'))
    expect((await POST()).status).toBe(401)
  })
})
