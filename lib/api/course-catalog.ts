import { lessonPreviewImage, LESSON_PREVIEW_PROJECTION, type LessonPreviewSource } from '@/lib/courses/lesson-preview-image'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getListedCourseSummary } from '@/lib/api/courses'
import type { CoursePreviewLesson } from '@/lib/courses/types'
import type { Database } from '@/lib/supabase/types'

/** A selected course's catalog, without workspace content, steps or resources. */
export async function getListedCourseCatalog(
  supabase: SupabaseClient<Database>,
  courseId: number,
  userId: string | null,
): Promise<CoursePreviewLesson[] | null> {
  if (!await getListedCourseSummary(supabase, courseId)) return null

  const { data, error } = await supabase
    .from('course_lessons')
    .select(`id, title, ${LESSON_PREVIEW_PROJECTION}`)
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error

  const lessons = (data ?? []) as unknown as Array<LessonPreviewSource & { id: number }>
  const completedIds = new Set<number>()
  if (userId && lessons.length > 0) {
    const { data: progress, error: progressError } = await supabase
      .from('user_lesson_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', userId)
      .in('lesson_id', lessons.map((lesson) => lesson.id))
    if (progressError) throw progressError
    for (const row of progress ?? []) {
      if (row.completed_at) completedIds.add(row.lesson_id)
    }
  }

  return lessons.map((lesson, index) => ({
    id: lesson.id,
    number: index + 1,
    title: lesson.title,
    image_url: lessonPreviewImage(lesson),
    is_completed: completedIds.has(lesson.id),
  }))
}
