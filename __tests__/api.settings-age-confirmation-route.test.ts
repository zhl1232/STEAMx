/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET, POST } from '@/app/api/settings/age-confirmation/route'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return { ...actual, requireAuth: vi.fn() }
})

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn().mockResolvedValue(undefined),
}))

describe('age confirmation route', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireRateLimitMock.mockResolvedValue(undefined)
  })

  it('reads the explicit confirmation timestamp', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { age_confirmed_at: '2026-08-01T00:00:00.000Z' },
      error: null,
    })
    const eq = vi.fn(() => ({ maybeSingle }))
    const select = vi.fn(() => ({ eq }))
    createClientMock.mockResolvedValue({ from: vi.fn(() => ({ select })) } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      confirmed: true,
      confirmedAt: '2026-08-01T00:00:00.000Z',
    })
  })

  it('confirms through the server RPC instead of updating the profile from the browser', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: '2026-08-01T00:00:00.000Z', error: null })
    createClientMock.mockResolvedValue({ rpc } as never)

    const response = await POST()

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('confirm_my_age', {})
    await expect(response.json()).resolves.toEqual({
      confirmed: true,
      confirmedAt: '2026-08-01T00:00:00.000Z',
      method: 'self',
    })
  })
})
