/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER_ID = '11111111-1111-1111-1111-111111111111'

const { createClientMock, createPublicClientMock, loadObservationSpeciesForEventsMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  loadObservationSpeciesForEventsMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
  createPublicClient: createPublicClientMock,
}))
vi.mock('@/lib/api/nature-observation-events', () => ({
  loadObservationSpeciesForEvents: loadObservationSpeciesForEventsMock,
}))

import { getUserWorks } from './data'

type Rows = {
  completions?: Record<string, unknown>[]
  submissions?: Record<string, unknown>[]
  observations?: Record<string, unknown>[]
}

/**
 * Supabase 的链式 builder 是 thenable，这里用同一个 Proxy 承接任意
 * select/eq/order/range/match 组合，最后 await 时才吐出对应表的数据。
 */
function queryFor(
  result: { data: unknown; error: null; count?: number },
  singleResult = result,
) {
  const builder: Record<string | symbol, unknown> = {
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
    maybeSingle: () => queryFor(singleResult),
    single: () => queryFor(singleResult),
  }
  return new Proxy(builder, {
    get(target, prop) {
      if (prop in target) return target[prop]
      return () => queryFor(result, singleResult)
    },
  })
}

function mockClient({ completions = [], submissions = [], observations = [] }: Rows) {
  const from = vi.fn((table: string) => {
    switch (table) {
      case 'completed_projects':
        return queryFor({ data: completions, error: null, count: completions.length })
      case 'challenge_submissions':
        return queryFor({ data: submissions, error: null, count: submissions.length })
      case 'observation_events':
        return queryFor({ data: observations, error: null, count: observations.length })
      case 'profiles': {
        const profile = { id: USER_ID, display_name: '小星', xp: 400 }
        return queryFor({ data: [profile], error: null }, { data: profile, error: null })
      }
      case 'projects':
        return queryFor({ data: [{ id: 3, title: '纸桥承重', image_url: null }], error: null })
      default:
        return queryFor({ data: [], error: null, count: 0 })
    }
  })
  const client = { from, rpc: vi.fn(() => queryFor({ data: [], error: null })) }
  createClientMock.mockResolvedValue(client)
  createPublicClientMock.mockReturnValue(client)
}

function completion(id: number, completedAt: string) {
  return {
    id,
    user_id: USER_ID,
    project_id: 3,
    course_lesson_id: null,
    completed_at: completedAt,
    proof_images: [`/work-${id}.jpg`],
    is_public: true,
    likes_count: 0,
    coins_count: 0,
    status: 'approved',
    record_kind: 'final',
  }
}

describe('getUserWorks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadObservationSpeciesForEventsMock.mockResolvedValue(new Map())
  })

  it('merges all four output paths into one list, newest first', async () => {
    mockClient({
      completions: [completion(1, '2026-08-01T00:00:00.000Z')],
      submissions: [{
        id: 5,
        user_id: USER_ID,
        challenge_id: 9,
        title: '会跑的纸盒车',
        notes: null,
        proof_images: ['/submission.jpg'],
        proof_captions: null,
        proof_video_url: null,
        is_public: true,
        status: 'approved',
        created_at: '2026-08-03T00:00:00.000Z',
        challenges: { id: 9, title: '八月造物挑战', image_url: null },
      }],
      observations: [{
        id: 7,
        user_id: USER_ID,
        observed_at: '2026-08-02T00:00:00.000Z',
        created_at: '2026-08-02T00:00:00.000Z',
        location_name: '玉渊潭公园',
        media_urls: ['/observation.jpg'],
        is_public: true,
        status: 'approved',
        likes_count: 3,
        comments_count: 1,
      }],
    })

    const { works, total } = await getUserWorks({ userId: USER_ID })

    expect(total).toBe(3)
    expect(works.map((work) => work.source?.type)).toEqual(['challenge', 'observation', 'project'])
  })

  it('links challenge and observation cards to their own detail pages', async () => {
    mockClient({
      submissions: [{
        id: 5,
        user_id: USER_ID,
        challenge_id: 9,
        title: '会跑的纸盒车',
        proof_images: [],
        is_public: true,
        status: 'approved',
        created_at: '2026-08-03T00:00:00.000Z',
        challenges: { id: 9, title: '八月造物挑战', image_url: null },
      }],
      observations: [{
        id: 7,
        user_id: USER_ID,
        observed_at: '2026-08-02T00:00:00.000Z',
        created_at: '2026-08-02T00:00:00.000Z',
        location_name: '玉渊潭公园',
        media_urls: [],
        is_public: true,
        status: 'approved',
      }],
    })

    const { works } = await getUserWorks({ userId: USER_ID })

    expect(works[0].source).toMatchObject({ href: '/pbl/9', challengeTitle: '八月造物挑战' })
    expect(works[1].source).toMatchObject({ href: '/nature/observations/7', title: '玉渊潭公园' })
  })

  it('names an observation after its identified species when there is one', async () => {
    loadObservationSpeciesForEventsMock.mockResolvedValue(new Map([[7, [{ commonName: '喜鹊' }]]]))
    mockClient({
      observations: [{
        id: 7,
        user_id: USER_ID,
        observed_at: '2026-08-02T00:00:00.000Z',
        created_at: '2026-08-02T00:00:00.000Z',
        location_name: '玉渊潭公园',
        media_urls: [],
        is_public: true,
        status: 'approved',
      }],
    })

    const { works } = await getUserWorks({ userId: USER_ID })

    expect(works[0].source).toMatchObject({ title: '喜鹊', locationName: '玉渊潭公园' })
  })

  it('paginates across the merged list', async () => {
    mockClient({
      completions: [
        completion(1, '2026-08-04T00:00:00.000Z'),
        completion(2, '2026-08-01T00:00:00.000Z'),
      ],
      observations: [{
        id: 7,
        user_id: USER_ID,
        observed_at: '2026-08-03T00:00:00.000Z',
        created_at: '2026-08-03T00:00:00.000Z',
        location_name: '玉渊潭公园',
        media_urls: [],
        is_public: true,
        status: 'approved',
      }],
    })

    const first = await getUserWorks({ userId: USER_ID, pageSize: 2 })
    expect(first.works.map((work) => work.id)).toEqual([1, 7])
    expect(first.hasMore).toBe(true)

    const second = await getUserWorks({ userId: USER_ID, page: 1, pageSize: 2 })
    expect(second.works.map((work) => work.id)).toEqual([2])
    expect(second.hasMore).toBe(false)
  })
})
