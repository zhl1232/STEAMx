/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { POST } from '@/app/api/discussions/[id]/like/route'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@/lib/supabase/rpc', () => ({
  callRpc: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

describe('POST /api/discussions/[id]/like', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when the discussion does not exist', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await POST(new Request('http://localhost/api/discussions/404/like', {
      method: 'POST',
    }), {
      params: Promise.resolve({ id: '404' }),
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Discussion not found' })
  })
})
