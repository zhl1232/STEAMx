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
import { deriveCourseProgress } from '@/lib/courses/progress'
import {
  getContentClassificationSettings,
  mapPublicClassification,
  type ContentClassificationRow,
} from '@/lib/content-classification'

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

type CourseLessonIndexRow = {
  id: number
  course_id: number
  sort_order: number
}

type CourseProgressRow = {
  lesson_id: number
  completed_at: string | null
}

type CourseMilestoneRow = {
  course_id: number
  completed_at: string
}

type CourseQueryRow = CourseRow & {
  user_course_completions?: CourseMilestoneRow[]
}

/** Keep classification columns out of public DTOs; expose only the stable camelCase envelope when enabled. */
function mapPublicCourseRow(row: CourseRow, includeClassification: boolean): CourseRow {
  const {
    recommended_min_age: _recommendedMinAge,
    recommended_max_age: _recommendedMaxAge,
    support_level: _supportLevel,
    classification_status: _classificationStatus,
    classification_source: _classificationSource,
    classification_reviewed_at: _classificationReviewedAt,
    classification_reviewed_by: _classificationReviewedBy,
    classification_revision: _classificationRevision,
    classification: _classification,
    difficulty_stars: _difficultyStars,
    ...publicRow
  } = row

  return {
    ...publicRow,
    ...(includeClassification
      ? { classification: mapPublicClassification(row as CourseRow & ContentClassificationRow) }
      : {}),
  }
}

function groupLessonsByCourse(rows: CourseLessonIndexRow[]) {
  const lessonsByCourse = new Map<number, CourseLessonIndexRow[]>()
  for (const row of rows) {
    const lessons = lessonsByCourse.get(row.course_id) ?? []
    lessons.push(row)
    lessonsByCourse.set(row.course_id, lessons)
  }
  return lessonsByCourse
}

async function loadCourseProgress(
  supabase: DbClient,
  userId: string | null | undefined,
  courseIds: number[],
  lessonRows: CourseLessonIndexRow[],
  nestedMilestones?: CourseMilestoneRow[],
) {
  const progressByCourse = new Map<number, Set<number>>()
  const completedAtByLesson = new Map<number, string>()
  const milestoneByCourse = new Map<number, string>()

  if (!userId || courseIds.length === 0) {
    return { progressByCourse, completedAtByLesson, milestoneByCourse }
  }

  const lessonIds = lessonRows.map((lesson) => lesson.id)
  const [progressResult, milestoneResult] = await Promise.all([
    lessonIds.length
      ? supabase
          .from('user_lesson_progress')
          .select('lesson_id, completed_at')
          .eq('user_id', userId)
          .in('lesson_id', lessonIds)
      : Promise.resolve({ data: [], error: null }),
    nestedMilestones
      ? Promise.resolve({ data: nestedMilestones, error: null })
      : supabase
          .from('user_course_completions')
          .select('course_id, completed_at')
          .eq('user_id', userId)
          .in('course_id', courseIds),
  ])

  if (progressResult.error) throw progressResult.error
  if (milestoneResult.error) throw milestoneResult.error

  const courseIdByLessonId = new Map(lessonRows.map((lesson) => [lesson.id, lesson.course_id]))
  for (const raw of (progressResult.data ?? []) as CourseProgressRow[]) {
    if (!raw.completed_at) continue
    const courseId = courseIdByLessonId.get(raw.lesson_id)
    if (!courseId) continue
    const completedIds = progressByCourse.get(courseId) ?? new Set<number>()
    completedIds.add(raw.lesson_id)
    progressByCourse.set(courseId, completedIds)
    completedAtByLesson.set(raw.lesson_id, raw.completed_at)
  }
  for (const raw of (milestoneResult.data ?? []) as CourseMilestoneRow[]) {
    milestoneByCourse.set(raw.course_id, raw.completed_at)
  }

  return { progressByCourse, completedAtByLesson, milestoneByCourse }
}

