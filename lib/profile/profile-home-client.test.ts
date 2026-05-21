import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchProfileHomeData, invalidateProfileHomeData } from './profile-home-client'

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response
}

describe('fetchProfileHomeData', () => {
  beforeEach(() => {
    invalidateProfileHomeData('user-1')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/profile/summary')) {
          return Promise.resolve(
            jsonResponse({
              myProjects: [],
              myProjectsTotalCount: 0,
              followerCount: 0,
              followingCount: 0,
              totalLikesReceived: 0,
              radar: null,
            }),
          )
        }
        if (url.includes('/api/profile/timeline')) {
          return Promise.resolve(jsonResponse({ events: [] }))
        }
        if (url.includes('/api/profile/growth-tasks/sync')) {
          return Promise.resolve(jsonResponse({ tasks: [], graduatedAt: null }))
        }
        if (url.includes('/api/observations/mine')) {
          return Promise.resolve(jsonResponse({ observations: [], total: 0 }))
        }
        if (url.includes('/api/profile/study-checkin')) {
          return Promise.resolve(jsonResponse({ streakDays: 0 }))
        }
        if (url.includes('/api/profile/projects?type=exploring')) {
          return Promise.resolve(jsonResponse({
            projects: [
              { id: 1, title: '项目 1' },
              { id: 2, title: '项目 2' },
              { id: 3, title: '项目 3' },
              { id: 4, title: '项目 4' },
            ],
            explorations: [
              { projectId: 1, lastActivityAt: '2026-05-18T00:00:00.000Z' },
              { projectId: 2, lastActivityAt: '2026-05-17T00:00:00.000Z' },
            ],
          }))
        }
        return Promise.resolve(jsonResponse({}, false))
      }),
    )
  })

  afterEach(() => {
    invalidateProfileHomeData('user-1')
    vi.unstubAllGlobals()
  })

  it('dedupes concurrent loads for the same user', async () => {
    const fetchMock = vi.mocked(fetch)

    const [first, second] = await Promise.all([
      fetchProfileHomeData('user-1'),
      fetchProfileHomeData('user-1'),
    ])

    expect(first).toEqual(second)
    expect(first.exploringProjects.map((project) => project.id)).toEqual([1, 2, 3, 4])
    expect(first.exploringLastActivityByProjectId).toEqual({
      1: '2026-05-18T00:00:00.000Z',
      2: '2026-05-17T00:00:00.000Z',
    })
    expect(fetchMock).toHaveBeenCalledTimes(6)
  })
})
