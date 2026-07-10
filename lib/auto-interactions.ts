import { generateAutoReply, type AutoReplyContext } from '@/lib/ai/auto-reply'
import { validateContentSafe } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import type { Database } from '@/lib/supabase/types'

export type AutoInteractionTargetType = 'project' | 'completion' | 'observation'
export type AutoInteractionActionType = 'reply' | 'like' | 'collection'

type AutoInteractionJob = Database['public']['Tables']['auto_interaction_jobs']['Row']
type AutoInteractionJobInsert = Database['public']['Tables']['auto_interaction_jobs']['Insert']

type TargetContext = {
  targetType: AutoInteractionTargetType
  targetId: number
  sourceAuthorId: string
  projectId?: number
  replyContext: AutoReplyContext
  notificationTitle?: string | null
}

type ActorProfile = {
  id: string
  display_name?: string | null
  avatar_url?: string | null
}

export type AutoInteractionEnqueueOptions = {
  replyRate?: number
  likeRate?: number
  collectionRate?: number
  random?: () => number
}

const MAX_JOB_ATTEMPTS = 3

function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }
  return supabaseAdmin
}

function getBooleanEnv(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return fallback
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase())
}

function getNumberEnv(name: string, fallback: number, min: number, max: number) {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  return Math.min(max, Math.max(min, raw))
}

function clampRate(value: number | undefined, fallback: number) {
  if (value == null) return fallback
  if (!Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function isAutoInteractionEnabled() {
  return getBooleanEnv('AUTO_INTERACTION_ENABLED', true)
}

export function sampleAutoInteractionDelayMs(random = Math.random) {
  const roll = random()
  const defaultBucket =
    roll < 0.10 ? [2, 5] :
    roll < 0.55 ? [5, 10] :
    roll < 0.80 ? [10, 25] :
    roll < 0.95 ? [25, 60] :
    [60, 90]

  const minLimit = getNumberEnv('AUTO_INTERACTION_MIN_DELAY_MINUTES', 2, 0.5, 1440)
  const maxLimit = Math.max(
    minLimit,
    getNumberEnv('AUTO_INTERACTION_MAX_DELAY_MINUTES', 90, minLimit, 1440),
  )
  const minMinutes = Math.min(maxLimit, Math.max(minLimit, defaultBucket[0]))
  const maxMinutes = Math.max(minMinutes, Math.min(maxLimit, defaultBucket[1]))
  const minutes = minMinutes + random() * (maxMinutes - minMinutes)
  return Math.round(minutes * 60_000)
}

export function sampleReplyCount(random = Math.random, replyRateOverride?: number) {
  const replyRate = clampRate(replyRateOverride, getNumberEnv('AUTO_REPLY_RATE', 0.8, 0, 1))
  if (random() >= replyRate) return 0

  const roll = random()
  if (roll < 0.6875) return 1
  if (roll < 0.9375) return 2
  return 3
}

export function sampleLikeCount(random = Math.random, likeRateOverride?: number) {
  const likeRate = clampRate(likeRateOverride, 1)
  if (likeRate < 1 && random() >= likeRate) return 0

  const roll = random()
  if (roll < 0.25) return 0
  if (roll < 0.60) return 1
  if (roll < 0.85) return 2
  if (roll < 0.95) return 3
  return random() < 0.5 ? 4 : 5
}

export function sampleCollectionCount(random = Math.random, collectionRateOverride?: number) {
  const collectionRate = clampRate(collectionRateOverride, 1)
  if (collectionRate < 1 && random() >= collectionRate) return 0

  const roll = random()
  if (roll < 0.70) return 0
  if (roll < 0.92) return 1
  if (roll < 0.99) return 2
  return 3
}

function shuffle<T>(items: readonly T[], random = Math.random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const value = copy[i]
    copy[i] = copy[j]
    copy[j] = value
  }
  return copy
}

function scheduleFor(index: number, random = Math.random) {
  const baseDelay = sampleAutoInteractionDelayMs(random)
  const stagger = index === 0 ? 0 : 30_000 + Math.round(random() * 210_000)
  return new Date(Date.now() + baseDelay + stagger).toISOString()
}

function isDuplicateError(error: unknown) {
  return (error as { code?: string } | null)?.code === '23505'
}

async function isAutoInteractionAccount(userId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('is_auto_interaction_account')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return Boolean((data as { is_auto_interaction_account?: boolean } | null)?.is_auto_interaction_account)
}

async function getActorProfile(actorUserId: string): Promise<ActorProfile | null> {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, is_auto_interaction_account')
    .eq('id', actorUserId)
    .maybeSingle()

  if (error) throw error
  const profile = data as (ActorProfile & { is_auto_interaction_account?: boolean }) | null
  if (!profile?.is_auto_interaction_account) return null
  return profile
}

async function getAvailableActors(sourceAuthorId: string) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_auto_interaction_account', true)
    .neq('id', sourceAuthorId)
    .limit(50)

  if (error) throw error
  return ((data || []) as Array<{ id: string }>).map((row) => row.id)
}

