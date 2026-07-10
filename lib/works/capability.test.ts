import { describe, expect, it } from 'vitest'

import type { CourseLessonRow } from '@/lib/courses/types'
import { isWorkSubmissionEnabled } from '@/lib/works/capability'

function lesson(lessonType: string, enabled?: boolean): Pick<CourseLessonRow, 'lesson_type' | 'content'> {
  return {
    lesson_type: lessonType,
    content: enabled === undefined ? {} : { workSubmission: { enabled } },
  }
}

describe('isWorkSubmissionEnabled', () => {
  it('defaults output-producing Scratch and building lessons to enabled', () => {
    expect(isWorkSubmissionEnabled(lesson('scratch'))).toBe(true)
    expect(isWorkSubmissionEnabled(lesson('building_3d'))).toBe(true)
    expect(isWorkSubmissionEnabled(lesson('reading'))).toBe(false)
  })

  it('honors an explicit per-lesson override', () => {
    expect(isWorkSubmissionEnabled(lesson('scratch', false))).toBe(false)
    expect(isWorkSubmissionEnabled(lesson('reading', true))).toBe(true)
  })
})
