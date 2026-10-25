/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  dedupeCompletionRowsByUser,
  diversifyPopularByCategoryForTest,
  getProjectTotalCoinsReceived,
  getProjectExplorationRecordsCount,
  getProjects,
  getProjectById,
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
import { isPlaywrightSmoke } from '@/lib/testing/playwright-smoke'
import { getScienceSample } from '@/lib/project/science-samples'
import { getContentClassificationSettings } from '@/lib/content-classification'
import { HOUSEHOLD_PROJECT_IDS } from '@/lib/explore/household-projects'
import { sortProjectsByMaterials } from '@/lib/explore/material-matching'
import { resolveProjectMaterials } from '@/lib/project/materials'
import needleSource from '@/__tests__/fixtures/household-source-509.json'
import caterpillarSource from '@/__tests__/fixtures/household-source-722.json'

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

describe('everyday materials local preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPlaywrightSmoke).mockReturnValue(true)
  })
  afterEach(() => vi.mocked(isPlaywrightSmoke).mockReturnValue(false))

  it('keeps the ordinary smoke list unchanged and loads cross-category examples only for the materials tag', async () => {
    const ordinary = await getProjects()
    expect(ordinary.projects.map((project) => project.id).sort()).toEqual([101, 102, 103])
    const preview = await getProjects({ tags: ['日常材料'] })
    expect(new Set(preview.projects.map((project) => project.category))).toEqual(new Set(['科学', '工程', '艺术']))
    expect(preview.projects.every((project) => project.tags?.includes('日常材料'))).toBe(true)
    const science = preview.projects.find((project) => project.id === 738)!
    expect(science.materials).toEqual(getScienceSample(738)!.materials)
    expect(science.materials).toContain('浅盘1个')
    expect((await getProjectById(738))?.materials).toEqual(science.materials)
    expect(await getProjectById(999999)).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns the whole local cohort for material ranking and keeps additional filters', async () => {
    const first = await getProjects({ tags: ['日常材料'] }, { page: 0, pageSize: 2 })
    const second = await getProjects({ tags: ['日常材料'] }, { page: 1, pageSize: 2 })
    expect(first.total).toBe(5)
    expect(first.hasMore).toBe(false)
    expect(first.projects).toHaveLength(5)
    expect(second.projects).toEqual([])
    const art = await getProjects({ tags: ['日常材料'], category: '艺术' })
    expect(art.projects.map((project) => project.id)).toEqual([103])
    const empty = await getProjects({ tags: ['日常材料'], searchQuery: '不存在的项目' })
    expect(empty).toEqual({ projects: [], total: 0, hasMore: false })
  })
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

