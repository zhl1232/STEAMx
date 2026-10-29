import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchProfileHomeData, invalidateProfileHomeData, mergeProfileHomeData, type ProfileHomeSection } from './profile-home-client'

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
              myWorks: [{ id: 'work-1', title: '桥梁作品' }],
              myWorksTotalCount: 7,
              followerCount: 12,
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

  const optionalSections: [ProfileHomeSection, string][] = [
    ['timeline', '/api/profile/timeline'],
    ['growthTasks', '/api/profile/growth-tasks/sync'],
    ['observations', '/api/observations/mine'],
    ['studyCheckIn', '/api/profile/study-checkin'],
    ['exploringProjects', '/api/profile/projects?type=exploring'],
  ]

  describe.each(['network', 'http', 'json'] as const)('%s failure isolation', (failureKind) => {
    it.each(optionalSections)('keeps profile outcomes when %s is unavailable', async (section, failedUrl) => {
      const normalFetch = vi.mocked(fetch).getMockImplementation()!
      vi.mocked(fetch).mockImplementation((input, init) => {
        if (!String(input).includes(failedUrl)) return normalFetch(input, init)
        if (failureKind === 'network') return Promise.reject(new Error('Network unavailable'))
        if (failureKind === 'http') return Promise.resolve(jsonResponse({ error: 'Unavailable' }, false))
        return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Invalid JSON')) } as Response)
      })

      const data = await fetchProfileHomeData('user-1')

      expect(data.failedSections).toEqual([section])
      expect(data.myWorksTotalCount).toBe(7)
      expect(data.myWorks).toEqual([{ id: 'work-1', title: '桥梁作品' }])
      expect(data.followerCount).toBe(12)
      if (section === 'studyCheckIn') expect(data.studyCheckInSummary).toBeNull()
      else expect(data.studyCheckInSummary).toEqual({ streakDays: 0 })
    })
  })

  const sectionFields = {
    timeline: ['profileTimelineEvents'],
    growthTasks: ['growthTasks', 'growthTasksGraduatedAt'],
    observations: ['myObservations', 'observationsTotal'],
    studyCheckIn: ['studyCheckInSummary'],
    exploringProjects: ['exploringProjects', 'exploringLastActivityByProjectId'],
  } as const

  it.each(optionalSections)('preserves cached %s values after a failed refresh and replaces them after recovery', async (section, failedUrl) => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!
    const priorPayload = {
      events: [{ id: 'prior-event' }],
      tasks: [{ id: 'prior-task' }],
      graduatedAt: '2026-10-20T12:00:00Z',
      observations: [{ id: 91 }],
      total: 8,
      streakDays: 5,
      projects: [{ id: 92 }],
      explorations: [{ projectId: 92, lastActivityAt: '2026-10-20T12:00:00Z' }],
    }
    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes(failedUrl)
      ? Promise.resolve(jsonResponse(priorPayload))
      : normalFetch(input, init))
    const previous = await fetchProfileHomeData('user-1')

    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).includes(failedUrl)) return Promise.reject(new Error('Offline'))
      if (String(input).includes('/api/profile/summary')) return Promise.resolve(jsonResponse({ myWorksTotalCount: 99 }))
      return normalFetch(input, init)
    })
    const partial = await fetchProfileHomeData('user-1')
    const retained = mergeProfileHomeData(previous, partial)

    expect(retained.failedSections).toEqual([section])
    expect(retained.myWorksTotalCount).toBe(99)
    for (const field of sectionFields[section]) expect(retained[field]).toEqual(previous[field])
    expect(mergeProfileHomeData(undefined, partial)).toBe(partial)

    vi.mocked(fetch).mockImplementation(normalFetch)
    const recovered = await fetchProfileHomeData('user-1')
    const refreshed = mergeProfileHomeData(retained, recovered)

    expect(refreshed.failedSections).toEqual([])
    expect(refreshed).toEqual(recovered)
    for (const field of sectionFields[section]) expect(refreshed[field]).not.toEqual(previous[field])
  })

  it('rejects when the outcome summary fails instead of showing zero outcomes', async () => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes('/api/profile/summary')
      ? Promise.resolve(jsonResponse({ error: '摘要暂不可用' }, false))
      : normalFetch(input, init))

    await expect(fetchProfileHomeData('user-1')).rejects.toThrow('摘要暂不可用')
  })

  it.each(['invalid-json', 'null', 'array', 'string'] as const)('rejects a malformed summary: %s', async (kind) => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (!String(input).includes('/api/profile/summary')) return normalFetch(input, init)
      if (kind === 'invalid-json') {
        return Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('Invalid JSON')) } as Response)
      }
      return Promise.resolve(jsonResponse(kind === 'null' ? null : kind === 'array' ? [] : 'invalid'))
    })

    await expect(fetchProfileHomeData('user-1')).rejects.toThrow('个人主页摘要加载失败，请重试')
  })

  it('reloads a failed section on the next request', async () => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes('/api/profile/study-checkin')
      ? Promise.reject(new Error('Offline'))
      : normalFetch(input, init))
    expect((await fetchProfileHomeData('user-1')).failedSections).toEqual(['studyCheckIn'])

    vi.mocked(fetch).mockImplementation(normalFetch)
    const recovered = await fetchProfileHomeData('user-1')

    expect(recovered.failedSections).toEqual([])
    expect(recovered.studyCheckInSummary).toEqual({ streakDays: 0 })
  })

  it('allows a fresh request after summary failure', async () => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation((input, init) => String(input).includes('/api/profile/summary')
      ? Promise.reject(new Error('Offline'))
      : normalFetch(input, init))
    await expect(fetchProfileHomeData('user-1')).rejects.toThrow('Offline')

    vi.mocked(fetch).mockImplementation(normalFetch)

    expect((await fetchProfileHomeData('user-1')).myWorksTotalCount).toBe(7)
  })

})
