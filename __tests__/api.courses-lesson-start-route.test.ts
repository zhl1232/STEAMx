/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/start/route'
import { getLessonInCourse, getUserLessonProgress, upsertUserLessonProgress } from '@/lib/api/courses'
import { requireAuth } from '@/lib/api/auth'
import { createClient } from '@/lib/supabase/server'

const USER_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

vi.mock('@/lib/api/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/auth')>()
  return { ...actual, requireAuth: vi.fn() }
})

vi.mock('@/lib/api/rate-limit', () => ({
  requireRateLimit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/access/interaction-access', () => ({
  requireInteractionAccess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: { from: vi.fn() } }))

vi.mock('@/lib/api/courses', () => ({
  getLessonInCourse: vi.fn(),
  getUserLessonProgress: vi.fn(),
  upsertUserLessonProgress: vi.fn(),
}))

function call(courseId = '5', lessonId = '30') {
  return POST(new NextRequest('http://localhost/api/courses/5/lessons/30/start', { method: 'POST' }), {
    params: Promise.resolve({ courseId, lessonId }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(createClient as Mock).mockResolvedValue({})
  ;(requireAuth as Mock).mockResolvedValue({ id: USER_ID })
  ;(getLessonInCourse as Mock).mockResolvedValue({ lesson: { id: 30 }, course: { id: 5 } })
  ;(getUserLessonProgress as Mock).mockResolvedValue(null)
  ;(upsertUserLessonProgress as Mock).mockResolvedValue({ user_id: USER_ID, lesson_id: 30 })
})

describe('POST /api/courses/[courseId]/lessons/[lessonId]/start', () => {
  it('records the first open so the onboarding step can fire before completion', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ started: true, alreadyStarted: false })
    expect(upsertUserLessonProgress).toHaveBeenCalledWith(expect.anything(), {
      userId: USER_ID,
      lessonId: 30,
    })
  })

  it('never touches an existing row, so revisiting cannot clear completed_at', async () => {
    ;(getUserLessonProgress as Mock).mockResolvedValue({
      user_id: USER_ID,
      lesson_id: 30,
      completed_at: '2026-08-01T00:00:00.000Z',
    })

    const response = await call()

    expect(await response.json()).toEqual({ started: true, alreadyStarted: true })
    expect(upsertUserLessonProgress).not.toHaveBeenCalled()
  })

  it('rejects a lesson that does not belong to the course', async () => {
    ;(getLessonInCourse as Mock).mockResolvedValue(null)

    const response = await call()

    expect(response.status).toBe(404)
    expect(upsertUserLessonProgress).not.toHaveBeenCalled()
  })

  it('rejects malformed ids before hitting the database', async () => {
    for (const [courseId, lessonId] of [['0', '30'], ['5', 'abc'], ['-1', '30']]) {
      const response = await call(courseId, lessonId)
      expect(response.status).toBe(400)
    }
    expect(getLessonInCourse).not.toHaveBeenCalled()
  })
})
