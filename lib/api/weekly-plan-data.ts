import type { SupabaseClient } from '@supabase/supabase-js'

import { loadObservationSpeciesForEvents } from '@/lib/api/nature-observation-data'
import { getNaturalObservationProgressSummary } from '@/lib/api/nature-observation-progress'
import type { CourseLessonRow } from '@/lib/courses/types'
import type { UserStats } from '@/lib/gamification/types'
import { type DbProject, mapProject } from '@/lib/mappers/project'
import {
  mapDbChallenge,
  mapDbStageProgress,
  type Challenge,
  type ObservationEvent,
  type StageProgress,
} from '@/lib/mappers/types'
import {
  GROWTH_TASK_REWARD_ACTION_TYPE,
  type GrowthTaskId,
  resolveGrowthTasks,
  toGrowthTaskInput,
} from '@/lib/profile/growth-tasks'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'
import {
  buildProfileTimelineEvents,
  type BadgeTimelineRow,
  type ChallengeSubmissionTimelineRow,
  type CompletedProjectTimelineRow,
  type ObservationTimelineRow,
  type ProfileTimelineEvent,
  type ProjectTimelineRow,
  type XpLogTimelineRow,
} from '@/lib/profile/timeline'
import {
  buildWeeklyPlan,
  formatWeeklyPlanForTutor,
  getWeeklyPlanWeekStart,
  type WeeklyPlan,
  type WeeklyPlanCourseProgress,
  type WeeklyPlanPblProgress,
} from '@/lib/profile/weekly-plan'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import type { Database } from '@/lib/supabase/types'

type DbClient = SupabaseClient<Database>
type ChallengeRow = Database['public']['Tables']['challenges']['Row']
type StageProgressRow = Database['public']['Tables']['challenge_stage_progress']['Row']

const PROFILE_WORKS_PAGE_SIZE = 8
const EXPLORING_PROJECT_LIMIT = 5
const TIMELINE_SOURCE_LIMIT = 80

function uniqueNumbers(values: Array<number | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is number => typeof value === 'number')))
}

async function loadProjectTitleMap(supabase: DbClient, projectIds: number[]) {
  if (projectIds.length === 0) return new Map<number, string>()

  const { data, error } = await supabase.from('projects').select('id, title').in('id', projectIds)
  if (error) throw error

  return new Map(((data || []) as { id: number; title: string | null }[]).map((row) => [row.id, row.title || '项目作品']))
}

async function loadChallengeTitleMap(supabase: DbClient, challengeIds: number[]) {
  if (challengeIds.length === 0) return new Map<number, string>()

  const { data, error } = await supabase.from('challenges').select('id, title').in('id', challengeIds)
  if (error) throw error

  return new Map(((data || []) as { id: number; title: string | null }[]).map((row) => [row.id, row.title || '挑战作品']))
}

async function loadProfileSummarySignals(supabase: DbClient, userId: string) {
  const [projectsResponse, naturalObservationProgress, steamRadar] = await Promise.all([
    supabase
      .from('projects')
      .select('*, profiles:author_id (display_name)', { count: 'exact' })
      .eq('author_id', userId)
      .order('created_at', { ascending: false })
      .range(0, PROFILE_WORKS_PAGE_SIZE - 1),
    getNaturalObservationProgressSummary(supabase, userId),
    getSteamRadarWithGuidanceSafe(supabase, userId, 'weekly-plan'),
  ])

  if (projectsResponse.error) throw projectsResponse.error

  return {
    myProjects: ((projectsResponse.data as DbProject[] | null) || []).map((project) => mapProject(project)),
    naturalObservationProgress,
    steamRadar,
  }
}

