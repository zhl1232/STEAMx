import { describe, expect, it } from 'vitest'

import {
  deriveCourseProgress,
  fromCourseProgressApi,
  getLessonCompletionFeedback,
  toCourseProgressApi,
} from '@/lib/courses/progress'

describe('deriveCourseProgress', () => {
  const lessons = [
    { id: 20, sort_order: 2 },
    { id: 10, sort_order: 1 },
    { id: 11, sort_order: 1 },
  ]

  it('keeps empty courses from becoming completed', () => {
    expect(deriveCourseProgress([], [], null)).toEqual({
      completed_lesson_count: 0,
      total_lesson_count: 0,
      status: 'not_started',
      next_lesson_id: null,
      milestone_completed_at: null,
    })
  })

  it('uses sort order and lesson id for the next lesson', () => {
    expect(deriveCourseProgress(lessons, [10])).toMatchObject({
      completed_lesson_count: 1,
      total_lesson_count: 3,
      status: 'in_progress',
      next_lesson_id: 11,
    })
  })

  it('returns a completed status only when every current lesson is complete', () => {
    const progress = deriveCourseProgress(lessons, [10, 11, 20], '2026-07-30T10:00:00.000Z')
    expect(progress.status).toBe('completed')
    expect(progress.next_lesson_id).toBeNull()
    expect(toCourseProgressApi(progress)).toEqual({
      completedLessonCount: 3,
      totalLessonCount: 3,
      status: 'completed',
      nextLessonId: null,
      milestoneCompletedAt: '2026-07-30T10:00:00.000Z',
    })
    expect(fromCourseProgressApi(toCourseProgressApi(progress))).toEqual(progress)
  })

  it('reopens current progress when a new lesson is added after the milestone', () => {
    expect(
      deriveCourseProgress(
        [
          { id: 10, sort_order: 1 },
          { id: 11, sort_order: 2 },
          { id: 12, sort_order: 3 },
        ],
        [10, 11],
        '2026-07-30T10:00:00.000Z',
      ),
    ).toEqual({
      completed_lesson_count: 2,
      total_lesson_count: 3,
      status: 'in_progress',
      next_lesson_id: 12,
      milestone_completed_at: '2026-07-30T10:00:00.000Z',
    })
  })

  it('ignores completed rows for lessons that no longer belong to the course', () => {
    expect(deriveCourseProgress([{ id: 10, sort_order: 1 }], [10, 999])).toMatchObject({
      completed_lesson_count: 1,
      total_lesson_count: 1,
      status: 'completed',
      next_lesson_id: null,
    })
  })
})

describe('getLessonCompletionFeedback', () => {
  it('does not expose XP for a normal completion', () => {
    expect(getLessonCompletionFeedback({})).toEqual({ title: '课时进度已保存' })
  })

  it('reports the course milestone exactly once', () => {
    expect(getLessonCompletionFeedback({ courseCompletionState: 'created' })).toMatchObject({
      title: '课程已完成',
      description: '整门课学完了，结课凭证和作品册已经生成',
    })
  })

  it('points at the certificate only when the course was just finished', () => {
    expect(
      getLessonCompletionFeedback({ courseCompletionState: 'created', courseId: 5 }).certificateHref,
    ).toBe('/courses/5/certificate')
    expect(
      getLessonCompletionFeedback({ courseCompletionState: 'already_recorded', courseId: 5 })
        .certificateHref,
    ).toBeUndefined()
    expect(getLessonCompletionFeedback({ courseId: 5 }).certificateHref).toBeUndefined()
  })

  it('keeps configuration failures user-safe and does not expose a false milestone', () => {
    expect(getLessonCompletionFeedback({ courseCompletionState: 'configuration_error' })).toEqual({
      title: '课时进度已保存',
    })
  })

  it('does not show a second completion celebration for an existing milestone', () => {
    expect(getLessonCompletionFeedback({ courseCompletionState: 'already_recorded' })).toEqual({
      title: '本课已完成',
    })
  })
})
