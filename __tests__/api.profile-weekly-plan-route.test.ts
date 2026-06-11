/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/api/profile/weekly-plan/route'
import { AuthError, requireAuth } from '@/lib/api/auth'
import { getWeeklyPlanData } from '@/lib/api/weekly-plan-data'
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

vi.mock('@/lib/api/weekly-plan-data', () => ({
  getWeeklyPlanData: vi.fn(),
}))

describe('GET /api/profile/weekly-plan', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const getWeeklyPlanDataMock = getWeeklyPlanData as Mock<typeof getWeeklyPlanData>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the derived weekly plan for the signed-in user', async () => {
    const supabase = { from: vi.fn() }
    const plan = {
      title: '本周探索计划',
      subtitle: '继续探索',
      weekStart: '2026-06-08T16:00:00.000Z',
      completedCount: 1,
      steps: [
        {
          id: 'todo:explore',
          type: 'explore',
          status: 'todo',
          title: '去发现新项目',
          subtitle: '浏览 STEAM 项目',
          href: '/explore',
          actionLabel: '去探索',
          badgeLabel: '推荐',
        },
      ],
    }

    createClientMock.mockResolvedValue(supabase as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    getWeeklyPlanDataMock.mockResolvedValue(plan as never)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(requireAuthMock).toHaveBeenCalledWith(supabase)
    expect(getWeeklyPlanDataMock).toHaveBeenCalledWith(supabase, 'user-1')
    await expect(response.json()).resolves.toEqual({ plan })
  })

  it('delegates auth failures to the shared API error handler', async () => {
    createClientMock.mockResolvedValue({} as never)
    requireAuthMock.mockRejectedValue(new AuthError('Unauthorized'))

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(getWeeklyPlanDataMock).not.toHaveBeenCalled()
  })
})
