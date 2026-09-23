import { beforeEach, describe, expect, it, vi } from 'vitest'

import { formatTutorResourceSearch, searchTutorResources } from '@/lib/ai/tutor/resource-search'
import type { TutorResourceSearchPlan } from '@/lib/ai/tutor/resource-search-planner'

const { getContentClassificationSettings } = vi.hoisted(() => ({
  getContentClassificationSettings: vi.fn(),
}))

vi.mock('@/lib/content-classification', () => ({
  getContentClassificationSettings,
}))

type Row = Record<string, unknown>
type Filter = { column: string; value: unknown }

function valueAt(row: Row, column: string) {
  if (column === 'content->>summary') return row.content_summary
  if (column.includes('.')) {
    const [parent, child] = column.split('.')
    const nested = row[parent]
    return nested && typeof nested === 'object' ? (nested as Row)[child] : undefined
  }
  return row[column]
}

function matchesOr(row: Row, expression: string) {
  return expression.split(',').some((clause) => {
    const ilike = clause.match(/^([^.]*)\.ilike\.%(.*)%$/u)
    if (ilike) {
      const value = valueAt(row, ilike[1])
      return typeof value === 'string' && value.toLocaleLowerCase().includes(ilike[2].toLocaleLowerCase())
    }
    const contains = clause.match(/^([^.]*)\.cs\.\{(.*)\}$/u)
    if (contains) {
      const value = valueAt(row, contains[1])
      return Array.isArray(value) && value.includes(contains[2])
    }
    return false
  })
}

function createSupabase(rowsByTable: Record<string, Row[]>, errorsByTable: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; filters: Filter[]; inFilters: Array<{ column: string; values: unknown[] }>; or?: string; select: string }> = []
  const client = {
    from(table: string) {
      let select = ''
      const filters: Filter[] = []
      const inFilters: Array<{ column: string; values: unknown[] }> = []
      let or: string | undefined
      const query = {
        select(value: string) { select = value; return query },
        eq(column: string, value: unknown) { filters.push({ column, value }); return query },
        in(column: string, values: unknown[]) { inFilters.push({ column, values }); return query },
        or(value: string) { or = value; return query },
        order() { return query },
        limit: async () => {
          calls.push({ table, filters: [...filters], inFilters: [...inFilters], or, select })
          if (table in errorsByTable) return { data: [], error: errorsByTable[table] }
          const data = (rowsByTable[table] ?? []).filter((row) =>
            filters.every(({ column, value }) => valueAt(row, column) === value)
            && inFilters.every(({ column, values }) => values.includes(valueAt(row, column)))
            && (!or || matchesOr(row, or)),
          )
          return { data, error: null }
        },
      }
      return query
    },
  }
  return { client, calls }
}

const plan = (resourceTypes: TutorResourceSearchPlan['resourceTypes'], queries: string[] = ['递归']): TutorResourceSearchPlan => ({
  status: 'model' as const,
  shouldSearch: true,
  queries,
  resourceTypes,
})

beforeEach(() => {
  getContentClassificationSettings.mockReset()
  getContentClassificationSettings.mockResolvedValue({ publicV1Enabled: false, enforcementEnabled: false })
})

