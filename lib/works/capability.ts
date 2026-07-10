import type { CourseLessonRow, LessonContent } from '@/lib/courses/types'

const DEFAULT_WORK_LESSON_TYPES = new Set(['scratch', 'building_3d'])

export function isWorkSubmissionEnabled(
  lesson: Pick<CourseLessonRow, 'lesson_type' | 'content'>,
): boolean {
  const configured = (lesson.content as LessonContent | null)?.workSubmission?.enabled
  return typeof configured === 'boolean'
    ? configured
    : DEFAULT_WORK_LESSON_TYPES.has(lesson.lesson_type)
}
