import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import type {
  CourseLessonRow,
  CourseLessonSummary,
  CourseListItem,
  CourseOverview,
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

export async function getCourseOverview(
  supabase: DbClient,
  courseId: number,
  options?: { includeDraftForStaff?: boolean }
): Promise<CourseOverview | null> {
  let query = supabase.from('courses').select('*').eq('id', courseId)

  if (!options?.includeDraftForStaff) {
    query = query.eq('status', 'approved')
  }

  const { data: course, error } = await query.maybeSingle()
  if (error) throw error
  if (!course) return null

  const { data: lessons, error: lessonsError } = await supabase
    .from('course_lessons')
    .select('id, course_id, title, lesson_type, sort_order, duration_minutes, track:content->>track, level_label:content->>levelLabel')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })

  if (lessonsError) throw lessonsError

  return {
    ...(course as CourseRow),
    lessons: (lessons ?? []) as CourseLessonSummary[],
  }
}

export async function getLessonInCourse(
  supabase: DbClient,
  courseId: number,
  lessonId: number
): Promise<{ course: CourseRow; lesson: CourseLessonRow } | null> {
  const [courseResult, lessonResult] = await Promise.all([
    supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .eq('status', 'approved')
      .maybeSingle(),
    supabase
      .from('course_lessons')
      .select('*')
      .eq('course_id', courseId)
      .eq('id', lessonId)
      .maybeSingle(),
  ])

  if (courseResult.error) throw courseResult.error
  if (lessonResult.error) throw lessonResult.error
  if (!courseResult.data || !lessonResult.data) return null

  return {
    course: courseResult.data as CourseRow,
    lesson: mapLessonRow(lessonResult.data as Record<string, unknown>),
  }
}

/** Resolve both legacy course work projects and the pre-migration JSON bridge. */
export async function getCourseLessonByWorksProjectId(
  supabase: DbClient,
  projectId: number
): Promise<{ courseId: number; lessonId: number; courseTitle: string; lessonTitle: string } | null> {
  if (!Number.isInteger(projectId) || projectId <= 0) return null

  const { data: legacy } = await supabase
    .from('legacy_course_work_projects')
    .select('lesson_id')
    .eq('project_id', projectId)
    .maybeSingle()

  const legacyLessonId = (legacy as { lesson_id?: number } | null)?.lesson_id
  const lessonQuery = supabase.from('course_lessons').select('id, course_id, title')
  const { data: lessonRow, error } = legacyLessonId
    ? await lessonQuery.eq('id', legacyLessonId).maybeSingle()
    : await lessonQuery
        .eq('content->building3d->>worksProjectId' as 'content', String(projectId))
        .limit(1)
        .maybeSingle()

  if (error || !lessonRow) return null
  const lesson = lessonRow as { id: number; course_id: number; title: string }

  const { data: courseRow } = await supabase
    .from('courses')
    .select('id, title, status')
    .eq('id', lesson.course_id)
    .maybeSingle()

  const course = courseRow as { id: number; title: string; status: string } | null
  if (!course || course.status !== 'approved') return null

  return {
    courseId: course.id,
    lessonId: lesson.id,
    courseTitle: course.title,
    lessonTitle: lesson.title,
  }
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