async function loadExploringProjects(supabase: DbClient, userId: string) {
  const { data: explorationRows, error: explorationError } = await supabase
    .from('project_explorations')
    .select('project_id, last_activity_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_activity_at', { ascending: false })
    .limit(EXPLORING_PROJECT_LIMIT)

  if (explorationError) throw explorationError

  const projectIds = ((explorationRows as { project_id: number }[] | null) || []).map((row) => row.project_id)
  if (projectIds.length === 0) return []

  const { data: projectRows, error: projectError } = await supabase
    .from('projects')
    .select('*, profiles:author_id (display_name)')
    .in('id', projectIds)

  if (projectError) throw projectError

  const projectMap = new Map(
    (((projectRows as DbProject[] | null) || []).map((project) => [Number(project.id), project] as const)),
  )

  return projectIds
    .map((projectId) => projectMap.get(projectId))
    .filter((project): project is DbProject => Boolean(project))
    .map((project) => mapProject(project))
}

async function loadGrowthTasks(supabase: DbClient, userId: string) {
  const [{ data: profile, error: profileError }, { data: statsData, error: statsError }] = await Promise.all([
    supabase.from('profiles').select('bio').eq('id', userId).maybeSingle(),
    callRpc(supabase, 'get_user_stats_summary', { target_user_id: userId }),
  ])

  if (profileError) throw profileError
  if (statsError) throw statsError

  let claimedTaskIds = new Set<GrowthTaskId>()
  if (supabaseAdmin) {
    const { data: rewardRows, error: rewardError } = await supabaseAdmin
      .from('xp_logs')
      .select('resource_id')
      .eq('user_id', userId)
      .eq('action_type', GROWTH_TASK_REWARD_ACTION_TYPE)

    if (rewardError) throw rewardError

    claimedTaskIds = new Set(
      ((rewardRows as { resource_id: string | null }[] | null) || [])
        .map((row) => row.resource_id)
        .filter((resourceId): resourceId is GrowthTaskId => !!resourceId),
    )
  }

  return resolveGrowthTasks(
    toGrowthTaskInput({
      bio: (profile as { bio?: string | null } | null)?.bio ?? '',
      stats: (statsData as Partial<UserStats> | null) ?? undefined,
    }),
    claimedTaskIds,
  )
}

