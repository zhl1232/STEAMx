/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/courses/[courseId]/lessons/[lessonId]/complete/route'
import { getLessonInCourse, getUserLessonProgress } from '@/lib/api/courses'
import { requireAuth } from '@/lib/api/auth'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

const { adminClientMock, downloadMock } = vi.hoisted(() => {
  const download = vi.fn()
  const storageFrom = vi.fn(() => ({ download }))
  return {
    adminClientMock: { storage: { from: storageFrom } },
    downloadMock: download,
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: adminClientMock }))

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

vi.mock('@/lib/api/courses', () => ({
  getLessonInCourse: vi.fn(),
  getUserLessonProgress: vi.fn(),
}))

vi.mock('@/lib/supabase/rpc', () => ({ callRpc: vi.fn() }))

const USER_ID = '11111111-1111-1111-1111-111111111111'
const routeSupabase = {}

const baseRpcResult = {
  progress: {
    user_id: USER_ID,
    lesson_id: 30,
    completed_at: '2026-08-26T10:00:00.000Z',
    updated_at: '2026-08-26T10:00:00.000Z',
  },
  already_completed: false,
  completed_lesson_count: 1,
  total_lesson_count: 3,
  status: 'in_progress',
  next_lesson_id: 31,
  milestone_completed_at: null,
  course_completion_created: false,
  course_completion_state: 'not_complete',
}

function call(courseId = '5', lessonId = '30') {
  return POST(
    new NextRequest(`http://localhost/api/courses/${courseId}/lessons/${lessonId}/complete`, {
      method: 'POST',
    }),
    { params: Promise.resolve({ courseId, lessonId }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(createClient as Mock).mockResolvedValue(routeSupabase)
  ;(requireAuth as Mock).mockResolvedValue({ id: USER_ID })
  ;(getLessonInCourse as Mock).mockResolvedValue({
    course: { id: 5 },
    lesson: { id: 30, lesson_type: 'playground', content: {} },
  })
  ;(getUserLessonProgress as Mock).mockResolvedValue(null)
  ;(callRpc as Mock).mockResolvedValue({ data: baseRpcResult, error: null })
  downloadMock.mockReset()
})

describe('POST /api/courses/[courseId]/lessons/[lessonId]/complete', () => {
  it('records a first non-Scratch completion through the atomic RPC without awarding lesson XP', async () => {
    const response = await call()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      progress: baseRpcResult.progress,
      alreadyCompleted: false,
      courseProgress: {
        completedLessonCount: 1,
        totalLessonCount: 3,
        status: 'in_progress',
        nextLessonId: 31,
        milestoneCompletedAt: null,
      },
      courseCompletionCreated: false,
      courseCompletionState: 'not_complete',
    })
    expect(callRpc).toHaveBeenCalledTimes(1)
    expect(callRpc).toHaveBeenCalledWith(
      expect.anything(),
      'record_course_lesson_completion',
      { p_user_id: USER_ID, p_course_id: 5, p_lesson_id: 30 },
    )
  })

  it('reports the course milestone when the final lesson creates it', async () => {
    ;(callRpc as Mock).mockResolvedValue({
      data: {
        ...baseRpcResult,
        already_completed: true,
        completed_lesson_count: 3,
        total_lesson_count: 3,
        status: 'completed',
        next_lesson_id: null,
        milestone_completed_at: '2026-08-26T10:00:00.000Z',
        course_completion_created: true,
        course_completion_state: 'created',
      },
      error: null,
    })

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.courseProgress).toMatchObject({
      completedLessonCount: 3,
      totalLessonCount: 3,
      status: 'completed',
      nextLessonId: null,
    })
    expect(body.courseCompletionCreated).toBe(true)
    expect(body.courseCompletionState).toBe('created')
  })

  it('keeps a repeated completion idempotent when the milestone already exists', async () => {
    ;(getUserLessonProgress as Mock).mockResolvedValue({
      user_id: USER_ID,
      lesson_id: 30,
      scratch_project_path: null,
      completed_at: '2026-08-25T10:00:00.000Z',
      updated_at: '2026-08-25T10:00:00.000Z',
      completion_source: 'server_v1',
    })
    ;(callRpc as Mock).mockResolvedValue({
      data: {
        ...baseRpcResult,
        already_completed: true,
        course_completion_state: 'already_recorded',
        milestone_completed_at: '2026-08-25T10:00:00.000Z',
      },
      error: null,
    })

    const response = await call()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      alreadyCompleted: true,
      courseCompletionCreated: false,
      courseCompletionState: 'already_recorded',
    })
    expect(downloadMock).not.toHaveBeenCalled()
    expect(callRpc).toHaveBeenCalledTimes(1)
  })

  it('revalidates a legacy Scratch completion before upgrading its trusted source', async () => {
    ;(getLessonInCourse as Mock).mockResolvedValue({
      course: { id: 5 },
      lesson: {
        id: 30,
        lesson_type: 'scratch',
        content: { requiredBlocks: [] },
      },
    })
    ;(getUserLessonProgress as Mock).mockResolvedValue({
      user_id: USER_ID,
      lesson_id: 30,
      scratch_project_path: null,
      completed_at: '2026-08-25T10:00:00.000Z',
      updated_at: '2026-08-25T10:00:00.000Z',
      completion_source: 'legacy_client',
    })

    const response = await call()

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: '请先保存 Scratch 作品再标记完成' })
    expect(callRpc).not.toHaveBeenCalled()
  })

  it('allows a trusted Scratch completion to reconcile without downloading the old project', async () => {
    ;(getLessonInCourse as Mock).mockResolvedValue({
      course: { id: 5 },
      lesson: {
        id: 30,
        lesson_type: 'scratch',
        content: {
          requiredBlocks: [{ label: '重复执行', anyOf: ['control_repeat'] }],
        },
      },
    })
    ;(getUserLessonProgress as Mock).mockResolvedValue({
      user_id: USER_ID,
      lesson_id: 30,
      scratch_project_path: null,
      completed_at: '2026-08-25T10:00:00.000Z',
      updated_at: '2026-08-25T10:00:00.000Z',
      completion_source: 'staff_verified',
    })

    const response = await call()

    expect(response.status).toBe(200)
    expect(callRpc).toHaveBeenCalledTimes(1)
    expect(downloadMock).not.toHaveBeenCalled()
  })

  it('returns a safe success response when invalid course configuration defers the milestone', async () => {
    ;(callRpc as Mock).mockResolvedValue({
      data: {
        ...baseRpcResult,
        completed_lesson_count: 3,
        total_lesson_count: 3,
        status: 'completed',
        next_lesson_id: null,
        course_completion_state: 'configuration_error',
      },
      error: null,
    })

    const response = await call()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      courseCompletionCreated: false,
      courseCompletionState: 'configuration_error',
    })
  })

  it('rejects malformed ids before querying course progress', async () => {
    const response = await call('0', 'not-a-number')

    expect(response.status).toBe(400)
    expect(getLessonInCourse).not.toHaveBeenCalled()
    expect(callRpc).not.toHaveBeenCalled()
  })
})
