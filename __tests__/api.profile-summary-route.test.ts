/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

import { GET } from '@/app/api/profile/summary/route'
import { requireAuth } from '@/lib/api/auth'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'
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

vi.mock('@/lib/profile/steam-radar', () => ({
  getSteamRadarWithGuidanceSafe: vi.fn(),
}))

describe('GET /api/profile/summary', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const requireAuthMock = requireAuth as Mock<typeof requireAuth>
  const getSteamRadarWithGuidanceSafeMock = getSteamRadarWithGuidanceSafe as Mock<
    typeof getSteamRadarWithGuidanceSafe
  >

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns summary data when radar is unavailable and sums likes directly from projects', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'projects') {
        return {
          select: vi.fn((fields: string) => {
            if (fields === '*, profiles:author_id (display_name)') {
              return {
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    range: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 101,
                          title: 'Bird Feeder',
                          author_id: 'user-1',
                          image_url: null,
                          category: '工程',
                          likes_count: 8,
                          description: 'Build a feeder',
                          created_at: '2026-04-01T00:00:00.000Z',
                          profiles: { display_name: '测试用户' },
                        },
                      ],
                      count: 1,
                      error: null,
                    }),
                  })),
                })),
              }
            }

            if (fields === 'likes_count') {
              return {
                eq: vi.fn().mockResolvedValue({
                  data: [{ likes_count: 2 }, { likes_count: null }, { likes_count: 3 }],
                  error: null,
                }),
              }
            }

            throw new Error(`Unexpected projects select: ${fields}`)
          }),
        }
      }

      if (table === 'follows') {
        return {
          select: vi.fn((fields: string) => ({
            eq: vi.fn().mockResolvedValue({
              count: fields === 'follower_id' ? 7 : 5,
              error: null,
            }),
          })),
        }
      }

      if (table === 'likes') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              count: 4,
              error: null,
            }),
          })),
        }
      }

      if (table === 'collections') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              count: 3,
              error: null,
            }),
          })),
        }
      }

      if (table === 'completed_projects') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { project_id: 201, status: 'approved', completed_at: '2026-04-01T00:00:00.000Z' },
                  { project_id: 202, status: 'rejected', completed_at: '2026-03-30T00:00:00.000Z' },
                ],
                error: null,
              }),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    })

    createClientMock.mockResolvedValue({ from } as never)
    requireAuthMock.mockResolvedValue({ id: 'user-1' } as never)
    getSteamRadarWithGuidanceSafeMock.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      myProjects: [
        {
          id: 101,
          title: 'Bird Feeder',
          author: '测试用户',
          author_id: 'user-1',
          image: '',
          category: '工程',
          likes: 8,
          description: 'Build a feeder',
          status: undefined,
          difficulty: undefined,
          tags: [],
        },
      ],
      myProjectsTotalCount: 1,
      followerCount: 7,
      followingCount: 5,
      likedProjectsCount: 4,
      collectedProjectsCount: 3,
      completedProjectsCount: 1,
      totalLikesReceived: 5,
      radar: null,
    })
  })
})