async function resolveTargetContext(
  targetType: AutoInteractionTargetType,
  targetId: number,
): Promise<TargetContext | null> {
  const supabase = getAdminClient()

  if (targetType === 'project') {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, description, category, author_id, status')
      .eq('id', targetId)
      .maybeSingle()

    if (error) throw error
    const project = data as {
      id: number
      title?: string | null
      description?: string | null
      category?: string | null
      author_id?: string | null
      status?: string | null
    } | null

    if (!project || project.status !== 'approved' || !project.author_id) return null
    if (await isAutoInteractionAccount(project.author_id)) return null

    return {
      targetType,
      targetId,
      sourceAuthorId: project.author_id,
      projectId: project.id,
      notificationTitle: project.title,
      replyContext: {
        targetType,
        title: project.title,
        description: project.description,
        category: project.category,
      },
    }
  }

  if (targetType === 'completion') {
    const { data, error } = await supabase
      .from('completed_projects')
      .select('id, user_id, project_id, course_lesson_id, notes, is_public, status, record_type, stage_label')
      .eq('id', targetId)
      .maybeSingle()

    if (error) throw error
    const completion = data as {
      id: number
      user_id: string
      project_id: number | null
      course_lesson_id: number | null
      notes?: string | null
      is_public?: boolean | null
      status?: string | null
      record_type?: string | null
      stage_label?: string | null
    } | null

    if (!completion || completion.status !== 'approved' || completion.is_public !== true) return null
    if (await isAutoInteractionAccount(completion.user_id)) return null

    let sourceTitle: string | null = null
    if (completion.project_id) {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('title, status')
        .eq('id', completion.project_id)
        .maybeSingle()
      if (projectError) throw projectError
      sourceTitle = (projectData as { title?: string | null } | null)?.title ?? null
    } else if (completion.course_lesson_id) {
      const { data: lessonData, error: lessonError } = await supabase
        .from('course_lessons')
        .select('title')
        .eq('id', completion.course_lesson_id)
        .maybeSingle()
      if (lessonError) throw lessonError
      sourceTitle = (lessonData as { title?: string | null } | null)?.title ?? null
    }

    return {
      targetType,
      targetId,
      sourceAuthorId: completion.user_id,
      projectId: completion.project_id ?? undefined,
      notificationTitle: sourceTitle,
      replyContext: {
        targetType,
        title: sourceTitle,
        notes: completion.notes,
        recordType: completion.record_type,
        stageLabel: completion.stage_label,
      },
    }
  }

  const { data, error } = await supabase
    .from('observation_events')
    .select('id, user_id, nature_topic, location_name, habitat, weather, notes, is_public, status')
    .eq('id', targetId)
    .maybeSingle()

  if (error) throw error
  const observation = data as {
    id: number
    user_id: string
    nature_topic?: string | null
    location_name?: string | null
    habitat?: string | null
    weather?: string | null
    notes?: string | null
    is_public?: boolean | null
    status?: string | null
  } | null

  if (!observation || observation.status !== 'approved' || observation.is_public !== true) return null
  if (await isAutoInteractionAccount(observation.user_id)) return null

  return {
    targetType,
    targetId,
    sourceAuthorId: observation.user_id,
    replyContext: {
      targetType,
      natureTopic: observation.nature_topic,
      locationName: observation.location_name,
      habitat: observation.habitat,
      weather: observation.weather,
      notes: observation.notes,
    },
  }
}