async function loadRecentObservations(supabase: DbClient, userId: string) {
  const { data, error } = await supabase
    .from('observation_events')
    .select('id, user_id, observed_at, created_at, location_name, latitude, longitude, habitat, media_urls, is_public, status, identification_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) throw error
  return (((data ?? []) as Database['public']['Tables']['observation_events']['Row'][]).map((row): ObservationEvent => ({
    id: row.id,
    userId: row.user_id,
    observedAt: row.observed_at,
    createdAt: row.created_at,
    locationName: row.location_name,
    latitude: row.latitude,
    longitude: row.longitude,
    habitat: row.habitat,
    mediaUrls: row.media_urls ?? [],
    isPublic: row.is_public,
    status: row.status,
    identificationStatus: row.identification_status as ObservationEvent['identificationStatus'],
    likesCount: 0,
    commentsCount: 0,
    species: [],
  })))
}

async function loadWeeklyTimelineEvents(supabase: DbClient, userId: string, weekStart: string) {
  const [
    projectsResponse,
    completionsResponse,
    challengeSubmissionsResponse,
    observationsResponse,
    badgesResponse,
    xpLogsResponse,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, created_at, status')
      .eq('author_id', userId)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
    supabase
      .from('completed_projects')
      .select('id, project_id, completed_at, status, record_kind')
      .eq('user_id', userId)
      .eq('record_kind', 'final')
      .gte('completed_at', weekStart)
      .order('completed_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
    supabase
      .from('challenge_submissions')
      .select('id, challenge_id, title, created_at, status')
      .eq('user_id', userId)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
    supabase
      .from('observation_events')
      .select('id, observed_at, created_at, habitat, status')
      .eq('user_id', userId)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
    supabase
      .from('user_badges')
      .select('badge_id, unlocked_at')
      .eq('user_id', userId)
      .gte('unlocked_at', weekStart)
      .order('unlocked_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
    supabase
      .from('xp_logs')
      .select('id, action_type, resource_id, xp_amount, created_at')
      .eq('user_id', userId)
      .gt('xp_amount', 0)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: false })
      .limit(TIMELINE_SOURCE_LIMIT),
  ])

  if (projectsResponse.error) throw projectsResponse.error
  if (completionsResponse.error) throw completionsResponse.error
  if (challengeSubmissionsResponse.error) throw challengeSubmissionsResponse.error
  if (observationsResponse.error) throw observationsResponse.error
  if (badgesResponse.error) throw badgesResponse.error
  if (xpLogsResponse.error) throw xpLogsResponse.error

  const completionRows = ((completionsResponse.data || []) as {
    id?: number | null
    project_id: number
    completed_at: string | null
    status?: string | null
  }[])
  const challengeSubmissionRows = ((challengeSubmissionsResponse.data || []) as {
    id: number
    challenge_id: number
    title: string | null
    created_at: string | null
    status?: string | null
  }[])
  const observationRows = ((observationsResponse.data || []) as {
    id: number
    observed_at: string | null
    created_at?: string | null
    habitat?: string | null
    status?: string | null
  }[])

  const [projectTitleMap, challengeTitleMap, speciesByObservationId] = await Promise.all([
    loadProjectTitleMap(supabase, uniqueNumbers(completionRows.map((row) => row.project_id))),
    loadChallengeTitleMap(supabase, uniqueNumbers(challengeSubmissionRows.map((row) => row.challenge_id))),
    loadObservationSpeciesForEvents(observationRows.map((row) => row.id)),
  ])

  const events = buildProfileTimelineEvents(
    {
      projects: ((projectsResponse.data || []) as {
        id: number
        title: string | null
        created_at: string | null
        status?: string | null
      }[]).map((row): ProjectTimelineRow => ({
        id: row.id,
        title: row.title,
        createdAt: row.created_at,
        status: row.status,
      })),
      completedProjects: completionRows.map((row): CompletedProjectTimelineRow => ({
        id: row.id,
        projectId: row.project_id,
        projectTitle: projectTitleMap.get(row.project_id),
        completedAt: row.completed_at,
        status: row.status,
      })),
      challengeSubmissions: challengeSubmissionRows.map((row): ChallengeSubmissionTimelineRow => ({
        id: row.id,
        challengeId: row.challenge_id,
        challengeTitle: challengeTitleMap.get(row.challenge_id),
        title: row.title,
        createdAt: row.created_at,
        status: row.status,
      })),
      observations: observationRows.map((row): ObservationTimelineRow => ({
        id: row.id,
        title: speciesByObservationId.get(row.id)?.[0]?.commonName,
        habitat: row.habitat,
        observedAt: row.observed_at,
        createdAt: row.created_at,
        status: row.status,
      })),
      badges: ((badgesResponse.data || []) as { badge_id: string; unlocked_at: string | null }[]).map(
        (row): BadgeTimelineRow => ({
          badgeId: row.badge_id,
          unlockedAt: row.unlocked_at,
        }),
      ),
      xpLogs: ((xpLogsResponse.data || []) as {
        id: string | number
        action_type: string
        resource_id: string | null
        xp_amount: number
        created_at: string | null
      }[]).map((row): XpLogTimelineRow => ({
        id: row.id,
        actionType: row.action_type,
        resourceId: row.resource_id,
        xpAmount: row.xp_amount,
        createdAt: row.created_at,
      })),
    },
    { limit: 12 },
  )

  return events.filter((event): event is ProfileTimelineEvent => Boolean(event))
}

