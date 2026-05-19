/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { GET } from '@/app/api/moderator/eligibility/route'
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

describe('GET /api/moderator/eligibility', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts only approved completions toward moderator eligibility', async () => {
    const profileSingle = vi.fn().mockResolvedValue({
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        role: 'user',
        xp: 2500,
        created_at: '2026-02-20T00:00:00.000Z',
      },
      error: null,
    })

    const publishedStatusEq = vi.fn().mockResolvedValue({ count: 3 })
    const publishedAuthorEq = vi.fn(() => ({ eq: publishedStatusEq }))

    const completionsNot = vi.fn().mockResolvedValue({ count: 5 })
    const completionsRecordKindEq = vi.fn(() => ({ not: completionsNot }))
    const completionsStatusEq = vi.fn(() => ({ eq: completionsRecordKindEq }))
    const completionsUserEq = vi.fn(() => ({ eq: completionsStatusEq }))

    const commentsAuthorEq = vi.fn().mockResolvedValue({ count: 30 })
    const badgesUserEq = vi.fn().mockResolvedValue({ count: 2 })
    const rejectedStatusEq = vi.fn().mockResolvedValue({ count: 0 })
    const rejectedAuthorEq = vi.fn(() => ({ eq: rejectedStatusEq }))

    let projectsQueryCount = 0
    const from = vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: profileSingle,
            })),
          })),
        }
      }
      if (table === 'projects') {
        projectsQueryCount += 1
        return {
          select: vi.fn(() => ({
            eq: projectsQueryCount === 1 ? publishedAuthorEq : rejectedAuthorEq,
          })),
        }
      }
      if (table === 'completed_projects') {
        return {
          select: vi.fn(() => ({
            eq: completionsUserEq,
          })),
        }
      }
      if (table === 'comments') {
        return {
          select: vi.fn(() => ({
            eq: commentsAuthorEq,
          })),
        }
      }
      if (table === 'user_badges') {
        return {
          select: vi.fn(() => ({
            eq: badgesUserEq,
          })),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
    } as never)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      eligibility: {
        isEligible: true,
        score: 100,
        requirements: {
          level: { met: true, current: 6, required: 5 },
          publishedProjects: { met: true, current: 3, required: 3 },
          completedProjects: { met: true, current: 5, required: 5 },
          commentsCount: { met: true, current: 30, required: 30 },
          badges: { met: true, current: 2, required: 2 },
          accountAge: { met: true, current: expect.any(Number), required: 14 },
          violations: { met: true },
        },
      },
    })

    expect(completionsStatusEq).toHaveBeenCalledWith('status', 'approved')
    expect(completionsRecordKindEq).toHaveBeenCalledWith('record_kind', 'final')
  })
})
