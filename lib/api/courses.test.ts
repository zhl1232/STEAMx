import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getCourseOverview,
  getCourseSuccessor,
  getListedCourseSummary,
  listApprovedCourses,
} from '@/lib/api/courses'
import type { CourseRow } from '@/lib/courses/types'

vi.mock('@/lib/content-classification', () => ({
  getContentClassificationSettings: vi.fn().mockResolvedValue({
    publicV1Enabled: false,
    enforcementEnabled: false,
  }),
  mapPublicClassification: vi.fn(),
}))

type QueryResponse = {
  data: unknown
  error: unknown
}

type QueryMock = {
  eq: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
}

type FakeClient = {
  from: ReturnType<typeof vi.fn>
  queries: Map<string, QueryMock>
}

const USER_ID = '11111111-1111-1111-1111-111111111111'
const MILESTONE_AT = '2026-08-01T10:00:00.000Z'

const baseCourse: CourseRow = {
  id: 1,
  title: '积木工程',
  description: '从结构开始学习。',
  image_url: null,
  tags: ['积木'],
  status: 'approved',
  sort_order: 1,
  steam_weights: { S: 10, T: 20, E: 30, A: 20, M: 20 },
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
}

function makeCourse(overrides: Partial<CourseRow> = {}): CourseRow {
  return { ...baseCourse, ...overrides }
}

function makeOverviewLesson(id: number, sortOrder: number) {
  return {
    id,
    course_id: 1,
    title: `课时 ${id}`,
    lesson_type: 'building_3d',
    sort_order: sortOrder,
    duration_minutes: 10,
    track: null,
    level_label: null,
    summary: null,
    ldraw_model_url: null,
    finished_image_url: null,
  }
}

function makeQuery(response: QueryResponse): QueryMock & { then: Function } {
  const query = {} as QueryMock & { then: Function }
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.in = vi.fn(() => query)
  query.order = vi.fn(() => query)
  query.maybeSingle = vi.fn(async () => response)
  query.then = (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return query
}

function makeClient(responses: Record<string, QueryResponse>): FakeClient {
  const queries = new Map<string, QueryMock>()
  const from = vi.fn((table: string) => {
    const response = responses[table]
    if (!response) throw new Error(`Unexpected table: ${table}`)
    const query = makeQuery(response)
    queries.set(table, query)
    return query
  })
  return { from, queries }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listApprovedCourses', () => {
  it('keeps anonymous progress null and does not query user progress tables', async () => {
    const client = makeClient({
      courses: {
        data: [
          makeCourse(),
          makeCourse({ id: 2, title: '待补课时的课程', sort_order: 2 }),
        ],
        error: null,
      },
      course_lessons: {
        data: [{ id: 11, course_id: 1, sort_order: 1 }],
        error: null,
      },
    })

    const courses = await listApprovedCourses(client as never, { userId: null })

    expect(courses).toMatchObject([
      { id: 1, lesson_count: 1, progress: null },
      { id: 2, lesson_count: 0, progress: null },
    ])
    expect(client.from.mock.calls.map(([table]) => table)).toEqual(['courses', 'course_lessons'])
    expect(client.queries.get('courses')?.eq).toHaveBeenCalledWith('is_listed', true)
  })

  it('uses only the logged-in learner progress in a batched course response', async () => {
    const client = makeClient({
      courses: {
        data: [
          {
            ...makeCourse(),
            user_course_completions: [{ course_id: 1, completed_at: MILESTONE_AT }],
          },
        ],
        error: null,
      },
      course_lessons: {
        data: [
          { id: 11, course_id: 1, sort_order: 1 },
          { id: 12, course_id: 1, sort_order: 2 },
          { id: 13, course_id: 1, sort_order: 3 },
        ],
        error: null,
      },
      user_lesson_progress: {
        data: [
          { lesson_id: 11, completed_at: '2026-07-20T10:00:00.000Z' },
          { lesson_id: 12, completed_at: '2026-07-21T10:00:00.000Z' },
          { lesson_id: 999, completed_at: '2026-07-22T10:00:00.000Z' },
        ],
        error: null,
      },
    })

    const courses = await listApprovedCourses(client as never, { userId: USER_ID })

    expect(courses[0].progress).toEqual({
      completed_lesson_count: 2,
      total_lesson_count: 3,
      status: 'in_progress',
      next_lesson_id: 13,
      milestone_completed_at: MILESTONE_AT,
    })
    expect(courses[0]).not.toHaveProperty('classification')
    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      'courses',
      'course_lessons',
      'user_lesson_progress',
    ])

    const progressQuery = client.queries.get('user_lesson_progress')!
    expect(progressQuery.eq).toHaveBeenCalledWith('user_id', USER_ID)
    expect(progressQuery.in).toHaveBeenCalledWith('lesson_id', [11, 12, 13])
  })
})

