/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET } from '@/app/api/notifications/unread-count/route'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/api/auth'

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

describe('GET /api/notifications/unread-count', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the unread notification count', async () => {
    const counts = new Map([
      ['system', 3],
      ['reply,mention,creator_update', 2],
      ['like,tip', 4],
      ['follow', 1],
    ])
    const inTypes = vi.fn((_column: string, types: string[]) =>
      Promise.resolve({ count: counts.get(types.join(',')) ?? 0, error: null }),
    )
    const eqIsRead = vi.fn(() => ({ in: inTypes }))
    const eqUser = vi.fn(() => ({ eq: eqIsRead }))
    const select = vi.fn(() => ({ eq: eqUser }))
    const from = vi.fn(() => ({ select }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      count: 10,
      countsByCategory: { system: 3, replies: 2, likes: 4, follows: 1 },
    })
    expect(from).toHaveBeenCalledWith('notifications')
    expect(select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqIsRead).toHaveBeenCalledWith('is_read', false)
    expect(inTypes).toHaveBeenCalledTimes(4)
  })

  it('fails soft when Supabase times out', async () => {
    const inTypes = vi.fn().mockRejectedValue({
      message: 'TypeError: fetch failed',
      details:
        'ConnectTimeoutError: Connect Timeout Error (attempted address: spb-l3q6k3bebzxrok83.supabase.opentrust.net:443, timeout: 10000ms) (UND_ERR_CONNECT_TIMEOUT)',
    })
    const eqIsRead = vi.fn(() => ({ in: inTypes }))
    const eqUser = vi.fn(() => ({ eq: eqIsRead }))
    const select = vi.fn(() => ({ eq: eqUser }))
    const from = vi.fn(() => ({ select }))

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ count: 0, degraded: true })
    expect(response.headers.get('X-Upstream-Status')).toBe('degraded')
    expect(inTypes).toHaveBeenCalled()
  })
})
