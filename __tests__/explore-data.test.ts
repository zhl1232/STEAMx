/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  dedupeCompletionRowsByUser,
  diversifyPopularByCategoryForTest,
  getProjectTotalCoinsReceived,
  shouldBlendPopularExplore,
} from '@/lib/api/explore-data'
import {
  buildRecommendationShuffleSeed,
  sortByRecommendationShuffleSeed,
} from '@/lib/recommendations/seed'
import { createClient } from '@/lib/supabase/server'
import { callRpc } from '@/lib/supabase/rpc'

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
