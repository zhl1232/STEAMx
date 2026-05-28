import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import type {
  CourseDetail,
  CourseLessonRow,
  CourseListItem,
  CourseRow,
  UserLessonProgressRow,
} from '@/lib/courses/types'

type DbClient = SupabaseClient<Database>

function mapLessonRow(row: Record<string, unknown>): CourseLessonRow {
  return {
    id: row.id as number,
    course_id: row.course_id as number,
    title: row.title as string,
    lesson_type: row.lesson_type as CourseLessonRow['lesson_type'],
    content: (row.content as Record<string, unknown>) ?? {},
    steps: Array.isArray(row.steps) ? (row.steps as CourseLessonRow['steps']) : [],
    resources: Array.isArray(row.resources) ? (row.resources as CourseLessonRow['resources']) : [],
    starter_project_path: (row.starter_project_path as string) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
    duration_minutes: (row.duration_minutes as number) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function listApprovedCourses(supabase: DbClient): Promise<CourseListItem[]> {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
    .eq('status', 'approved')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!courses?.length) return []

  const ids = courses.map((c) => c.id)
  const { data: counts, error: countError } = await supabase
    .from('course_lessons')
    .select('course_id')
    .in('course_id', ids)

  if (countError) throw countError

  const countByCourse = new Map<number, number>()
  for (const row of counts ?? []) {
    const cid = row.course_id as number
    countByCourse.set(cid, (countByCourse.get(cid) ?? 0) + 1)
  }

  return courses.map((c) => ({
    ...(c as CourseRow),
    lesson_count: countByCourse.get(c.id) ?? 0,
  }))
}

export async function getCourseDetail(
  supabase: DbClient,
  courseId: number,
  options?: { includeDraftForStaff?: boolean }
): Promise<CourseDetail | null> {
  let query = supabase.from('courses').select('*').eq('id', courseId)

  if (!options?.includeDraftForStaff) {
    query = query.eq('status', 'approved')
  }

  const { data: course, error } = await query.maybeSingle()
  if (error) throw error
  if (!course) return null

  const { data: lessons, error: lessonsError } = await supabase
    .from('course_lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })

  if (lessonsError) throw lessonsError

  return {
    ...(course as CourseRow),
    lessons: (lessons ?? []).map((l) => mapLessonRow(l as Record<string, unknown>)),
  }
}

export async function getLessonInCourse(
  supabase: DbClient,
  courseId: number,
  lessonId: number
): Promise<{ course: CourseRow; lesson: CourseLessonRow } | null> {
  const detail = await getCourseDetail(supabase, courseId)
  if (!detail) return null
  const lesson = detail.lessons.find((l) => l.id === lessonId)
  if (!lesson) return null
  const { lessons: _lessons, ...course } = detail
  return { course, lesson }
}

export async function getUserLessonProgress(
  supabase: DbClient,
  userId: string,
  lessonId: number
): Promise<UserLessonProgressRow | null> {
  const { data, error } = await supabase
    .from('user_lesson_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (error) throw error
  return data as UserLessonProgressRow | null
}

export async function upsertUserLessonProgress(
  supabase: DbClient,
  params: {
    userId: string
    lessonId: number
    scratchProjectPath?: string | null
    completed?: boolean
  }
): Promise<UserLessonProgressRow> {
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    lesson_id: params.lessonId,
    updated_at: new Date().toISOString(),
  }
  if (params.scratchProjectPath !== undefined) {
    payload.scratch_project_path = params.scratchProjectPath
  }
  if (params.completed) {
    payload.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('user_lesson_progress')
    .upsert(payload as never, { onConflict: 'user_id,lesson_id' })
    .select()
    .single()

  if (error) throw error
  return data as UserLessonProgressRow
}

export function buildScratchProjectStoragePath(
  userId: string,
  courseId: number,
  lessonId: number
): string {
  return `${userId}/courses/${courseId}/lessons/${lessonId}/project.sb3`
}
