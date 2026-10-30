import { describe, expect, it, vi } from 'vitest'
import { getProjects } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import sources from '@/lib/project/source-tutorials.data.json'
import { buildRecommendationShuffleSeed, sortByRecommendationShuffleSeed } from '@/lib/recommendations/seed'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/testing/playwright-smoke', () => ({ isPlaywrightSmoke: () => false }))
vi.mock('@/lib/content-classification', async original => ({
  ...await original<typeof import('@/lib/content-classification')>(),
  getContentClassificationSettings: async () => ({ publicV1Enabled: false, enforcementEnabled: false }),
}))

function fixture(ordinaryCount = 2) {
  const rows = sources.slice(0, 5).map(entry => ({
    id: entry.id, title: entry.title, category: entry.category,
    description: entry.baseline.description, image_url: entry.baseline.covers[0], video_url: null as string | null,
    status: 'approved', moderation_state: 'approved', likes_count: 0,
    image_materials: entry.baseline.materials.map((material, sort_order) => ({ material, sort_order })),
    image_steps: entry.baseline.steps.map((step, sort_order) => ({ ...step, sort_order })),
    project_materials: [{ material: '纸', sort_order: 0 }],
  }))
  rows[1].image_url = '/uploads/manual-cover.jpg'
  rows[2].description = '人工修改后的正文'
  rows[3].video_url = 'https://example.test/new.mp4'
  rows.push(...Array.from({ length: ordinaryCount }, (_, index) => ({ ...structuredClone(rows[1]), id: 99000 + index, title: '普通项目' + index })))
  // Reverse lifetime-like row order. One source has no weekly events; the other ranks last.
  const excluded = new Set([rows[0].id, rows[4].id])
  const popular = [...rows].reverse().map(row => row.id)
  const weekly = popular.filter(id => id !== rows[4].id && id !== rows.at(-1)!.id)
  const hydrated: number[][] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
    if (!name.includes('rankings')) return { data: [], error: null }
    const ranking = name.includes('weekly') ? weekly : popular
    const offset = Number(args.p_offset)
    return { data: ranking.slice(offset, offset + Number(args.p_limit)).map(project_id => ({ project_id, total_count: ranking.length })), error: null }
  })
  vi.mocked(createClient).mockResolvedValue({
    rpc,
    from: () => {
      let selectedIds: number[] | undefined
      let skipped: number[] = []
      let range: [number, number] | undefined
      let publicFilter = false
      const query: Record<string, unknown> = {
        select: () => query,
        eq: () => { publicFilter = true; return query },
        order: () => query,
        in: (column: string, ids: number[]) => { if (column === 'id') selectedIds = ids; return query },
        not: (column: string, operator: string, value: string) => {
          expect([column, operator]).toEqual(['id', 'in'])
          skipped = value.slice(1, -1).split(',').map(Number)
          expect(new Set(skipped)).toEqual(excluded)
          return query
        },
        range: (from: number, to: number) => { range = [from, to]; return query },
        then: (resolve: (result: unknown) => unknown) => {
          if (selectedIds && publicFilter) hydrated.push(selectedIds)
          const matching = rows.filter(row => (!selectedIds || selectedIds.includes(row.id)) && !skipped.includes(row.id))
          return Promise.resolve({ data: range ? matching.slice(range[0], range[1] + 1) : matching, count: matching.length, error: null }).then(resolve)
        },
      }
      return query
    },
  } as never)
  return { rows, excluded, popular, weekly, rpc, hydrated }
}

describe('source tutorial material eligibility pagination', () => {
  it('preserves ranking across pages with exact totals and concurrent-edit opt-outs', async () => {
    const { rows, excluded, popular, weekly, rpc } = fixture()
    for (const sortBy of ['latest', 'popular', 'weekly'] as const) {
      const expected = (sortBy === 'latest' ? rows.map(row => row.id) : sortBy === 'popular' ? popular : weekly).filter(id => !excluded.has(id))
      const pages = []
      for (let page = 0; page < 3; page++) pages.push(await getProjects({ materials: ['纸'] }, { sortBy, pageSize: 2, page }))
      expect(pages.map(page => page.total)).toEqual(Array(3).fill(expected.length))
      expect(pages.map(page => page.hasMore)).toEqual([2, 4, 6].map(end => end < expected.length))
      expect(pages.flatMap(page => page.projects.map(project => Number(project.id)))).toEqual(expected)
    }
    const calls = rpc.mock.calls.filter(([name]) => name.includes('weekly_hot'))
    expect(calls.length).toBeGreaterThan(0)
    for (const [, args] of calls) {
      expect(args?.p_materials).toEqual(['纸'])
      expect(Date.now() - Date.parse(String(args?.p_since))).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -4)
    }
  })

  it('scans weekly membership in capped batches, counts tail exclusions and hydrates only its page', async () => {
    const { weekly, excluded, rpc, hydrated } = fixture(205)
    const expected = weekly.filter(id => !excluded.has(id))
    const result = await getProjects({ materials: ['纸'] }, { sortBy: 'weekly', pageSize: 2, page: 100 })
    expect(result.total).toBe(expected.length)
    expect(result.projects.map(project => Number(project.id))).toEqual(expected.slice(200, 202))
    expect(result.hasMore).toBe(true)
    const calls = rpc.mock.calls.filter(([name]) => name.includes('weekly_hot'))
    expect(calls.map(([, args]) => args?.p_offset)).toEqual([0, 200])
    expect(calls.every(([, args]) => Number(args?.p_limit) <= 200)).toBe(true)
    expect(new Set(calls.map(([, args]) => args?.p_since)).size).toBe(1)
    expect(hydrated).toEqual([expected.slice(200, 202)])
  })

  it('shuffles only the selected popular page using the existing viewer seed', async () => {
    const { popular, excluded } = fixture()
    const expectedPage = popular.filter(id => !excluded.has(id)).slice(0, 3)
    const result = await getProjects({ materials: ['纸'] }, { sortBy: 'popular', pageSize: 3, shuffleSeed: 'viewer', shuffleBatch: 2 })
    expect(result.projects.map(project => Number(project.id))).toEqual(
      sortByRecommendationShuffleSeed(expectedPage, buildRecommendationShuffleSeed('viewer', 2)),
    )
  })
})
