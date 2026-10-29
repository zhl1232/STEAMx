import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET } from '@/app/api/courses/[courseId]/catalog/route'
import { createClient } from '@/lib/supabase/server'
import { getContentClassificationSettings } from '@/lib/content-classification'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/content-classification', () => ({
  getContentClassificationSettings: vi.fn(),
  mapPublicClassification: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

function query(data: unknown, error: unknown = null) {
  const response = { data, error }
  const builder = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), in: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  }
  for (const method of ['select', 'eq', 'order', 'in'] as const) builder[method].mockReturnValue(builder)
  return builder
}

function setup(options: { userId?: string; course?: unknown; lessonError?: unknown } = {}) {
  const course = query('course' in options ? options.course : { id: 5, title: '小班积木' })
  const lessons = query([
    { id: 11, title: '埃菲尔铁塔', finished_image_url: ' /tower.webp ' },
    { id: 12, title: '宝剑', finished_image_url: '' },
  ], options.lessonError)
  const progress = query([
    { lesson_id: 11, completed_at: '2026-10-01T00:00:00Z' },
    { lesson_id: 12, completed_at: null },
  ])
  const tables = { courses: course, course_lessons: lessons, user_lesson_progress: progress }
  const from = vi.fn((table: keyof typeof tables) => tables[table])
  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.userId ? { id: options.userId } : null } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, course, lessons, progress }
}

function call(courseId = '5') {
  return GET(new NextRequest(`http://localhost/api/courses/${courseId}/catalog`), {
    params: Promise.resolve({ courseId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getContentClassificationSettings).mockResolvedValue({
    publicV1Enabled: false, enforcementEnabled: false,
  } as Awaited<ReturnType<typeof getContentClassificationSettings>>)
})

describe('GET /api/courses/[courseId]/catalog', () => {
  it('returns only lightweight ordered lesson cards for anonymous users', async () => {
    const { from, lessons, course } = setup()
    const response = await call()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ lessons: [
      { id: 11, number: 1, title: '埃菲尔铁塔', image_url: '/tower.webp', is_completed: false },
      { id: 12, number: 2, title: '宝剑', image_url: null, is_completed: false },
    ] })
    expect(course.eq).toHaveBeenCalledWith('status', 'approved')
    expect(course.eq).toHaveBeenCalledWith('is_listed', true)
    expect(lessons.select).toHaveBeenCalledWith(expect.stringContaining('scratch_lesson_key:content->scratch->>lessonKey'))
    expect(lessons.select.mock.calls[0][0].split(',').map((field: string) => field.trim())).not.toContain('content')
    expect(lessons.eq).toHaveBeenCalledWith('course_id', 5)
    expect(lessons.order.mock.calls).toEqual([
      ['sort_order', { ascending: true }], ['id', { ascending: true }],
    ])
    expect(from).not.toHaveBeenCalledWith('user_lesson_progress')
  })

  it('loads completion only for the current user and selected course lessons', async () => {
    const { progress } = setup({ userId: 'current-user' })
    const response = await call()
    const body = await response.json()
    expect(body.lessons.map((lesson: { is_completed: boolean }) => lesson.is_completed)).toEqual([true, false])
    expect(progress.eq).toHaveBeenCalledWith('user_id', 'current-user')
    expect(progress.in).toHaveBeenCalledWith('lesson_id', [11, 12])
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('does not expose lessons for missing or unavailable courses', async () => {
    const { from } = setup({ course: null })
    const response = await call()
    expect(response.status).toBe(404)
    expect(from).not.toHaveBeenCalledWith('course_lessons')
  })

  it('preserves the classification review gate when enforcement is enabled', async () => {
    vi.mocked(getContentClassificationSettings).mockResolvedValue({
      publicV1Enabled: true, enforcementEnabled: true,
    } as Awaited<ReturnType<typeof getContentClassificationSettings>>)
    const { course } = setup({ course: null })
    expect((await call()).status).toBe(404)
    expect(course.eq).toHaveBeenCalledWith('classification_status', 'reviewed')
  })

  it.each(['0', '-1', '5.5', 'oops', '9007199254740992'])('rejects invalid course id %s before querying', async (id) => {
    setup()
    expect((await call(id)).status).toBe(400)
    expect(createClient).not.toHaveBeenCalled()
  })

  it('returns an error instead of a misleading empty catalog after a query failure', async () => {
    setup({ lessonError: new Error('database unavailable') })
    const response = await call()
    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).not.toHaveProperty('lessons')
  })
})
