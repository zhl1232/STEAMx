/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { POST } from '@/app/api/profile/growth-tasks/claim/route'
import { GROWTH_TASK_GRADUATION_ACTION_TYPE, GROWTH_TASK_GRADUATION_RESOURCE_ID } from '@/lib/profile/growth-tasks'
import { requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
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

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn(),
}))

vi.mock('@/lib/supabase/rpc', () => ({
  callRpc: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: supabaseAdminMock,
}))

describe('POST /api/profile/growth-tasks/claim', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    requireRateLimitMock.mockResolvedValue(undefined as never)
  })

  it('claims a completed task and increments XP once', async () => {
    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: { bio: '喜欢动手实验' },
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
        lessonsCompleted: 0,
        worksPublished: 0,
        observationsSubmitted: 0,
      },
      error: null,
    } as never)

    const rewardMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })
    const rewardEqResource = vi.fn().mockReturnValue({
      maybeSingle: rewardMaybeSingle,
    })
    const rewardEqAction = vi.fn().mockReturnValue({
      eq: rewardEqResource,
    })
    const rewardEqUser = vi.fn().mockReturnValue({
      eq: rewardEqAction,
    })
    const rewardSelect = vi.fn().mockReturnValue({
      eq: rewardEqUser,
    })

    const rewardInsertSelect = vi.fn().mockResolvedValue({
      data: [{ id: 1 }],
      error: null,
    })
    const rewardUpsert = vi.fn().mockReturnValue({
      select: rewardInsertSelect,
    })

    supabaseAdminMock.from.mockImplementation((table: string) => {
      if (table === 'xp_logs') {
        return {
          select: rewardSelect,
          upsert: rewardUpsert,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      new Request('http://localhost/api/profile/growth-tasks/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskId: 'start_first_lesson' }),
      }) as never,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      alreadyClaimed: false,
      taskId: 'start_first_lesson',
      taskLabel: '挑一节积木课打开看看',
      xpGranted: 10,
      graduated: false,
    })
    expect(rewardUpsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        action_type: 'profile_growth_task',
        resource_id: 'start_first_lesson',
        xp_amount: 10,
      },
      {
        onConflict: 'user_id,action_type,resource_id',
        ignoreDuplicates: true,
      },
    )
    expect(callRpcMock).toHaveBeenCalledWith(supabaseAdminMock, 'increment_user_xp', {
      p_user_id: 'user-1',
      p_amount: 10,
    })
  })

  it('returns an idempotent success when the reward was already claimed', async () => {
    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: { bio: '喜欢动手实验' },
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
      },
      error: null,
    } as never)

    const rewardMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 9 },
      error: null,
    })
    const rewardEqResource = vi.fn().mockReturnValue({
      maybeSingle: rewardMaybeSingle,
    })
    const rewardEqAction = vi.fn().mockReturnValue({
      eq: rewardEqResource,
    })
    const rewardEqUser = vi.fn().mockReturnValue({
      eq: rewardEqAction,
    })
    const rewardSelect = vi.fn().mockReturnValue({
      eq: rewardEqUser,
    })

    supabaseAdminMock.from.mockImplementation((table: string) => {
      if (table === 'xp_logs') {
        return { select: rewardSelect }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      new Request('http://localhost/api/profile/growth-tasks/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskId: 'start_first_lesson' }),
      }) as never,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      alreadyClaimed: true,
      taskId: 'start_first_lesson',
      xpGranted: 0,
      graduated: false,
    })
    expect(callRpcMock).toHaveBeenCalledTimes(1)
  })

  it('returns graduated true and upserts graduation log when the fifth growth task reward is newly claimed', async () => {
    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: { bio: 'hello' },
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

    const rewardMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const rewardUpsert = vi.fn().mockImplementation((payload: { action_type?: string }) => {
      if (payload.action_type === GROWTH_TASK_GRADUATION_ACTION_TYPE) {
        return {
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'grad-row' }],
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null,
        }),
      }
    })

    const fiveRewardRows = [
      { resource_id: 'start_first_lesson' },
      { resource_id: 'complete_first_lesson' },
      { resource_id: 'publish_first_work' },
      { resource_id: 'write_bio' },
      { resource_id: 'submit_first_observation' },
    ]

    supabaseAdminMock.from.mockImplementation((table: string) => {
      if (table === 'xp_logs') {
        return {
          select: vi.fn((columns?: string) => {
            if (columns === 'resource_id') {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    data: fiveRewardRows,
                    error: null,
                  }),
                }),
              }
            }
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    maybeSingle: rewardMaybeSingle,
                  }),
                }),
              }),
            }
          }),
          upsert: rewardUpsert,
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    const response = await POST(
      new Request('http://localhost/api/profile/growth-tasks/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ taskId: 'submit_first_observation' }),
      }) as never,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      alreadyClaimed: false,
      taskId: 'submit_first_observation',
      taskLabel: '记录 1 条自然观察',
      xpGranted: 10,
      graduated: true,
    })

    expect(rewardUpsert).toHaveBeenCalledWith(
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
