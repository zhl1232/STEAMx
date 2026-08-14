/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/tips/route'
import { GET as GET_MY_TIP } from '@/app/api/tips/my/route'
import { createClient } from '@/lib/supabase/server'
import { PermissionError, requireAuth } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { assertUsersNotBlocked } from '@/lib/safety/server'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/safety/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/safety/server')>()
  return {
    ...actual,
    assertUsersNotBlocked: vi.fn(),
  }
})

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return {
    ...actual,
    requireAuth: vi.fn(),
  }
})

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn().mockResolvedValue(undefined),
}))

describe('tips routes visibility', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const requireRateLimitMock = requireRateLimit as Mock<typeof requireRateLimit>
  const assertUsersNotBlockedMock = assertUsersNotBlocked as Mock<typeof assertUsersNotBlocked>

  beforeEach(() => {
    vi.clearAllMocks()
    requireRateLimitMock.mockResolvedValue(undefined)
    assertUsersNotBlockedMock.mockResolvedValue(undefined)
  })

  it('returns 404 when tipping a pending project as another user', async () => {
    const projectMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 15,
        author_id: 'owner-1',
        status: 'pending',
      },
      error: null,
    })
    const rpc = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: projectMaybeSingle,
            })),
          })),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { age_confirmed_at: null, interaction_restricted: false },
                error: null,
              }),
            })),
          })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({ from, rpc } as never)
    requireAuthMock.mockResolvedValue({ id: 'viewer-1' } as never)

    const response = await POST(new Request('http://localhost/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceType: 'project',
        resourceId: 15,
        amount: 1,
      }),
    }) as never)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '项目不存在' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns 404 when reading my tip amount for a pending project as another user', async () => {
    const projectMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 15,
        author_id: 'owner-1',
        status: 'pending',
      },
      error: null,
    })
    const rpc = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: projectMaybeSingle,
            })),
          })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({
      from,
      rpc,
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'viewer-1' } },
        }),
      },
    } as never)

    const response = await GET_MY_TIP(
      new NextRequest('http://localhost/api/tips/my?resourceType=project&resourceId=15') as never
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: '项目不存在' })
    expect(rpc).not.toHaveBeenCalled()
  })

  // 打赏会给对方推一条带昵称头像的通知，屏蔽关系下必须整体拒绝，不能只是扣完币不发通知。
  it('rejects a tip between blocked users without moving coins', async () => {
    const rpc = vi.fn()
    const notificationInsert = vi.fn()
    const from = vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 15, author_id: 'owner-1', status: 'approved', moderation_state: 'approved', is_public: true },
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { age_confirmed_at: '2020-01-01', interaction_restricted: false },
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'notifications') return { insert: notificationInsert }
      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({ from, rpc } as never)
    requireAuthMock.mockResolvedValue({ id: 'viewer-1' } as never)
    assertUsersNotBlockedMock.mockRejectedValue(
      new PermissionError('你已屏蔽该用户，或对方已屏蔽你', 'USER_BLOCKED'),
    )

    const response = await POST(new Request('http://localhost/api/tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resourceType: 'project', resourceId: 15, amount: 1 }),
    }) as never)

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ code: 'USER_BLOCKED' })
    expect(assertUsersNotBlockedMock).toHaveBeenCalledWith(expect.anything(), 'viewer-1', 'owner-1')
    expect(rpc).not.toHaveBeenCalled()
    expect(notificationInsert).not.toHaveBeenCalled()
  })

  it('returns zero tips for anonymous viewers without consuming the per-user limiter', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } })
    createClientMock.mockResolvedValue({
      auth: { getUser },
      from: vi.fn(),
      rpc: vi.fn(),
    } as never)

    const response = await GET_MY_TIP(
      new NextRequest('http://localhost/api/tips/my?resourceType=completion&resourceId=18') as never
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ myTipped: 0 })
    expect(requireRateLimitMock).not.toHaveBeenCalled()
  })
})