export async function listApprovedCourses(
  supabase: DbClient,
  options?: { userId?: string | null; includeClassification?: boolean },
): Promise<CourseListItem[]> {
  const classificationSettings = await getContentClassificationSettings()
  const includeClassification = options?.includeClassification === true && classificationSettings.publicV1Enabled
  const courseSelect = options?.userId
    ? '*, user_course_completions(course_id, completed_at)'
    : '*'
  let courseQuery = supabase
    .from('courses')
    .select(courseSelect)
    .eq('status', 'approved')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  if (classificationSettings.enforcementEnabled) {
    courseQuery = courseQuery.eq('classification_status', 'reviewed')
  }
  if (options?.userId) {
    courseQuery = courseQuery.eq('user_course_completions.user_id', options.userId)
  }
  const { data: courses, error } = await courseQuery

  if (error) throw error
  if (!courses?.length) return []

  const courseRows = courses as unknown as CourseQueryRow[]
  const ids = courseRows.map((c) => c.id)
  const { data: lessonRows, error: lessonError } = await supabase
    .from('course_lessons')
    .select('id, course_id, sort_order')
    .in('course_id', ids)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (lessonError) throw lessonError

  const typedLessonRows = (lessonRows ?? []) as CourseLessonIndexRow[]
  const { progressByCourse, milestoneByCourse } = await loadCourseProgress(
    supabase,
    options?.userId,
    ids,
    typedLessonRows,
    options?.userId
      ? courseRows.flatMap((course) => course.user_course_completions ?? [])
      : undefined,
  )
  const lessonsByCourse = groupLessonsByCourse(typedLessonRows)

  return courseRows.map(({ user_course_completions: _milestones, ...course }) => ({
    ...mapPublicCourseRow(course, includeClassification),
    lesson_count: lessonsByCourse.get(course.id)?.length ?? 0,
    progress: options?.userId
      ? deriveCourseProgress(
          lessonsByCourse.get(course.id) ?? [],
          progressByCourse.get(course.id) ?? [],
          milestoneByCourse.get(course.id) ?? null,
        )
      : null,
  }))
}

export async function getCourseOverview(
  supabase: DbClient,
  courseId: number,
  options?: { includeDraftForStaff?: boolean; userId?: string | null; includeClassification?: boolean }
): Promise<CourseOverview | null> {
  const classificationSettings = await getContentClassificationSettings()
  const includeClassification = options?.includeClassification === true && classificationSettings.publicV1Enabled
  const courseSelect = options?.userId
    ? '*, user_course_completions(course_id, completed_at)'
    : '*'
  let query = supabase.from('courses').select(courseSelect).eq('id', courseId)

  if (!options?.includeDraftForStaff) {
    query = query.eq('status', 'approved')
    if (classificationSettings.enforcementEnabled) {
      query = query.eq('classification_status', 'reviewed')
    }
  }
  if (options?.userId) {
    query = query.eq('user_course_completions.user_id', options.userId)
  }

  const { data: course, error } = await query.maybeSingle()
  if (error) throw error
  if (!course) return null
  const {
    user_course_completions: nestedMilestones,
    ...courseRow
  } = course as unknown as CourseQueryRow

  const { data: lessons, error: lessonsError } = await supabase
    .from('course_lessons')
    .select(
      'id, course_id, title, lesson_type, sort_order, duration_minutes, track:content->>track, level_label:content->>levelLabel, summary:content->>summary, ldraw_model_url:content->building3d->>ldrawModelUrl',
    )
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (lessonsError) throw lessonsError

  const summaryRows = ((lessons ?? []) as Array<
    Omit<CourseLessonSummary, 'has_model'> & { ldraw_model_url?: string | null }
  >).map(({ ldraw_model_url, ...lesson }) => ({
    ...lesson,
    has_model: Boolean(ldraw_model_url),
  }))
  const lessonRows = summaryRows.map((lesson) => ({
    id: lesson.id,
    course_id: lesson.course_id,
    sort_order: lesson.sort_order,
  }))
  const progress = await loadCourseProgress(
    supabase,
    options?.userId,
    [courseId],
    lessonRows,
    options?.userId ? nestedMilestones ?? [] : undefined,
  )
  const completedIds = progress.progressByCourse.get(courseId) ?? new Set<number>()
  const milestoneCompletedAt = progress.milestoneByCourse.get(courseId) ?? null

  return {
    ...mapPublicCourseRow(courseRow, includeClassification),
    lessons: summaryRows.map((lesson) => ({
      ...lesson,
      is_completed: completedIds.has(lesson.id),
      completed_at: progress.completedAtByLesson.get(lesson.id) ?? null,
    })),
    progress: options?.userId
      ? deriveCourseProgress(lessonRows, completedIds, milestoneCompletedAt)
      : null,
  }
}

export async function getLessonInCourse(
  supabase: DbClient,
  courseId: number,
  lessonId: number,
  options?: { includeClassification?: boolean },
): Promise<{ course: CourseRow; lesson: CourseLessonRow } | null> {
  const classificationSettings = await getContentClassificationSettings()
  const includeClassification = options?.includeClassification === true && classificationSettings.publicV1Enabled
  let courseQuery = supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .eq('status', 'approved')
  if (classificationSettings.enforcementEnabled) {
    courseQuery = courseQuery.eq('classification_status', 'reviewed')
  }

  const [courseResult, lessonResult] = await Promise.all([
    courseQuery.maybeSingle(),
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
    course: mapPublicCourseRow(courseResult.data as CourseRow, includeClassification),
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

  const classificationSettings = await getContentClassificationSettings()
  let courseQuery = supabase
    .from('courses')
    .select('id, title, status')
    .eq('id', lesson.course_id)
  if (classificationSettings.enforcementEnabled) {
    courseQuery = courseQuery.eq('classification_status', 'reviewed')
  }
  const { data: courseRow } = await courseQuery.maybeSingle()

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
