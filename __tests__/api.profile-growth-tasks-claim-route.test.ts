/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { POST } from '@/app/api/profile/growth-tasks/claim/route'
import { AuthError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

const { supabaseAdminMock } = vi.hoisted(() => ({ supabaseAdminMock: { rpc: vi.fn() } }))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/api/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/auth')>()), requireAuth: vi.fn(),
}))
vi.mock('@/lib/api/rate-limit', () => ({ requireRateLimit: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: supabaseAdminMock }))

describe('POST /api/profile/growth-tasks/claim', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
  const adminRpcMock = supabaseAdminMock.rpc
  const request = (body: unknown) => new Request('http://localhost/api/profile/growth-tasks/claim', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }) as never

  beforeEach(() => {
    vi.clearAllMocks(); createClientMock.mockResolvedValue({} as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never); requireRateLimitMock.mockResolvedValue(undefined as never)
  })

  it('requires authentication and applies the claim rate limit', async () => {
    requireAuthMock.mockRejectedValue(new AuthError('Unauthorized'))
    const response = await POST(request({ taskId: 'start_first_lesson' }))
    expect(response.status).toBe(401); expect(requireRateLimitMock).not.toHaveBeenCalled(); expect(adminRpcMock).not.toHaveBeenCalled()
  })

  it('rejects invalid task ids before calling the RPC', async () => {
    const response = await POST(request({ taskId: 'forged_task' }))
    expect(response.status).toBe(400); await expect(response.json()).resolves.toEqual({ error: 'Invalid taskId' })
    expect(requireRateLimitMock).toHaveBeenCalledWith(expect.anything(), { key: 'api-growth-task-claim', limit: 20, windowMs: 60_000 }); expect(adminRpcMock).not.toHaveBeenCalled()
  })

  it('keeps the unfinished-task rejection contract', async () => {
    adminRpcMock.mockResolvedValue({ data: null, error: { message: 'task is not complete' } } as never)
    const response = await POST(request({ taskId: 'start_first_lesson' }))
    expect(response.status).toBe(400); await expect(response.json()).resolves.toEqual({ error: '任务尚未完成，暂不能领取' })
    expect(adminRpcMock).toHaveBeenCalledWith('claim_platform_growth_task', { p_user_id: 'user-1', p_task_id: 'start_first_lesson' })
  })

  it('returns the normal reward result from the transactional RPC', async () => {
    adminRpcMock.mockResolvedValue({ data: { xp_granted: 10, already_claimed: false, graduated: false }, error: null } as never)
    const response = await POST(request({ taskId: 'start_first_lesson' }))
    expect(response.status).toBe(200); await expect(response.json()).resolves.toEqual({ ok: true, alreadyClaimed: false, taskId: 'start_first_lesson', taskLabel: '开始一次实践', xpGranted: 10, graduated: false })
  })

  it('returns idempotent success when the RPC reports an existing reward', async () => {
    adminRpcMock.mockResolvedValue({ data: { xp_granted: 0, already_claimed: true, graduated: false }, error: null } as never)
    const response = await POST(request({ taskId: 'start_first_lesson' }))
    expect(response.status).toBe(200); await expect(response.json()).resolves.toEqual({ ok: true, alreadyClaimed: true, taskId: 'start_first_lesson', taskLabel: '开始一次实践', xpGranted: 0, graduated: false })
  })

  it('returns the graduation flag for the final reward', async () => {
    adminRpcMock.mockResolvedValue({ data: { xp_granted: 10, already_claimed: false, graduated: true }, error: null } as never)
    const response = await POST(request({ taskId: 'submit_first_observation' }))
    expect(response.status).toBe(200); await expect(response.json()).resolves.toEqual(expect.objectContaining({ taskId: 'submit_first_observation', taskLabel: '记录 1 条自然观察', xpGranted: 10, graduated: true }))
  })
})