describe('production everyday materials cohort', () => {
  const fixtureIds = HOUSEHOLD_PROJECT_IDS.filter((id) => getScienceSample(id) !== null)
  function projectRow(id: number) {
    return {
      id,
      title: getScienceSample(id)!.title,
      category: '科学',
      description: '数据库简略内容',
      author_id: 'author',
      image_url: '/project.webp',
      likes_count: 0,
      status: 'approved',
      moderation_state: 'approved',
      classification_status: 'reviewed',
      classification_source: 'manual',
      classification_reviewed_at: '2026-10-20T00:00:00Z',
      classification_reviewed_by: 'reviewer',
      recommended_min_age: 8,
      recommended_max_age: 12,
      support_level: 'independent',
      difficulty: 'easy',
      difficulty_stars: 2,
      tags: ['实验'],
      sub_categories: { name: '物理' },
      project_materials: [
        { material: '数据库过期材料', sort_order: 1 },
        { material: '数据库原始筛选材料', sort_order: 0 },
      ],
      project_steps: [{ title: '原始步骤', description: '数据库中旧的说明。', sort_order: 0 }],
    }
  }

  type Row = ReturnType<typeof projectRow>
  let rows: Row[]
  let queryError: Error | null
  let completionError: Error | null
  let queries: Array<{ select: string; operations: Array<[string, string, unknown]> }>
  const rpc = vi.fn()

  function installDatabase() {
    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        expect(table).toBe('projects')
        const trace = { select: '', operations: [] as Array<[string, string, unknown]> }
        queries.push(trace)
        const predicates: Array<(row: Row) => boolean> = []
        function value(row: Row, key: string): unknown {
          if (key === 'sub_categories.name') return row.sub_categories.name
          return row[key as keyof Row]
        }
        function result() {
          return { data: rows.filter((row) => predicates.every((predicate) => predicate(row))), error: queryError, count: rows.length }
        }
        const query = {
          select: (selection: string) => { trace.select = selection; return query },
          eq: (key: string, expected: unknown) => {
            trace.operations.push(['eq', key, expected])
            predicates.push((row) => value(row, key) === expected)
            return query
          },
          in: (key: string, expected: unknown[]) => {
            trace.operations.push(['in', key, expected])
            predicates.push((row) => key === 'material_filter.material'
              ? row.project_materials.some((material) => expected.includes(material.material))
              : expected.includes(value(row, key)))
            return query
          },
          contains: (key: string, expected: string[]) => {
            trace.operations.push(['contains', key, expected])
            predicates.push((row) => expected.every((entry) => (value(row, key) as string[]).includes(entry)))
            return query
          },
          gte: (key: string, expected: number) => {
            predicates.push((row) => Number(value(row, key)) >= expected)
            return query
          },
          lte: (key: string, expected: number) => {
            predicates.push((row) => Number(value(row, key)) <= expected)
            return query
          },
          or: (expression: string) => {
            trace.operations.push(['or', '', expression])
            const keyword = expression.match(/title\.ilike\.%(.+)%/u)?.[1]?.split('%,')[0] ?? ''
            predicates.push((row) => `${row.title} ${row.description}`.includes(keyword))
            return query
          },
          order: () => query,
          range: () => query,
          maybeSingle: async () => ({ ...result(), data: result().data[0] ?? null }),
          then: (resolve: (payload: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
        }
        return query
      }),
      rpc,
    } as never)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isPlaywrightSmoke).mockReturnValue(false)
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ publicV1Enabled: false, enforcementEnabled: false })
    rows = [...fixtureIds].reverse().map(projectRow)
    queryError = null
    completionError = null
    queries = []
    rpc.mockImplementation(async (_name: string, args: { p_project_ids: number[] }) => ({
      data: args.p_project_ids.map((id) => ({ project_id: id, completion_count: 7 })),
      error: completionError,
    }))
    installDatabase()
  })

  afterEach(() => {
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ publicV1Enabled: false, enforcementEnabled: false })
  })

  it('uses the effective detail materials despite stale compact DB rows and returns compact cards', async () => {
    const cohort = await getProjects({ tags: ['日常材料'] })
    expect(cohort.projects).toHaveLength(fixtureIds.length)
    const card = cohort.projects.find((project) => project.id === 738)!
    const detail = await getProjectById(738)
    expect(detail).not.toBeNull()
    expect(card.materials).toEqual(resolveProjectMaterials(detail!).materials)
    expect(card.materials).toContain('浅盘1个')
    expect(card.materials).not.toContain('数据库过期材料')
    expect(card).not.toHaveProperty('steps')
    expect(card).not.toHaveProperty('reflection')
    expect(card).not.toHaveProperty('faq')
    expect(card).not.toHaveProperty('classification')
    expect(card.completions_count).toBe(7)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('get_project_completion_counts_batch', { p_project_ids: cohort.projects.map((project) => project.id) })
    expect(callRpc).not.toHaveBeenCalled()
  })

  it.each(['popular', 'weekly', 'latest'] as const)('returns every candidate before %s pagination and ignores age ranking', async (sortBy) => {
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ publicV1Enabled: true, enforcementEnabled: false })
    // Only one candidate matches this age; material requirements must still lead.
    rows[0].recommended_min_age = 14
    rows[0].recommended_max_age = 16
    const first = await getProjects({ tags: ['日常材料'], age: 16 }, { pageSize: 2, sortBy })
    expect(first.total).toBe(fixtureIds.length)
    expect(first.projects).toHaveLength(fixtureIds.length)
    expect(first.projects.every((project) => project.classification?.status === 'reviewed')).toBe(true)
    expect(first.hasMore).toBe(false)
    expect(first.projects.map((project) => project.id)).toEqual(sortProjectsByMaterials(
      [...first.projects].sort((left, right) => Number(left.id) - Number(right.id)), [],
    ).map((project) => project.id))
    expect(await getProjects({ tags: ['日常材料'] }, { page: 1, pageSize: 2, sortBy })).toEqual({
      projects: [], total: fixtureIds.length, hasMore: false,
    })
    expect(callRpc).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(queries.every((query) => query.operations.some(([op, key, ids]) => op === 'in' && key === 'id' && Array.isArray(ids) && ids.length <= 50))).toBe(true)
  })

  it('enforces both publication gates and the enabled classification gate', async () => {
    rows[0].status = 'pending'
    rows[1].moderation_state = 'hidden'
    rows[2].classification_status = 'pending'
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ publicV1Enabled: true, enforcementEnabled: true })
    const result = await getProjects({ tags: ['日常材料'] })
    expect(result.total).toBe(fixtureIds.length - 3)
    expect(result.projects.some((project) => rows.slice(0, 3).some((row) => row.id === project.id))).toBe(false)
    expect(queries[0].operations).toEqual(expect.arrayContaining([
      ['eq', 'status', 'approved'], ['eq', 'moderation_state', 'approved'], ['eq', 'classification_status', 'reviewed'],
    ]))
  })

  it('excludes changed identities and IDs outside the reviewed cohort', async () => {
    rows[0].title = '不同的项目'
    rows[1].category = '艺术'
    rows.push({ ...projectRow(738), id: 999999 })
    const result = await getProjects({ tags: ['日常材料'] })
    expect(result.total).toBe(fixtureIds.length - 2)
    expect(result.projects.some((project) => [rows[0].id, rows[1].id, 999999].includes(Number(project.id)))).toBe(false)
  })

  it('treats the cohort tag as virtual while retaining ordinary filters and full material joins', async () => {
    const result = await getProjects({
      tags: ['日常材料', '实验'], category: '科学', subCategory: '物理', difficulty: '1-2',
      searchQuery: getScienceSample(738)!.title, materials: ['数据库原始筛选材料'],
    })
    expect(result.projects.map((project) => project.id)).toEqual([738])
    expect(result.projects[0].materials).toEqual(resolveProjectMaterials((await getProjectById(738))!).materials)
    expect(queries[0].select).toContain('project_materials (*)')
    expect(queries[0].select).toContain('project_steps (*)')
    expect(queries[0].select).toContain('material_filter:project_materials!inner (material)')
    expect(queries[0].operations).toEqual(expect.arrayContaining([
      ['contains', 'tags', ['实验']], ['eq', 'category', '科学'], ['eq', 'sub_categories.name', '物理'],
      ['in', 'material_filter.material', ['数据库原始筛选材料']],
    ]))
    expect(queries[0].operations.some(([operation]) => operation === 'or')).toBe(false)
    expect(await getProjects({ tags: ['日常材料', '缺失标签'] })).toEqual({ projects: [], total: 0, hasMore: false })
    expect((await getProjects({ tags: ['日常材料'], category: '艺术' })).total).toBe(0)
    expect((await getProjects({ tags: ['日常材料'], difficulty: '5-6' })).total).toBe(0)
    expect((await getProjects({ tags: ['日常材料'], subCategory: '化学' })).total).toBe(0)
    expect((await getProjects({ tags: ['日常材料'], materials: ['不存在'] })).total).toBe(0)
  })

  it('searches the revised visible description when the database description is stale', async () => {
    const result = await getProjects({ tags: ['日常材料'], searchQuery: '彩色笔迹' })
    expect(result.projects.map((project) => project.id)).toContain(738)
    expect(result.projects.find((project) => project.id === 738)?.description).toContain('彩色笔迹')
    expect(rows.find((row) => row.id === 738)?.description).not.toContain('彩色笔迹')
    expect(queries[0].operations.some(([operation]) => operation === 'or')).toBe(false)
  })

  it('corrects legacy needle details without accepting the outdated material matching profile', async () => {
    rows.push({
      ...projectRow(738), ...needleSource,
      sub_categories: { name: '物理' },
      project_materials: needleSource.materials.map((material, sort_order) => ({ material, sort_order })),
      project_steps: needleSource.steps.map((step, sort_order) => ({ ...step, sort_order })),
    })
    const result = await getProjects({ tags: ['日常材料'], searchQuery: '漂浮的针' })
    expect(result.projects).toEqual([])
    const detail = await getProjectById(509)
    expect(detail?.materials).toContain('清水')
    expect(detail?.steps).toEqual(needleSource.steps)
    expect(needleSource.materials).not.toContain('清水')
  })

  it('uses the same source-verified correction for raw database cards and details', async () => {
    const row = {
      ...projectRow(738), ...caterpillarSource,
      video_url: caterpillarSource.videoUrl,
      sub_categories: { name: '物理' },
      project_materials: caterpillarSource.materials.map((material, sort_order) => ({ material, sort_order })),
      project_steps: caterpillarSource.steps.map((step, sort_order) => ({ ...step, sort_order })),
    }
    rows.push(row)
    const result = await getProjects({ tags: ['日常材料'], searchQuery: '毛毛虫大赛' })
    expect(result.projects.map((project) => project.id)).toEqual([722])
    const detail = await getProjectById(722)
    expect(detail?.materials).toEqual(['A4白纸1张', '剪刀1把', '塑料吸管', '彩色笔'])
    expect(detail?.steps?.[0].title).toBe('裁出窄纸条')
    expect(result.projects[0].materials).toEqual(resolveProjectMaterials(detail!).materials)
    expect(result.projects[0].householdRequirements).toContainEqual(['paper'])
  })

  it('does not match text that exists only in the stale database description', async () => {
    expect(await getProjects({ tags: ['日常材料'], searchQuery: '数据库简略内容' })).toEqual({
      projects: [], total: 0, hasMore: false,
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propagates candidate DB errors in strict mode and returns an empty cohort otherwise', async () => {
    queryError = new Error('database unavailable')
    await expect(getProjects({ tags: ['日常材料'] }, { strictErrors: true })).rejects.toThrow('Unable to load explore projects')
    expect(await getProjects({ tags: ['日常材料'] })).toEqual({ projects: [], total: 0, hasMore: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('propagates completion DB errors in strict mode and returns an empty cohort otherwise', async () => {
    completionError = new Error('counts unavailable')
    await expect(getProjects({ tags: ['日常材料'] }, { strictErrors: true })).rejects.toThrow('Unable to load explore projects')
    expect(await getProjects({ tags: ['日常材料'] })).toEqual({ projects: [], total: 0, hasMore: false })
  })
})
