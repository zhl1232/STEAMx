/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/api/profile/study-checkin/route'
import { requireAuth } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'
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
  callRpc: vi.fn(),
}))

describe('GET /api/profile/study-checkin', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({} as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
  })

  it('returns study check-in summary from rpc', async () => {
    callRpcMock.mockResolvedValue({
      data: {
        streak: 4,
        todayCompleted: false,
        streakThroughDate: '2026-05-06',
        days: [
          { date: '2026-05-02', label: '5.02', completed: true },
          { date: '2026-05-03', label: '5.03', completed: true },
          { date: '2026-05-04', label: '5.04', completed: false },
          { date: '2026-05-05', label: '5.05', completed: true },
          { date: '2026-05-06', label: '5.06', completed: true },
          { date: '2026-05-07', label: '5.07', completed: false },
        ],
      },
      error: null,
    })

    const response = await GET()

    expect(callRpcMock).toHaveBeenCalledWith(
      expect.anything(),
      'get_user_study_checkin_summary',
      {
        target_user_id: 'user-1',
        window_days: 6,
      },
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      streak: 4,
      todayCompleted: false,
      streakThroughDate: '2026-05-06',
      days: [
        { date: '2026-05-02', label: '5.02', completed: true },
        { date: '2026-05-03', label: '5.03', completed: true },
        { date: '2026-05-04', label: '5.04', completed: false },
        { date: '2026-05-05', label: '5.05', completed: true },
        { date: '2026-05-06', label: '5.06', completed: true },
        { date: '2026-05-07', label: '5.07', completed: false },
      ],
    })
  })

  it('returns 500 when rpc yields no data', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: null,
    })

    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
    })
  })
})