function resolveNextStage(challenge: Challenge, progress: StageProgress[]) {
  const stages = challenge.stages ?? []
  if (!stages.length) return null

  const progressByStage = new Map(progress.map((item) => [item.stageIndex, item]))
  const completedStages = stages.reduce((count, _stage, index) => {
    return count + (progressByStage.get(index)?.status === 'completed' ? 1 : 0)
  }, 0)
  const nextStageIndex = stages.findIndex((_stage, index) => progressByStage.get(index)?.status !== 'completed')

  if (nextStageIndex < 0) return null

  return {
    nextStageIndex,
    nextStageTitle: stages[nextStageIndex]?.title || `完成第 ${nextStageIndex + 1} 步`,
    completedStages,
    totalStages: stages.length,
  }
}

async function loadInProgressPbl(supabase: DbClient, userId: string): Promise<WeeklyPlanPblProgress | null> {
  const { data: participants, error: participantsError } = await supabase
    .from('challenge_participants')
    .select('challenge_id, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
    .limit(12)

  if (participantsError) throw participantsError

  const challengeIds = uniqueNumbers(((participants as { challenge_id: number }[] | null) || []).map((row) => row.challenge_id))
  if (challengeIds.length === 0) return null

  const [challengesResponse, progressResponse, submissionsResponse] = await Promise.all([
    supabase.from('challenges').select('*').in('id', challengeIds).eq('status', 'active'),
    supabase
      .from('challenge_stage_progress')
      .select('*')
      .eq('user_id', userId)
      .in('challenge_id', challengeIds)
      .order('updated_at', { ascending: false }),
    supabase.from('challenge_submissions').select('challenge_id, status').eq('user_id', userId).in('challenge_id', challengeIds),
  ])

  if (challengesResponse.error) throw challengesResponse.error
  if (progressResponse.error) throw progressResponse.error
  if (submissionsResponse.error) throw submissionsResponse.error

  const approvedSubmissionIds = new Set(
    ((submissionsResponse.data as { challenge_id: number; status?: string | null }[] | null) || [])
      .filter((row) => row.status === 'approved')
      .map((row) => row.challenge_id),
  )
  const progressByChallenge = new Map<number, StageProgress[]>()

  for (const row of (progressResponse.data as StageProgressRow[] | null) || []) {
    const list = progressByChallenge.get(row.challenge_id) ?? []
    list.push(mapDbStageProgress(row))
    progressByChallenge.set(row.challenge_id, list)
  }

  const challengeMap = new Map(
    ((challengesResponse.data as ChallengeRow[] | null) || []).map((row) => [row.id, mapDbChallenge(row, true)] as const),
  )

  const candidates = challengeIds.flatMap((challengeId): WeeklyPlanPblProgress[] => {
      if (approvedSubmissionIds.has(challengeId)) return []
      const challenge = challengeMap.get(challengeId)
      if (!challenge) return []
      const progress = progressByChallenge.get(challengeId) ?? []
      const nextStage = resolveNextStage(challenge, progress)
      if (!nextStage) return []
      const latestProgressTime = progress.reduce((latest, item) => {
        const time = item.updatedAt ? Date.parse(item.updatedAt) : 0
        return Number.isNaN(time) ? latest : Math.max(latest, time)
      }, 0)
      return [{
        challenge,
        progress,
        updatedAt: latestProgressTime > 0 ? new Date(latestProgressTime).toISOString() : null,
        ...nextStage,
      }]
    })

  return candidates.sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))[0] ?? null
}

type LessonProgressWithCourse = {
  lesson_id: number
  completed_at: string | null
  updated_at: string
  course_lessons?: {
    id: number
    course_id: number
    title: string
    sort_order: number
    courses?: {
      id: number
      title: string
      status: string
    } | null
  } | null
}

