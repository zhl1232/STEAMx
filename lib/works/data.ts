import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logger'
import { mapDbCompletion, type Work, type WorkSource } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/lib/supabase/types'

type DbClient = SupabaseClient<Database>
type WorkRow = Database['public']['Tables']['completed_projects']['Row']

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
      ? client.from('projects').select('id, title, image_url').in('id', projectIds)
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
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return (await hydrateWorks(client, [data as WorkRow]))[0] ?? null
}

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

  let query = client
    .from('completed_projects')
    .select('*', { count: 'exact' })
    .eq('user_id', args.userId)
    .eq('record_kind', 'final')
    .order('completed_at', { ascending: false })
    .range(from, to)

  if (args.publicOnly) {
    query = query.eq('status', 'approved').eq('is_public', true)
  }

  const { data, error, count } = await query
  if (error) throw error
  const total = count ?? data?.length ?? 0
  return {
    works: await hydrateWorks(client, (data || []) as WorkRow[]),
    total,
    hasMore: total > to + 1,
  }
}
