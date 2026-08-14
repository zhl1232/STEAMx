import type { SupabaseClient } from '@supabase/supabase-js'

import { loadObservationSpeciesForEvents } from '@/lib/api/nature-observation-events'
import { logger } from '@/lib/logger'
import { mapDbCompletion, type Work, type WorkSource } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/supabase/types'
import type { WorkJourneyRecord, WorkJourneyResult } from '@/lib/works/types'

type DbClient = SupabaseClient<Database>
type WorkRow = Database['public']['Tables']['completed_projects']['Row']

const WORK_JOURNEY_LIMIT = 50

type ProfileRow = {
  id: string
  display_name: string | null
  avatar_url: string | null
  equipped_avatar_frame_id: string | null
  equipped_name_color_id?: string | null
  xp: number | null
}

type ProjectSourceRow = {
  id: number
  title: string
  image_url: string | null
}

type LessonSourceRow = {
  id: number
  course_id: number
  title: string
  content: Json | null
  courses?: { id: number; title: string; image_url: string | null } | null
}

function lessonFinishedImage(content: Json | null): string | undefined {
  if (!content || Array.isArray(content) || typeof content !== 'object') return undefined
  const building3d = (content as Record<string, Json | undefined>).building3d
  if (!building3d || Array.isArray(building3d) || typeof building3d !== 'object') return undefined
  const image = (building3d as Record<string, Json | undefined>).finishedImageUrl
  return typeof image === 'string' && image.trim() ? image : undefined
}

