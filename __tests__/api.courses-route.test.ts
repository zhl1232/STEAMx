/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { GET as GET_COURSES } from '@/app/api/courses/route'
import { GET as GET_COURSE } from '@/app/api/courses/[courseId]/route'
import { listApprovedCourses, getCourseOverview } from '@/lib/api/courses'
import type { CourseListItem, CourseOverview } from '@/lib/courses/types'

const { createClientMock, getUserMock, routeSupabase } = vi.hoisted(() => {
  const getUser = vi.fn()
  const client = { auth: { getUser } }
  return {
    createClientMock: vi.fn().mockResolvedValue(client),
    getUserMock: getUser,
    routeSupabase: client,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }))
vi.mock('@/lib/api/courses', () => ({
  listApprovedCourses: vi.fn(),
  getCourseOverview: vi.fn(),
}))
vi.mock('@/lib/content-classification', () => ({
  getContentClassificationSettings: vi.fn().mockResolvedValue({
    publicV1Enabled: false,
    enforcementEnabled: false,
  }),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

const listApprovedCoursesMock = vi.mocked(listApprovedCourses)
const getCourseOverviewMock = vi.mocked(getCourseOverview)

const progress = {
  completed_lesson_count: 1,
  total_lesson_count: 3,
  status: 'in_progress' as const,
  next_lesson_id: 12,
  milestone_completed_at: null,
}

const courseListItem = {
  id: 5,
  title: '五子棋入门',
  description: null,
  image_url: null,
  tags: [],
  status: 'approved' as const,
  sort_order: 1,
  steam_weights: { S: 10, T: 20, E: 10, A: 10, M: 50 },
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  lesson_count: 3,
  progress,
} as CourseListItem

const courseOverview = {
  ...courseListItem,
  lessons: [],
} as unknown as CourseOverview

beforeEach(() => {
  vi.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: null } })
})

describe('GET /api/courses', () => {
  it('keeps anonymous responses public and without personal progress', async () => {
    listApprovedCoursesMock.mockResolvedValue([{ ...courseListItem, progress: null }])

    const response = await GET_COURSES()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60, stale-while-revalidate=300')
    expect(listApprovedCoursesMock).toHaveBeenCalledWith(routeSupabase, {
      userId: null,
      includeClassification: false,
    })
    await expect(response.json()).resolves.toMatchObject({
      courses: [{ id: 5, progress: null }],
    })
  })

  it('marks a logged-in response private and serializes progress for that user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'learner-a' } } })
    listApprovedCoursesMock.mockResolvedValue([courseListItem])

    const response = await GET_COURSES()

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(listApprovedCoursesMock).toHaveBeenCalledWith(routeSupabase, {
      userId: 'learner-a',
      includeClassification: false,
    })
    await expect(response.json()).resolves.toMatchObject({
      courses: [{
        id: 5,
        progress: {
          completedLessonCount: 1,
          totalLessonCount: 3,
          status: 'in_progress',
          nextLessonId: 12,
          milestoneCompletedAt: null,
        },
      }],
    })
  })
})

describe('GET /api/courses/[courseId]', () => {
  it('passes the authenticated identity to the overview and keeps the response private', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'learner-b' } } })
    getCourseOverviewMock.mockResolvedValue(courseOverview)

    const response = await GET_COURSE(new NextRequest('http://localhost/api/courses/5'), {
      params: Promise.resolve({ courseId: '5' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(getCourseOverviewMock).toHaveBeenCalledWith(routeSupabase, 5, {
      userId: 'learner-b',
      includeClassification: false,
    })
    await expect(response.json()).resolves.toMatchObject({
      course: { id: 5, progress: expect.objectContaining({ nextLessonId: 12 }) },
    })
  })
})