function pickJobsForAction(params: {
  context: TargetContext
  actors: string[]
  actionType: AutoInteractionActionType
  count: number
  indexOffset: number
}) {
  const { context, actors, actionType, count, indexOffset } = params
  return shuffle(actors)
    .slice(0, Math.min(count, actors.length))
    .map<AutoInteractionJobInsert>((actorUserId, index) => ({
      target_type: context.targetType,
      target_id: context.targetId,
      source_author_id: context.sourceAuthorId,
      actor_user_id: actorUserId,
      action_type: actionType,
      status: 'queued',
      scheduled_for: scheduleFor(indexOffset + index),
    }))
}

export async function enqueueAutoInteractionsForTarget(
  targetType: AutoInteractionTargetType,
  targetId: number,
  options: AutoInteractionEnqueueOptions = {},
) {
  if (!isAutoInteractionEnabled()) {
    return { queued: 0, skipped: 'disabled' as const }
  }

  const supabase = getAdminClient()
  const context = await resolveTargetContext(targetType, targetId)
  if (!context) {
    return { queued: 0, skipped: 'target_not_eligible' as const }
  }

  const { data: existingJob, error: existingError } = await supabase
    .from('auto_interaction_jobs')
    .select('id')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingJob) {
    return { queued: 0, skipped: 'already_queued' as const }
  }

  const actors = await getAvailableActors(context.sourceAuthorId)
  if (actors.length === 0) {
    return { queued: 0, skipped: 'no_actor' as const }
  }

  const random = options.random ?? Math.random
  const replyCount = sampleReplyCount(random, options.replyRate)
  const likeCount = sampleLikeCount(random, options.likeRate)
  const collectionCount =
    targetType === 'observation' ? 0 : sampleCollectionCount(random, options.collectionRate)

  const jobs = [
    ...pickJobsForAction({ context, actors, actionType: 'reply', count: replyCount, indexOffset: 0 }),
    ...pickJobsForAction({ context, actors, actionType: 'like', count: likeCount, indexOffset: replyCount }),
    ...pickJobsForAction({
      context,
      actors,
      actionType: 'collection',
      count: collectionCount,
      indexOffset: replyCount + likeCount,
    }),
  ]

  if (jobs.length === 0) {
    return { queued: 0, skipped: 'sampled_zero_actions' as const }
  }

  const { data, error } = await supabase
    .from('auto_interaction_jobs')
    .upsert(jobs as never, {
      onConflict: 'target_type,target_id,actor_user_id,action_type',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) throw error
  return { queued: data?.length ?? 0 }
}

async function insertProjectNotification(params: {
  projectId: number
  projectAuthorId: string
  actor: ActorProfile
  type: 'reply' | 'like'
  relatedType: 'comment' | 'project'
  relatedId: number
  projectTitle?: string | null
}) {
  if (params.projectAuthorId === params.actor.id) return

  const supabase = getAdminClient()
  const actorName = params.actor.display_name || '用户'
  const actorAvatar = params.actor.avatar_url || getDefaultAvatarPath(params.actor.id)
  const title = params.projectTitle || '项目'
  const content =
    params.type === 'like'
      ? `${actorName} 赞了你的项目「${title}」`
      : `${actorName} 评论了你的项目《${title}》`

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.projectAuthorId,
      type: params.type,
      content,
      related_type: params.relatedType,
      related_id: params.relatedId,
      project_id: params.projectId,
      from_user_id: params.actor.id,
      from_username: actorName,
      from_avatar: actorAvatar,
    } as never)

  if (error) throw error
}