async function hydrateWorks(client: DbClient, rows: WorkRow[]): Promise<Work[]> {
  if (rows.length === 0) return []

  const userIds = [...new Set(rows.map((row) => row.user_id))]
  const projectIds = [...new Set(rows.flatMap((row) => row.project_id ? [row.project_id] : []))]
  const lessonIds = [...new Set(rows.flatMap((row) => row.course_lesson_id ? [row.course_lesson_id] : []))]
  const workIds = rows.map((row) => row.id)

  const [profilesResult, projectsResult, lessonsResult, commentsResult] = await Promise.all([
    client
      .from('profiles')
      .select('id, display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, xp')
      .in('id', userIds),
    projectIds.length
      ? client
          .from('projects')
          .select('id, title, image_url')
          .eq('status', 'approved')
          .eq('moderation_state', 'approved')
          .in('id', projectIds)
      : Promise.resolve({ data: [] as ProjectSourceRow[], error: null }),
    lessonIds.length
      ? client
          .from('course_lessons')
          .select('id, course_id, title, content, courses(id, title, image_url)')
          .in('id', lessonIds)
      : Promise.resolve({ data: [] as LessonSourceRow[], error: null }),
    client.rpc('get_completion_comments_count_batch', { p_completion_ids: workIds }),
  ])

  if (profilesResult.error) logger.error('Failed to hydrate work authors', { error: profilesResult.error })
  if (projectsResult.error) logger.error('Failed to hydrate work projects', { error: projectsResult.error })
  if (lessonsResult.error) logger.error('Failed to hydrate work lessons', { error: lessonsResult.error })
  if (commentsResult.error) logger.error('Failed to hydrate work comment counts', { error: commentsResult.error })

  const profiles = new Map(
    ((profilesResult.data || []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  )
  const projects = new Map(
    ((projectsResult.data || []) as ProjectSourceRow[]).map((project) => [project.id, project]),
  )
  const lessons = new Map(
    ((lessonsResult.data || []) as unknown as LessonSourceRow[]).map((lesson) => [lesson.id, lesson]),
  )
  const commentCounts = new Map(
    ((commentsResult.data || []) as { completed_project_id: number; comment_count: number }[])
      .map((row) => [Number(row.completed_project_id), Number(row.comment_count)]),
  )

  return rows.map((row) => {
    const profile = profiles.get(row.user_id)
    let source: WorkSource | undefined

    if (row.project_id) {
      const project = projects.get(row.project_id)
      if (project) {
        source = {
          type: 'project',
          id: project.id,
          title: project.title,
          href: `/project/${project.id}/records?highlight=${row.id}`,
          image: project.image_url || undefined,
        }
      }
    } else if (row.course_lesson_id) {
      const lesson = lessons.get(row.course_lesson_id)
      const course = lesson?.courses
      if (lesson && course) {
        source = {
          type: 'course_lesson',
          id: lesson.id,
          title: lesson.title,
          href: `/courses/${course.id}/lessons/${lesson.id}?view=works`,
          image: lessonFinishedImage(lesson.content) || course.image_url || undefined,
          courseId: course.id,
          courseTitle: course.title,
        }
      }
    }

    return {
      ...mapDbCompletion({
        ...row,
        profiles: profile || null,
      }),
      source,
      commentsCount: commentCounts.get(row.id) ?? 0,
    }
  })
}

export async function getWorksByIds(client: DbClient, ids: number[]): Promise<Work[]> {
  if (ids.length === 0) return []
  const { data, error } = await client
    .from('completed_projects')
    .select('*')
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .in('id', ids)

  if (error) throw error
  const byId = new Map(((data || []) as WorkRow[]).map((row) => [row.id, row]))
  const ordered = ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
  return hydrateWorks(client, ordered)
}

export async function getTrendingWorks(limit = 8, offset = 0): Promise<{
  works: Work[]
  nextOffset: number
  hasMore: boolean
}> {
  const client = await createClient()
  const fetchLimit = Math.min(24, Math.max(1, limit))
  const { data, error } = await client.rpc('get_trending_works', {
    p_limit: fetchLimit + 1,
    p_offset: Math.max(0, offset),
  })
  if (error) throw error

  const rankedIds = ((data || []) as { work_id: number }[]).map((row) => Number(row.work_id))
  const hasMore = rankedIds.length > fetchLimit
  const ids = rankedIds.slice(0, fetchLimit)
  return {
    works: await getWorksByIds(client, ids),
    nextOffset: Math.max(0, offset) + ids.length,
    hasMore,
  }
}

export async function getLessonWorks(
  lessonId: number,
  limit = 24,
): Promise<Work[]> {
  const client = await createClient()
  const { data, error } = await client
    .from('completed_projects')
    .select('*')
    .eq('course_lesson_id', lessonId)
    .eq('record_kind', 'final')
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .order('likes_count', { ascending: false })
    .order('completed_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return hydrateWorks(client, (data || []) as WorkRow[])
}

export async function getWorkById(id: number): Promise<Work | null> {
  const client = await createClient()
  const { data, error } = await client
    .from('completed_projects')
    .select('*')
    .eq('id', id)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return (await hydrateWorks(client, [data as WorkRow]))[0] ?? null
}

function workToJourneyRecord(work: Work): WorkJourneyRecord {
  return {
    id: work.id,
    completedAt: work.completedAt,
    completedAtIso: work.completedAtIso,
    proofImages: work.proofImages,
    proofCaptions: work.proofCaptions,
    proofVideoUrl: work.proofVideoUrl,
    notes: work.notes,
    recordKind: work.recordKind,
    recordType: work.recordType,
    stageLabel: work.stageLabel,
  }
}

function rowToJourneyRecord(row: WorkRow): WorkJourneyRecord {
  return workToJourneyRecord(mapDbCompletion(row))
}

/** Public, approved records from the same project exploration as any selected record. */
export async function getWorkJourneyResult(work: Work): Promise<WorkJourneyResult> {
  if (work.source?.type !== 'project') {
    return { records: [], total: 0, hasMore: false }
  }

  // Legacy rows have no reliable session key. Showing only the selected row is
  // safer than joining every historical record for this user/project.
  if (work.explorationId == null) {
    return { records: [workToJourneyRecord(work)], total: 1, hasMore: false }
  }

  const client = await createClient()
  const { data, error, count } = await client
    .from('completed_projects')
    .select('*', { count: 'exact' })
    .eq('user_id', work.userId)
    .eq('project_id', work.source.id)
    .eq('exploration_id', work.explorationId)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .order('completed_at', { ascending: false })
    .range(0, WORK_JOURNEY_LIMIT - 1)
  if (error) throw error

  const records = ((data || []) as WorkRow[]).map(rowToJourneyRecord)
  if (!records.some((record) => record.id === work.id)) {
    records.push(workToJourneyRecord(work))
  }

  records.sort((first, second) => (second.completedAtIso || '').localeCompare(first.completedAtIso || ''))
  if (records.length > WORK_JOURNEY_LIMIT) {
    const removableIndex = records.findLastIndex((record) => record.id !== work.id)
    records.splice(removableIndex >= 0 ? removableIndex : records.length - 1, 1)
  }

  records.sort((first, second) => (first.completedAtIso || '').localeCompare(second.completedAtIso || ''))
  const total = count ?? records.length
  return { records, total, hasMore: total > records.length }
}

/** Backward-compatible array form for callers that only need the timeline rows. */
export async function getWorkJourney(work: Work): Promise<WorkJourneyRecord[]> {
  return (await getWorkJourneyResult(work)).records
}

type ChallengeSubmissionRow = Database['public']['Tables']['challenge_submissions']['Row'] & {
  challenges?: { id: number; title: string; image_url: string | null } | null
}

type ObservationRow = Database['public']['Tables']['observation_events']['Row'] & {
  likes_count?: number | null
  comments_count?: number | null
}

function toWorkStatus(status: string | null | undefined): Work['status'] {
  return status === 'approved' || status === 'pending' || status === 'rejected' ? status : undefined
}

/** 与 mapDbCompletion 的展示口径保持一致，合并列表里日期格式才不会两种样子 */
function authorFields(author: ProfileRow | undefined) {
  return {
    author: author?.display_name || 'Unknown',
    avatar: author?.avatar_url || undefined,
    avatarFrameId: author?.equipped_avatar_frame_id ?? undefined,
    nameColorId: author?.equipped_name_color_id ?? undefined,
    authorLevel: author?.xp != null ? Math.floor(Math.sqrt(Number(author.xp) / 100)) + 1 : undefined,
  }
}

function toDisplayDate(iso: string) {
  return new Date(iso || '').toLocaleDateString('zh-CN')
}

function challengeSubmissionToWork(row: ChallengeSubmissionRow, author: ProfileRow | undefined): Work {
  const challenge = row.challenges
  return {
    id: row.id,
    userId: row.user_id,
    projectId: null,
    source: {
      type: 'challenge',
      id: row.challenge_id,
      title: row.title,
      href: `/pbl/${row.challenge_id}`,
      image: row.proof_images?.[0] || challenge?.image_url || undefined,
      challengeTitle: challenge?.title || '项目挑战',
    },
    ...authorFields(author),
    completedAt: toDisplayDate(row.created_at),
    completedAtIso: row.created_at,
    proofImages: row.proof_images || [],
    proofCaptions: row.proof_captions || undefined,
    proofVideoUrl: row.proof_video_url || undefined,
    notes: row.notes || undefined,
    isPublic: row.is_public ?? true,
    likes: 0,
    coins: 0,
    status: toWorkStatus(row.status),
    rejectionReason: row.rejection_reason || undefined,
    recordKind: 'final',
  }
}

function observationToWork(
  row: ObservationRow,
  author: ProfileRow | undefined,
  speciesName: string | undefined,
): Work {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: null,
    source: {
      type: 'observation',
      id: row.id,
      title: speciesName || row.location_name || '自然观察',
      href: `/nature/observations/${row.id}`,
      image: row.media_urls?.[0] || undefined,
      locationName: row.location_name || undefined,
    },
    ...authorFields(author),
    completedAt: toDisplayDate(row.observed_at || row.created_at),
    completedAtIso: row.created_at,
    commentsCount: row.comments_count ?? 0,
    proofImages: row.media_urls || [],
    notes: row.notes || undefined,
    isPublic: row.is_public ?? true,
    likes: row.likes_count ?? 0,
    coins: 0,
    status: toWorkStatus(row.status),
    recordKind: 'final',
  }
}

/**
 * 一个人的全部产出：项目作品、课时作品、挑战作品、自然观察。
 * 四个来源各取当前页所需的前 N 条，合并后按时间排序再切片。
 */
export async function getUserWorks(args: {
  userId: string
  page?: number
  pageSize?: number
  publicOnly?: boolean
}): Promise<{ works: Work[]; total: number; hasMore: boolean }> {
  const client = await createClient()
  const page = Math.max(0, args.page ?? 0)
  const pageSize = Math.min(24, Math.max(1, args.pageSize ?? 12))
  const from = page * pageSize
  const to = from + pageSize - 1
  const headSize = to + 1

  const publicFilters = { status: 'approved', is_public: true, moderation_state: 'approved' }

  let completionsQuery = client
    .from('completed_projects')
    .select('*', { count: 'exact' })
    .eq('user_id', args.userId)
    .eq('record_kind', 'final')
    .order('completed_at', { ascending: false })
    .range(0, headSize - 1)
  let submissionsQuery = client
    .from('challenge_submissions')
    .select('*, challenges(id, title, image_url)', { count: 'exact' })
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .range(0, headSize - 1)
  let observationsQuery = client
    .from('observation_events')
    .select('*', { count: 'exact' })
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .range(0, headSize - 1)

  if (args.publicOnly) {
    completionsQuery = completionsQuery.match(publicFilters)
    submissionsQuery = submissionsQuery.match(publicFilters)
    observationsQuery = observationsQuery.match(publicFilters)
  }

  const [completionsResult, submissionsResult, observationsResult] = await Promise.all([
    completionsQuery,
    submissionsQuery,
    observationsQuery,
  ])

  if (completionsResult.error) throw completionsResult.error
  if (submissionsResult.error) logger.error('Failed to load challenge submissions for works', { error: submissionsResult.error })
  if (observationsResult.error) logger.error('Failed to load observations for works', { error: observationsResult.error })

  const submissionRows = (submissionsResult.data || []) as unknown as ChallengeSubmissionRow[]
  const observationRows = (observationsResult.data || []) as unknown as ObservationRow[]

  const [completions, author, speciesByEvent] = await Promise.all([
    hydrateWorks(client, (completionsResult.data || []) as WorkRow[]),
    submissionRows.length || observationRows.length
      ? client
          .from('profiles')
          .select('id, display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, xp')
          .eq('id', args.userId)
          .maybeSingle()
          .then(({ data }) => (data as ProfileRow | null) ?? undefined)
      : Promise.resolve(undefined),
    observationRows.length
      ? loadObservationSpeciesForEvents(observationRows.map((row) => row.id))
      : Promise.resolve(new Map<number, { commonName: string }[]>()),
  ])

  const merged = [
    ...completions,
    ...submissionRows.map((row) => challengeSubmissionToWork(row, author)),
    ...observationRows.map((row) =>
      observationToWork(row, author, speciesByEvent.get(row.id)?.[0]?.commonName),
    ),
  ].sort((first, second) => (second.completedAtIso || '').localeCompare(first.completedAtIso || ''))

  const total = (completionsResult.count ?? 0) + (submissionsResult.count ?? 0) + (observationsResult.count ?? 0)
  return {
    works: merged.slice(from, to + 1),
    total,
    hasMore: total > to + 1,
  }
}
