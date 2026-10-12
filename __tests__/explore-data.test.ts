/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  dedupeCompletionRowsByUser,
  diversifyPopularByCategoryForTest,
  getProjectTotalCoinsReceived,
  getProjectExplorationRecordsCount,
  getProjects,
  rankTagsByPopularity,
  buildTagScope,
  shouldBlendPopularExplore,
} from '@/lib/api/explore-data'
import {
  buildRecommendationShuffleSeed,
  sortByRecommendationShuffleSeed,
} from '@/lib/recommendations/seed'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/rpc', () => ({
  callRpc: vi.fn(),
}))

vi.mock('@/lib/testing/playwright-smoke', () => ({
  isPlaywrightSmoke: vi.fn(() => false),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

vi.mock('@/lib/content-classification', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/content-classification')>()
  return { ...actual, getContentClassificationSettings: vi.fn(async () => ({ publicV1Enabled: false, enforcementEnabled: false })) }
})

it('counts only public records approved by both review gates, excluding drafts, pending and rejected records', async () => {
  const rows = [
    {is_public:false, status:'draft', moderation_state:'approved'},
    {is_public:true, status:'pending', moderation_state:'approved'},
    {is_public:true, status:'rejected', moderation_state:'rejected'},
    {is_public:true, status:'approved', moderation_state:'pending'},
    {is_public:false, status:'approved', moderation_state:'approved'},
    {is_public:true, status:'approved', moderation_state:'approved'},
  ].map(row => ({project_id:149, ...row}))
  const filters: Array<[string, unknown]> = []
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => { filters.push([key,value]); return query },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({
      count: rows.filter(row => filters.every(([key,value]) => row[key as keyof typeof row] === value)).length,
      error: null,
    }).then(resolve),
  }
  vi.mocked(createClient).mockResolvedValue({from: () => query} as never)
  expect(await getProjectExplorationRecordsCount(149)).toBe(1)
})

describe('diversifyPopularByCategoryForTest', () => {
  it('still interleaves categories when targetLen equals the full pool size', () => {
    const rows = [
      { id: 1, category: '科学' },
      { id: 2, category: '科学' },
      { id: 3, category: '科学' },
      { id: 4, category: '技术' },
      { id: 5, category: '工程' },
      { id: 6, category: '艺术' },
      { id: 7, category: '数学' },
      { id: 8, category: '科学' },
    ]

    const diversified = diversifyPopularByCategoryForTest(rows, rows.length)
    const firstBatch = diversified.slice(0, 5).map((row) => row.category)

    expect(new Set(firstBatch).size).toBeGreaterThan(1)
    expect(firstBatch).toEqual(['科学', '技术', '工程', '艺术', '数学'])
  })

  it('keeps categories interleaved when shuffle runs before diversify (explore for-you regression)', () => {
    // 模拟用户报告的「全是数学」场景：popular 池里数学项目占主导，
    // 且按 hash 全局打乱后 id 顺序仍倾向于某一类聚集。
    const pool = [
      { id: 101, category: '数学' },
      { id: 102, category: '数学' },
      { id: 103, category: '数学' },
      { id: 104, category: '数学' },
      { id: 105, category: '数学' },
      { id: 106, category: '科学' },
      { id: 107, category: '技术' },
      { id: 108, category: '工程' },
      { id: 109, category: '艺术' },
      { id: 110, category: '科学' },
      { id: 111, category: '技术' },
    ]

    // 多个 viewer/日期 seed 组合都应该保持类别交错。
    const seeds = [
      buildRecommendationShuffleSeed('viewer-a', 0, '2026-05-22'),
      buildRecommendationShuffleSeed('viewer-b', 0, '2026-05-22'),
      buildRecommendationShuffleSeed('viewer-c', 1, '2026-05-23'),
    ]

    for (const seed of seeds) {
      const shuffled = sortByRecommendationShuffleSeed(pool, seed, (row) => row.id)
      const diversified = diversifyPopularByCategoryForTest(shuffled, shuffled.length)
      const firstFive = diversified.slice(0, 5).map((row) => row.category)

      expect(new Set(firstFive)).toEqual(new Set(['科学', '技术', '工程', '艺术', '数学']))
    }
  })
})

describe('getProjectTotalCoinsReceived', () => {
  const createClientMock = createClient as Mock<typeof createClient>
  const callRpcMock = callRpc as Mock<typeof callRpc>

  beforeEach(() => {
    vi.clearAllMocks()
    createClientMock.mockResolvedValue({} as never)
  })

  it('returns the RPC total instead of the base project coins count', async () => {
    callRpcMock.mockResolvedValue({
      data: 9,
      error: null,
    })

    await expect(getProjectTotalCoinsReceived(42, 2)).resolves.toBe(9)
    expect(callRpcMock).toHaveBeenCalledWith(
      expect.anything(),
      'get_project_total_coins_received',
      { p_project_id: 42 },
    )
  })

  it('falls back to the base project coins count when the RPC fails', async () => {
    callRpcMock.mockResolvedValue({
      data: null,
      error: new Error('rpc failed'),
    })

    await expect(getProjectTotalCoinsReceived(42, 2)).resolves.toBe(2)
  })
})

describe('shouldBlendPopularExplore', () => {
  const popularPage0 = { page: 0, sortBy: 'popular' as const }

  it('enables blend for the beginner-friendly preset (difficulty=1-2 + popular)', () => {
    // 防止有人再把 difficulty 列入「关闭 blend」的条件，让「新手推荐」回到单类聚集。
    expect(shouldBlendPopularExplore({ difficulty: '1-2' }, popularPage0)).toBe(true)
  })

  it('still keeps blend on for the default browse view (no filters)', () => {
    expect(shouldBlendPopularExplore({}, popularPage0)).toBe(true)
  })

  it('disables blend when a single category is selected (single-category intent)', () => {
    expect(shouldBlendPopularExplore({ category: '数学' }, popularPage0)).toBe(false)
  })

  it('disables blend for tag/search/material filters (single-topic intent)', () => {
    expect(shouldBlendPopularExplore({ tags: ['物理'] }, popularPage0)).toBe(false)
    expect(shouldBlendPopularExplore({ searchQuery: 'arduino' }, popularPage0)).toBe(false)
    expect(shouldBlendPopularExplore({ materials: ['纸板'] }, popularPage0)).toBe(false)
  })
})

describe('dedupeCompletionRowsByUser', () => {
  it('keeps only the latest row per user_id in encounter order', () => {
    const rows = [
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 3, user_id: 'a' },
      { id: 4, user_id: 'c' },
    ]

    expect(dedupeCompletionRowsByUser(rows, 8)).toEqual([
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 4, user_id: 'c' },
    ])
  })

  it('respects the limit after deduplication', () => {
    const rows = [
      { id: 1, user_id: 'a' },
      { id: 2, user_id: 'b' },
      { id: 3, user_id: 'c' },
    ]

    expect(dedupeCompletionRowsByUser(rows, 2)).toHaveLength(2)
    expect(dedupeCompletionRowsByUser(rows, 2).map((row) => row.user_id)).toEqual(['a', 'b'])
  })
})