function mapLessonRow(row: Record<string, unknown>): CourseLessonRow {
  return {
    id: row.id as number,
    course_id: row.course_id as number,
    title: row.title as string,
    lesson_type: (row.lesson_type as CourseLessonRow['lesson_type']) ?? 'scratch',
    content: (row.content as CourseLessonRow['content']) ?? {},
    steps: Array.isArray(row.steps) ? (row.steps as CourseLessonRow['steps']) : [],
    resources: Array.isArray(row.resources) ? (row.resources as CourseLessonRow['resources']) : [],
    starter_project_path: (row.starter_project_path as string) ?? null,
    sort_order: (row.sort_order as number) ?? 0,
    duration_minutes: (row.duration_minutes as number) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

async function loadInProgressCourse(supabase: DbClient, userId: string): Promise<WeeklyPlanCourseProgress | null> {
  const { data: recentProgress, error: recentError } = await supabase
    .from('user_lesson_progress')
    .select('lesson_id, completed_at, updated_at, course_lessons(id, course_id, title, sort_order, courses(id, title, status))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(8)

  if (recentError) throw recentError

  const recentRows = ((recentProgress as LessonProgressWithCourse[] | null) || []).filter((row) => {
    const course = row.course_lessons?.courses
    return course?.status === 'approved'
  })
  const selected = recentRows[0]
  const courseId = selected?.course_lessons?.course_id
  const courseTitle = selected?.course_lessons?.courses?.title
  if (!courseId || !courseTitle) return null

  const [lessonsResponse, progressResponse] = await Promise.all([
    supabase.from('course_lessons').select('*').eq('course_id', courseId).order('sort_order', { ascending: true }),
    supabase.from('user_lesson_progress').select('lesson_id, completed_at, updated_at').eq('user_id', userId),
  ])

  if (lessonsResponse.error) throw lessonsResponse.error
  if (progressResponse.error) throw progressResponse.error

  const lessons = ((lessonsResponse.data as Record<string, unknown>[] | null) || []).map(mapLessonRow)
  if (!lessons.length) return null

  const progressByLessonId = new Map(
    ((progressResponse.data as { lesson_id: number; completed_at: string | null; updated_at: string }[] | null) || [])
      .map((row) => [row.lesson_id, row] as const),
  )
  const completedLessons = lessons.filter((lesson) => progressByLessonId.get(lesson.id)?.completed_at).length
  const nextLesson =
    lessons.find((lesson) => !progressByLessonId.get(lesson.id)?.completed_at) ??
    lessons.find((lesson) => lesson.id === selected.lesson_id)

  if (!nextLesson || completedLessons >= lessons.length) return null

  return {
    courseId,
    courseTitle,
    lessonId: nextLesson.id,
    lessonTitle: nextLesson.title,
    completedLessons,
    totalLessons: lessons.length,
    updatedAt: selected.updated_at,
  }
}

export async function getWeeklyPlanData(supabase: DbClient, userId: string, now = new Date()): Promise<WeeklyPlan> {
  const weekStart = getWeeklyPlanWeekStart(now)
  const [
    summarySignals,
    exploringProjects,
    growthTasks,
    myObservations,
    profileTimelineEvents,
    inProgressPbl,
    inProgressCourse,
  ] = await Promise.all([
    loadProfileSummarySignals(supabase, userId),
    loadExploringProjects(supabase, userId),
    loadGrowthTasks(supabase, userId),
    loadRecentObservations(supabase, userId),
    loadWeeklyTimelineEvents(supabase, userId, weekStart),
    loadInProgressPbl(supabase, userId),
    loadInProgressCourse(supabase, userId),
  ])

  return buildWeeklyPlan({
    exploringProjects,
    steamRadar: summarySignals.steamRadar,
    myProjects: summarySignals.myProjects,
    myObservations,
    profileTimelineEvents,
    growthTasks,
    naturalObservationProgress: summarySignals.naturalObservationProgress,
    inProgressPbl,
    inProgressCourse,
    now,
  })
}

export async function getWeeklyPlanTutorSummary(supabase: DbClient, userId: string) {
  const plan = await getWeeklyPlanData(supabase, userId)
  return formatWeeklyPlanForTutor(plan)
}
