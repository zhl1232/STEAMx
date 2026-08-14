/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { POST } from '@/app/api/profile/growth-tasks/sync/route'
import { GROWTH_TASK_GRADUATION_ACTION_TYPE, GROWTH_TASK_GRADUATION_RESOURCE_ID } from '@/lib/profile/growth-tasks'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

const { supabaseAdminMock } = vi.hoisted(() => ({
  supabaseAdminMock: {
    from: vi.fn(),
  },
}))

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

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

describe('POST /api/profile/growth-tasks/sync', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
  })

  it('returns real task progress and claimed states', async () => {
    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: { bio: '喜欢观察鸟类' },
      error: null,
    })
    const profileEq = vi.fn().mockReturnValue({
      maybeSingle: profileMaybeSingle,
    })
    const profileSelect = vi.fn().mockReturnValue({
      eq: profileEq,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: profileSelect }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    callRpcMock.mockResolvedValue({
      data: {
        lessonsStarted: 1,
        lessonsCompleted: 1,
        worksPublished: 1,
        observationsSubmitted: 1,
      },
      error: null,
    } as never)

    const graduationRowMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const rewardEqAction = vi.fn().mockResolvedValue({
      data: [{ resource_id: 'start_first_lesson' }],
      error: null,
    })
    const rewardEqUser = vi.fn().mockReturnValue({
      eq: rewardEqAction,
    })
    const rewardSelect = vi.fn((columns?: string) => {
      if (columns === 'created_at') {
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: graduationRowMaybeSingle,
              }),
            }),
          }),
        }
      }
      return {
        eq: rewardEqUser,
      }
    })

    supabaseAdminMock.from.mockImplementation((table: string) => {
      if (table === 'xp_logs') {
        return { select: rewardSelect }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: 'start_first_lesson',
          status: 'claimed',
        }),
        expect.objectContaining({
          id: 'complete_first_lesson',
          status: 'claimable',
        }),
        expect.objectContaining({
          id: 'publish_first_work',
          status: 'claimable',
        }),
        expect.objectContaining({
          id: 'write_bio',
          status: 'claimable',
        }),
        expect.objectContaining({
          id: 'submit_first_observation',
          status: 'claimable',
        }),
      ]),
      completedTaskCount: 5,
      graduatedAt: null,
    })
  })

  it('returns graduatedAt and backfills graduation log when all tasks are claimed but sentinel was missing', async () => {
    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: { bio: '喜欢观察鸟类' },
      error: null,
    })
    const profileEq = vi.fn().mockReturnValue({
      maybeSingle: profileMaybeSingle,
    })
    const profileSelect = vi.fn().mockReturnValue({
      eq: profileEq,
    })

    createClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return { select: profileSelect }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    } as never)

    callRpcMock.mockResolvedValue({
      data: {
        lessonsStarted: 1,
        lessonsCompleted: 1,
        worksPublished: 1,
        observationsSubmitted: 1,
      },
      error: null,
    } as never)

    const allFiveRows = [
      { resource_id: 'start_first_lesson' },
      { resource_id: 'complete_first_lesson' },
      { resource_id: 'publish_first_work' },
      { resource_id: 'write_bio' },
      { resource_id: 'submit_first_observation' },
    ]

    const graduationAfterBackfill = vi.fn().mockResolvedValue({
      data: { created_at: '2026-05-08T10:00:00.000Z' },
      error: null,
    })

    const upsertMock = vi.fn().mockResolvedValue({ error: null })

    const rewardEqAction = vi.fn().mockResolvedValue({
      data: allFiveRows,
      error: null,
    })
    const rewardEqUser = vi.fn().mockReturnValue({
      eq: rewardEqAction,
    })

    let graduationSelectPass = 0
    const rewardSelect = vi.fn((columns?: string) => {
      if (columns === 'created_at') {
        graduationSelectPass += 1
        if (graduationSelectPass === 1) {
          return {
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return {
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: graduationAfterBackfill,
              }),
            }),
          }),
        }
      }
      return {
        eq: rewardEqUser,
      }
    })

    supabaseAdminMock.from.mockImplementation((table: string) => {
      if (table === 'xp_logs') {
        return { select: rewardSelect, upsert: upsertMock }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.graduatedAt).toBe('2026-05-08T10:00:00.000Z')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        action_type: GROWTH_TASK_GRADUATION_ACTION_TYPE,
        resource_id: GROWTH_TASK_GRADUATION_RESOURCE_ID,
        xp_amount: 0,
      }),
      expect.any(Object),
    )
  })
})