async function performReply(job: AutoInteractionJob, context: TargetContext, actor: ActorProfile) {
  const supabase = getAdminClient()
  const generated = job.generated_content || await generateAutoReply(context.replyContext)
  const content = validateContentSafe(generated, '自动回复内容')

  if (content.length > 60) {
    throw new Error('Generated auto reply is too long')
  }

  if (context.targetType === 'project') {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        project_id: context.targetId,
        author_id: actor.id,
        content,
        parent_id: null,
        reply_to_user_id: null,
        reply_to_username: null,
        image_url: null,
      } as never)
      .select('id')
      .single()

    if (error) throw error
    const commentId = Number((data as { id: number }).id)

    await insertProjectNotification({
      projectId: context.targetId,
      projectAuthorId: context.sourceAuthorId,
      actor,
      type: 'reply',
      relatedType: 'comment',
      relatedId: commentId,
      projectTitle: context.notificationTitle,
    })

    return content
  }

  if (context.targetType === 'completion') {
    const { error } = await supabase
      .from('completion_comments')
      .insert({
        completed_project_id: context.targetId,
        author_id: actor.id,
        content,
        parent_id: null,
        reply_to_user_id: null,
        reply_to_username: null,
      } as never)

    if (error) throw error
    return content
  }

  const { error } = await supabase
    .from('observation_comments')
    .insert({
      observation_event_id: context.targetId,
      author_id: actor.id,
      content,
      parent_id: null,
      reply_to_user_id: null,
      reply_to_username: null,
    } as never)

  if (error) throw error

  const { error: rpcError } = await callRpc(supabase, 'increment_observation_comments', {
    target_observation_id: context.targetId,
  })
  if (rpcError) throw rpcError

  return content
}

async function performLike(job: AutoInteractionJob, context: TargetContext, actor: ActorProfile) {
  const supabase = getAdminClient()

  if (context.sourceAuthorId === actor.id) return

  if (context.targetType === 'project') {
    const { data, error } = await supabase
      .from('likes')
      .insert({ user_id: actor.id, project_id: context.targetId } as never)
      .select('user_id')

    if (error) {
      if (isDuplicateError(error)) return
      throw error
    }

    if (data && data.length > 0) {
      const { error: rpcError } = await callRpc(supabase, 'increment_project_likes', {
        project_id: context.targetId,
      })
      if (rpcError) throw rpcError

      await insertProjectNotification({
        projectId: context.targetId,
        projectAuthorId: context.sourceAuthorId,
        actor,
        type: 'like',
        relatedType: 'project',
        relatedId: context.targetId,
        projectTitle: context.notificationTitle,
      })
    }
    return
  }

  if (context.targetType === 'completion') {
    const { error } = await supabase
      .from('completion_likes')
      .insert({ user_id: actor.id, completed_project_id: context.targetId } as never)

    if (error && !isDuplicateError(error)) throw error
    return
  }

  const { data, error } = await supabase
    .from('observation_likes')
    .insert({ user_id: actor.id, observation_event_id: context.targetId } as never)
    .select('user_id')

  if (error) {
    if (isDuplicateError(error)) return
    throw error
  }

  if (data && data.length > 0) {
    const { error: rpcError } = await callRpc(supabase, 'increment_observation_likes', {
      target_observation_id: context.targetId,
    })
    if (rpcError) throw rpcError
  }
}

async function performCollection(context: TargetContext, actor: ActorProfile) {
  if (!context.projectId || context.sourceAuthorId === actor.id) return

  const supabase = getAdminClient()
  const { error } = await supabase
    .from('collections')
    .insert({ user_id: actor.id, project_id: context.projectId } as never)

  if (error && !isDuplicateError(error)) throw error
}