describe('getCourseOverview', () => {
  it('keeps a direct historical course link available when the course leaves discovery', async () => {
    const client = makeClient({
      courses: { data: makeCourse({ is_listed: false }), error: null },
      course_lessons: { data: [makeOverviewLesson(11, 1)], error: null },
    })

    const course = await getCourseOverview(client as never, 1)

    expect(course?.id).toBe(1)
    expect(course?.is_listed).toBe(false)
    expect(client.queries.get('courses')?.eq).not.toHaveBeenCalledWith('is_listed', true)
  })

  it('reopens current progress when a lesson is added after a milestone', async () => {
    const client = makeClient({
      courses: {
        data: {
          ...makeCourse(),
          user_course_completions: [{ course_id: 1, completed_at: MILESTONE_AT }],
        },
        error: null,
      },
      course_lessons: {
        data: [
          { ...makeOverviewLesson(11, 1), finished_image_url: '/courses/11/finished.webp' },
          makeOverviewLesson(12, 2),
          makeOverviewLesson(13, 3),
        ],
        error: null,
      },
      user_lesson_progress: {
        data: [
          { lesson_id: 11, completed_at: '2026-07-20T10:00:00.000Z' },
          { lesson_id: 12, completed_at: '2026-07-21T10:00:00.000Z' },
        ],
        error: null,
      },
    })

    const course = await getCourseOverview(client as never, 1, { userId: USER_ID })

    expect(course?.progress).toEqual({
      completed_lesson_count: 2,
      total_lesson_count: 3,
      status: 'in_progress',
      next_lesson_id: 13,
      milestone_completed_at: MILESTONE_AT,
    })
    expect(course?.lessons.map((lesson) => lesson.is_completed)).toEqual([true, true, false])
    expect(course?.lessons[0]?.finished_image_url).toBe('/courses/11/finished.webp')
  })

  it('does not turn an empty course into a completed learner state', async () => {
    const client = makeClient({
      courses: {
        data: {
          ...makeCourse(),
          user_course_completions: [{ course_id: 1, completed_at: MILESTONE_AT }],
        },
        error: null,
      },
      course_lessons: { data: [], error: null },
    })

    const course = await getCourseOverview(client as never, 1, { userId: USER_ID })

    expect(course?.lessons).toEqual([])
    expect(course?.progress).toEqual({
      completed_lesson_count: 0,
      total_lesson_count: 0,
      status: 'not_started',
      next_lesson_id: null,
      milestone_completed_at: null,
    })
    expect(client.from.mock.calls.map(([table]) => table)).toEqual(['courses', 'course_lessons'])
  })
})

describe('course successor lookup', () => {
  it('reads the successor through the same listed/approved filters as the catalog', async () => {
    const client = makeClient({
      courses: { data: { id: 8, title: ' Scratch 创探编程：从动画到作品 ' }, error: null },
    })

    await expect(getCourseSuccessor(client as never, 1)).resolves.toEqual({
      id: 8,
      title: 'Scratch 创探编程：从动画到作品',
    })
    const query = client.queries.get('courses')
    expect(query?.select).toHaveBeenCalledWith('id, title')
    expect(query?.eq).toHaveBeenCalledWith('id', 8)
    expect(query?.eq).toHaveBeenCalledWith('status', 'approved')
    expect(query?.eq).toHaveBeenCalledWith('is_listed', true)
  })

  it('returns null without querying when a course has no successor', async () => {
    const client = makeClient({})

    await expect(getCourseSuccessor(client as never, 3)).resolves.toBeNull()
    expect(client.from).not.toHaveBeenCalled()
  })

  it('falls back to null when the successor is missing, unlisted or the query fails', async () => {
    await expect(
      getCourseSuccessor(makeClient({ courses: { data: null, error: null } }) as never, 1),
    ).resolves.toBeNull()
    await expect(
      getCourseSuccessor(makeClient({ courses: { data: null, error: new Error('boom') } }) as never, 1),
    ).resolves.toBeNull()
    await expect(
      getListedCourseSummary(makeClient({ courses: { data: { id: 8, title: '  ' }, error: null } }) as never, 8),
    ).resolves.toBeNull()
  })
})

