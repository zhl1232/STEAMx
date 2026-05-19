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
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})