async function claimJob(job: AutoInteractionJob) {
  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('auto_interaction_jobs')
    .update({
      status: 'running',
      attempt_count: job.attempt_count + 1,
      error_message: null,
    } as never)
    .eq('id', job.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle()

  if (error) throw error
  return data as AutoInteractionJob | null
}

async function markJobDone(jobId: number, generatedContent?: string | null) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('auto_interaction_jobs')
    .update({
      status: 'done',
      generated_content: generatedContent ?? null,
      error_message: null,
    } as never)
    .eq('id', jobId)

  if (error) throw error
}

async function markJobSkipped(jobId: number, reason: string) {
  const supabase = getAdminClient()
  const { error } = await supabase
    .from('auto_interaction_jobs')
    .update({ status: 'skipped', error_message: reason } as never)
    .eq('id', jobId)

  if (error) throw error
}

async function markJobFailed(job: AutoInteractionJob, error: unknown) {
  const supabase = getAdminClient()
  const message = error instanceof Error ? error.message : String(error)
  const final = job.attempt_count >= MAX_JOB_ATTEMPTS
  const retryDelayMs = Math.min(60, 10 * job.attempt_count) * 60_000

  const { error: updateError } = await supabase
    .from('auto_interaction_jobs')
    .update({
      status: final ? 'error' : 'queued',
      error_message: message.slice(0, 1000),
      scheduled_for: final ? job.scheduled_for : new Date(Date.now() + retryDelayMs).toISOString(),
    } as never)
    .eq('id', job.id)

  if (updateError) throw updateError
}

async function runAutoInteractionJob(job: AutoInteractionJob) {
  const claimed = await claimJob(job)
  if (!claimed) return { status: 'skipped' as const, reason: 'not_claimed' }

  try {
    const context = await resolveTargetContext(
      claimed.target_type as AutoInteractionTargetType,
      Number(claimed.target_id),
    )
    if (!context) {
      await markJobSkipped(claimed.id, 'target_not_eligible')
      return { status: 'skipped' as const, reason: 'target_not_eligible' }
    }

    if (context.sourceAuthorId !== claimed.source_author_id) {
      await markJobSkipped(claimed.id, 'source_author_changed')
      return { status: 'skipped' as const, reason: 'source_author_changed' }
    }

    const actor = await getActorProfile(claimed.actor_user_id)
    if (!actor || actor.id === context.sourceAuthorId) {
      await markJobSkipped(claimed.id, 'actor_not_eligible')
      return { status: 'skipped' as const, reason: 'actor_not_eligible' }
    }

    let generatedContent: string | null = claimed.generated_content

    if (claimed.action_type === 'reply') {
      generatedContent = await performReply(claimed, context, actor)
    } else if (claimed.action_type === 'like') {
      await performLike(claimed, context, actor)
    } else if (claimed.action_type === 'collection') {
      await performCollection(context, actor)
    } else {
      await markJobSkipped(claimed.id, 'unsupported_action')
      return { status: 'skipped' as const, reason: 'unsupported_action' }
    }

    await markJobDone(claimed.id, generatedContent)
    return { status: 'done' as const }
  } catch (error) {
    logger.error(error, { context: 'runAutoInteractionJob', jobId: claimed.id })
    await markJobFailed(claimed, error)
    return { status: 'error' as const }
  }
}

export async function runDueAutoInteractions(limit = 20) {
  if (!isAutoInteractionEnabled()) {
    return { processed: 0, done: 0, skipped: 0, errors: 0, disabled: true }
  }

  const supabase = getAdminClient()
  const requestedLimit = Number.isFinite(limit) ? limit : 20
  const safeLimit = Math.min(50, Math.max(1, Math.floor(requestedLimit)))
  const { data, error } = await supabase
    .from('auto_interaction_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(safeLimit)

  if (error) throw error

  const jobs = (data || []) as AutoInteractionJob[]
  let done = 0
  let skipped = 0
  let errors = 0

  for (const job of jobs) {
    const result = await runAutoInteractionJob(job)
    if (result.status === 'done') done += 1
    else if (result.status === 'skipped') skipped += 1
    else errors += 1
  }

  return {
    processed: jobs.length,
    done,
    skipped,
    errors,
    disabled: false,
  }
}