describe('resource search coverage', () => {
  it('retrieves all six resource types with their visibility filters and SEO game catalog', async () => {
    const { client, calls } = createSupabase({
      challenges: [
        { id: 1, title: '递归挑战', description: 'active', driving_question: '', status: 'active' },
        { id: 2, title: '递归旧挑战', description: '', driving_question: 'ended', status: 'ended' },
        { id: 3, title: '递归草稿', description: '', driving_question: '', status: 'draft' },
      ],
      learning_resources: [
        { id: 4, title: '递归资料', summary: 'published', category: '算法', status: 'published' },
        { id: 5, title: '递归隐藏资料', summary: '', category: '算法', status: 'draft' },
      ],
      species: [
        { slug: 'hanoi-bird', common_name: '递归鸟', habitat_notes: '递归', is_active: true },
        { slug: 'hidden-bird', common_name: '递归隐藏鸟', habitat_notes: '递归', is_active: false },
      ],
    })

    const result = await searchTutorResources(client as never, plan(['challenge', 'resource', 'species', 'game']))

    expect(result).toMatchObject({ status: 'complete', challenges: [{ id: 1 }, { id: 2 }], resources: [{ id: 4 }], species: [{ slug: 'hanoi-bird' }] })
    expect(result?.challenges?.some((item) => item.id === 3)).toBe(false)
    expect(result?.games?.some((item) => item.key === 'hanoi')).toBe(true)
    expect(result?.games?.some((item) => item.key === 'maze')).toBe(false)
    expect(calls.find((call) => call.table === 'challenges')?.inFilters).toContainEqual({ column: 'status', values: ['active', 'ended'] })
    expect(calls.find((call) => call.table === 'learning_resources')?.filters).toContainEqual({ column: 'status', value: 'published' })
    expect(calls.find((call) => call.table === 'species')?.filters).toContainEqual({ column: 'is_active', value: true })
    expect(calls.find((call) => call.table === 'learning_resources')?.filters.some(({ column }) => column === 'classification_status')).toBe(false)
  })

  it('adds reviewed filters when classification enforcement is enabled', async () => {
    getContentClassificationSettings.mockResolvedValue({ publicV1Enabled: true, enforcementEnabled: true })
    const { client, calls } = createSupabase({ challenges: [{ id: 1, title: '递归', status: 'active' }] })

    await searchTutorResources(client as never, plan(['challenge']))

    expect(calls.find((call) => call.table === 'challenges')?.filters).toContainEqual({ column: 'classification_status', value: 'reviewed' })
  })

  it('searches lesson summary content and filters hidden parent courses before returning lesson chips', async () => {
    const { client, calls } = createSupabase({
      course_lessons: [
        { id: 70, course_id: 5, title: '第一课', content_summary: '轮船搭建', courses: { status: 'approved', is_listed: true } },
        { id: 71, course_id: 6, title: '隐藏课时', content_summary: '轮船搭建', courses: { status: 'draft', is_listed: false } },
      ],
      courses: [
        { id: 5, title: '积木课程', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 6, title: '隐藏课程', tags: ['轮船'], status: 'draft', is_listed: false },
      ],
    })

    const result = await searchTutorResources(client as never, plan(['course'], ['轮船']))

    expect(result?.courses).toEqual([{ id: 5, title: '积木课程', tags: ['轮船'], lessonTitles: ['第一课'], lessons: [{ id: 70, title: '第一课' }] }])
    const lessonCall = calls.find((call) => call.table === 'course_lessons')
    expect(lessonCall?.select).toContain('courses!inner(id)')
    expect(lessonCall?.filters).toContainEqual({ column: 'courses.status', value: 'approved' })
    expect(lessonCall?.filters).toContainEqual({ column: 'courses.is_listed', value: true })
    expect(lessonCall?.or).toContain('content->>summary.ilike.%轮船%')
  })

  it('keeps a lesson-hit course ahead of five direct course matches', async () => {
    const { client } = createSupabase({
      courses: [
        { id: 1, title: '宽泛课程一', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 2, title: '宽泛课程二', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 3, title: '宽泛课程三', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 4, title: '宽泛课程四', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 5, title: '宽泛课程五', tags: ['轮船'], status: 'approved', is_listed: true },
        { id: 6, title: '精确课时所属课程', tags: [], status: 'approved', is_listed: true },
      ],
      course_lessons: [
        { id: 60, course_id: 6, title: '精确课时', content_summary: '轮船搭建', courses: { status: 'approved', is_listed: true } },
      ],
    })

    const result = await searchTutorResources(client as never, plan(['course'], ['轮船']))

    expect(result?.courses.map((course) => course.id)).toEqual([6, 1, 2, 3, 4])
    expect(result?.courses[0]).toMatchObject({ id: 6, lessons: [{ id: 60, title: '精确课时' }] })
  })

  it('distinguishes empty, partial, and failed searches', async () => {
    const empty = await searchTutorResources(createSupabase({}) .client as never, plan(['challenge']))
    expect(empty?.status).toBe('complete')
    expect(formatTutorResourceSearch(empty!)).toContain('没有返回匹配')

    const partial = await searchTutorResources(createSupabase({ challenges: [{ id: 1, title: '递归', status: 'active' }] }, { learning_resources: { message: 'resource down' } }).client as never, plan(['challenge', 'resource']))
    expect(partial?.status).toBe('partial')
    expect(formatTutorResourceSearch(partial!)).toContain('部分失败')

    const failed = await searchTutorResources(createSupabase({}, { challenges: { message: 'challenge down' } }).client as never, plan(['challenge']))
    expect(failed?.status).toBe('failed')
    expect(formatTutorResourceSearch(failed!)).toContain('检索失败')
  })

  it('formats exact links for every resource kind and drops invalid identifiers', () => {
    const text = formatTutorResourceSearch({
      status: 'complete', queries: ['x'], broadenedQueries: [],
      courses: [{ id: 5, title: '课程', tags: null, lessonTitles: ['课时'], lessons: [{ id: 70, title: '课时' }] }],
      projects: [{ id: 8, title: '项目', description: null, tags: null }],
      challenges: [{ id: 2, title: '挑战', summary: '', status: 'ended' }],
      resources: [{ id: 3, title: '资料', summary: '', category: '算法' }],
      species: [{ slug: 'bee', title: '蜜蜂', summary: '' }, { slug: 'bad/slug', title: '坏物种', summary: '' }],
      games: [{ key: 'hanoi', title: '汉诺塔', summary: '' }, { key: 'unknown', title: '未知游戏', summary: '' }],
    })

    expect(text).toContain('[course:5|课程]')
    expect(text).toContain('[lesson:5:70|课时]')
    expect(text).toContain('[project:8|项目]')
    expect(text).toContain('[challenge:2|挑战]')
    expect(text).toContain('[resource:3|资料]')
    expect(text).toContain('[species:bee|蜜蜂]')
    expect(text).toContain('[game:hanoi|汉诺塔]')
    expect(text).not.toContain('bad/slug')
    expect(text).not.toContain('unknown')
  })
})