describe('getProjects strict errors', () => {
  beforeEach(() => vi.clearAllMocks())

  function failedQuery() {
    const query = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), range: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'offline' }, count: null }).then(resolve),
    }
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => query) } as never)
  }

  it('preserves soft failures for existing callers but throws in strict latest mode', async () => {
    failedQuery()
    await expect(getProjects({}, { sortBy: 'latest' })).resolves.toEqual({ projects: [], total: 0, hasMore: false })
    await expect(getProjects({}, { sortBy: 'latest', strictErrors: true })).rejects.toThrow('Unable to load explore projects')
  })

  it.each(['popular', 'weekly'] as const)('throws on %s ranking failure in strict mode', async (sortBy) => {
    failedQuery()
    vi.mocked(callRpc).mockResolvedValue({ data: null, error: { message: 'offline' } } as never)
    await expect(getProjects({}, { sortBy, page: 1, strictErrors: true })).rejects.toThrow('Unable to load explore projects')
  })

  it('throws when ranking succeeds but hydration fails', async () => {
    failedQuery()
    vi.mocked(callRpc).mockResolvedValue({ data: [{ project_id: 1, total_count: 1 }], error: null } as never)
    await expect(getProjects({}, { sortBy: 'popular', page: 1, strictErrors: true })).rejects.toThrow('Unable to load explore projects')
  })

  it('throws on a failed blended ranking query instead of returning an empty pool', async () => {
    failedQuery()
    vi.mocked(callRpc).mockResolvedValue({ data: null, error: { message: 'offline' } } as never)
    await expect(getProjects({}, { sortBy: 'popular', page: 0, blendPopular: true, strictErrors: true })).rejects.toThrow('Unable to load explore projects')
  })
})

describe('explore tag options', () => {
  const entries = [
    { category: '科学', subCategory: '物理', tags: ['科教版', '幼儿园中班', '二年级', '初中', '平衡', '科学', 'kejiao16a-src:1'] },
    { category: '工程', subCategory: '结构', tags: ['高中', '高一', '小班', '九年级', '平衡', '搭建'] },
    { category: '艺术', tags: ['科教版', '大班'] },
    { tags: null },
  ]
  it('ranks only public options by project popularity', () => {
    expect(rankTagsByPopularity(entries, new Set(['科学']))).toEqual(['平衡', '搭建'])
  })
  it('excludes hidden labels from all category and subcategory scopes', () => {
    const scope = buildTagScope(entries, new Set(['科学']))
    expect(scope.all).toEqual(expect.arrayContaining(['平衡', '搭建']))
    expect(scope.all).toHaveLength(2)
    expect(scope.byCategory).toEqual({ 科学: ['平衡'], 工程: scope.bySubCategory.结构 })
    expect(scope.bySubCategory.物理).toEqual(['平衡'])
    expect(scope.bySubCategory.结构).toHaveLength(2)
  })
})
