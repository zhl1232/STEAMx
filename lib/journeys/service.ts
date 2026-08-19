import type { SupabaseClient } from '@supabase/supabase-js'

import { PermissionError } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import type { Database } from '@/lib/supabase/types'
import {
  getJourneySourceId,
  mapJourney,
  type Journey,
  type JourneyAnchorType,
  type JourneyRecord,
  type JourneyRecordRow,
  type JourneyRecordStatus,
  type JourneyRecordVisibility,
  type JourneyRecordWrite,
  type JourneyRow,
  type JourneyStatus,
  type JourneySourceType,
} from './types'

type JourneyClient = SupabaseClient<Database>

type SourceMeta = {
  id: number
  title: string | null
  status?: string | null
  moderation_state?: string | null
  author_id?: string | null
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505')
}

function normalizeNullableText(value: string | null | undefined) {
  if (value == null) return null
  const normalized = value.trim()
  return normalized || null
}

async function loadSource(
  client: JourneyClient,
  sourceType: JourneySourceType,
  sourceId: number,
): Promise<SourceMeta | null> {
  if (sourceType === 'project') {
    const { data, error } = await client
      .from('projects')
      .select('id, title, status, moderation_state, author_id')
      .eq('id', sourceId)
      .maybeSingle()
    if (error) throw error
    return data as SourceMeta | null
  }

  const { data, error } = await client
    .from('challenges')
    .select('id, title, status')
    .eq('id', sourceId)
    .maybeSingle()
  if (error) throw error
  return data as SourceMeta | null
}

function applySourceFilter<T extends { eq: (column: string, value: number) => T }>(
  query: T,
  sourceType: JourneySourceType,
  sourceId: number,
) {
  return sourceType === 'project'
    ? query.eq('project_id', sourceId)
    : query.eq('challenge_id', sourceId)
}

export async function getJourneyById(
  client: JourneyClient,
  journeyId: number,
  userId?: string,
): Promise<Journey | null> {
  let query = client.from('project_journeys').select('*').eq('id', journeyId)
  if (userId) query = query.eq('user_id', userId)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data ? mapJourney(data as JourneyRow) : null
}

export async function getActiveJourney(
  client: JourneyClient,
  userId: string,
  sourceType: JourneySourceType,
  sourceId: number,
): Promise<Journey | null> {
  let query = client
    .from('project_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('source_type', sourceType)
    .eq('status', 'active')
  query = applySourceFilter(query, sourceType, sourceId)

  const { data, error } = await query.order('last_activity_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? mapJourney(data as JourneyRow) : null
}

export async function getLatestJourney(
  client: JourneyClient,
  userId: string,
  sourceType: JourneySourceType,
  sourceId: number,
): Promise<Journey | null> {
  let query = client
    .from('project_journeys')
    .select('*')
    .eq('user_id', userId)
    .eq('source_type', sourceType)
  query = applySourceFilter(query, sourceType, sourceId)

  const { data, error } = await query.order('attempt_no', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? mapJourney(data as JourneyRow) : null
}

export async function ensureJourney(
  client: JourneyClient,
  {
    userId,
    sourceType,
    sourceId,
    projectGoal,
  }: {
    userId: string
    sourceType: JourneySourceType
    sourceId: number
    projectGoal?: string | null
  },
): Promise<Journey> {
  const source = await loadSource(client, sourceType, sourceId)
  if (!source) {
    throw new ValidationError(sourceType === 'project' ? '项目不存在' : '挑战不存在')
  }

  if (sourceType === 'challenge' && source.status !== 'active') {
    throw new ValidationError('当前挑战已结束，不能开始新的项目尝试')
  }

  if (
    sourceType === 'project'
    && (source.status !== 'approved' || source.moderation_state !== 'approved')
    && source.author_id !== userId
  ) {
    throw new ValidationError('项目尚未通过审核，暂时不能开始项目尝试')
  }

  const active = await getActiveJourney(client, userId, sourceType, sourceId)
  if (active) {
    if (projectGoal !== undefined && normalizeNullableText(projectGoal) !== active.project_goal) {
      const { data, error } = await client
        .from('project_journeys')
        .update({ project_goal: normalizeNullableText(projectGoal), updated_at: new Date().toISOString() })
        .eq('id', active.id)
        .eq('user_id', userId)
        .select('*')
        .single()
      if (error) throw error
      return mapJourney(data as JourneyRow)
    }
    return active
  }

  const latest = await getLatestJourney(client, userId, sourceType, sourceId)
  const now = new Date().toISOString()
  const insert = {
    user_id: userId,
    source_type: sourceType,
    project_id: sourceType === 'project' ? sourceId : null,
    challenge_id: sourceType === 'challenge' ? sourceId : null,
    title: source.title,
    project_goal: normalizeNullableText(projectGoal),
    attempt_no: (latest?.attempt_no ?? 0) + 1,
    status: 'active',
    started_at: now,
    last_activity_at: now,
    completed_at: null,
    updated_at: now,
  }

  const { data, error } = await client
    .from('project_journeys')
    .insert(insert)
    .select('*')
    .single()

  if (!error && data) return mapJourney(data as JourneyRow)

  // Two tabs can start the same source simultaneously. The partial unique
  // index makes one winner; the other request simply reads it back.
  if (isUniqueViolation(error)) {
    const concurrent = await getActiveJourney(client, userId, sourceType, sourceId)
    if (concurrent) return concurrent
  }

  throw error || new Error('无法创建进行中的项目')
}

export async function listJourneyRecords(
  client: JourneyClient,
  journeyId: number,
  options: { limit?: number; before?: string } = {},
): Promise<JourneyRecord[]> {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  let query = client
    .from('project_journey_records')
    .select('*')
    .eq('journey_id', journeyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (options.before) query = query.lt('created_at', options.before)

  const { data, error } = await query
  if (error) throw error
  return ((data || []) as JourneyRecordRow[]).map((row) => row)
}

async function requireOwnedJourney(
  client: JourneyClient,
  journeyId: number,
  userId: string,
) {
  const journey = await getJourneyById(client, journeyId, userId)
  if (!journey) throw new PermissionError('无权操作这个进行中的项目')
  return journey
}

function resolveAnchor(
  recordKind: JourneyRecordWrite['recordKind'],
  anchorType: JourneyRecordWrite['anchorType'],
): JourneyAnchorType {
  if (recordKind === 'final') return 'final'
  if (anchorType === 'step' || anchorType === 'stage' || anchorType === 'extra') return anchorType
  return 'extra'
}

function resolveRecordStatus(
  visibility: JourneyRecordVisibility,
  requested?: JourneyRecordStatus,
): JourneyRecordStatus {
  if (visibility === 'private') return 'draft'
  if (requested === 'rejected') return 'pending'
  return requested === 'approved' ? 'approved' : 'pending'
}

export async function upsertJourneyRecord(
  client: JourneyClient,
  journeyId: number,
  userId: string,
  input: JourneyRecordWrite,
): Promise<JourneyRecord> {
  const journey = await requireOwnedJourney(client, journeyId, userId)
  const recordKind = input.recordKind ?? 'progress'
  const anchorType = resolveAnchor(recordKind, input.anchorType)
  const anchorIndex = input.anchorIndex ?? null
  const visibility = input.visibility ?? 'private'
  const now = new Date().toISOString()

  if (recordKind === 'progress' && anchorType !== 'extra' && anchorIndex === null) {
    throw new ValidationError('步骤或阶段记录需要对应编号')
  }

  if (recordKind === 'final' && journey.status === 'abandoned') {
    throw new ValidationError('已放弃的项目不能发布最终作品')
  }

  if (journey.status === 'completed') {
    throw new ValidationError('这个项目已经完成，请重新开始一次新的项目尝试')
  }

  let existing: JourneyRecordRow | null = null
  if (input.recordId) {
    const { data, error } = await client
      .from('project_journey_records')
      .select('*')
      .eq('id', input.recordId)
      .eq('journey_id', journeyId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) throw error
    existing = data as JourneyRecordRow | null
  } else if (recordKind === 'final') {
    const { data, error } = await client
      .from('project_journey_records')
      .select('*')
      .eq('journey_id', journeyId)
      .eq('record_kind', 'final')
      .maybeSingle()
    if (error) throw error
    existing = data as JourneyRecordRow | null
  } else if (anchorType !== 'extra' && anchorIndex !== null) {
    const { data, error } = await client
      .from('project_journey_records')
      .select('*')
      .eq('journey_id', journeyId)
      .eq('record_kind', 'progress')
      .eq('anchor_type', anchorType)
      .eq('anchor_index', anchorIndex)
      .maybeSingle()
    if (error) throw error
    existing = data as JourneyRecordRow | null
  }

  const record = {
    journey_id: journeyId,
    user_id: userId,
    record_kind: recordKind,
    anchor_type: anchorType,
    anchor_index: anchorIndex,
    title: input.title !== undefined ? normalizeNullableText(input.title) : existing?.title ?? null,
    notes: input.notes !== undefined ? normalizeNullableText(input.notes) : existing?.notes ?? null,
    images: input.images ?? existing?.images ?? [],
    image_captions: input.imageCaptions !== undefined ? input.imageCaptions : existing?.image_captions ?? null,
    video_url: input.videoUrl !== undefined ? input.videoUrl : existing?.video_url ?? null,
    data: input.data !== undefined ? input.data : existing?.data ?? null,
    visibility,
    // Every public write enters review. `moderationState='approved'` means the
    // text pre-check passed; the image worker still has to approve visibility.
    status: resolveRecordStatus(visibility, undefined),
    moderation_state: visibility === 'private' ? 'approved' : (input.moderationState ?? 'pending'),
    moderation_source: input.moderationSource ?? (visibility === 'private' ? 'private_draft' : 'ai'),
    rejection_reason: input.rejectionReason ?? null,
    reviewed_by: input.reviewedBy ?? null,
    reviewed_at: input.reviewedAt ?? null,
    published_at: visibility === 'public' && input.moderationState === 'approved' ? (existing?.published_at ?? now) : null,
    updated_at: now,
  }

  const response = existing
    ? await client
        .from('project_journey_records')
        .update(record)
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select('*')
        .single()
    : await client
        .from('project_journey_records')
        .insert({ ...record, created_at: now })
        .select('*')
        .single()

  if (response.error) throw response.error

  await syncLegacyJourneyRecord(client, journey, response.data as JourneyRecord)
  await touchJourney(client, journeyId, userId)
  return response.data as JourneyRecord
}

export async function publishJourneyRecord(
  client: JourneyClient,
  journeyId: number,
  recordId: number,
  userId: string,
  visibility: JourneyRecordVisibility,
): Promise<JourneyRecord> {
  const journey = await requireOwnedJourney(client, journeyId, userId)
  const { data: existing, error: existingError } = await client
    .from('project_journey_records')
    .select('*')
    .eq('id', recordId)
    .eq('journey_id', journey.id)
    .eq('user_id', userId)
    .maybeSingle()
  if (existingError) throw existingError
  if (!existing) throw new ValidationError('记录不存在')
  if (existing.record_kind === 'final' && journey.status === 'abandoned') {
    throw new ValidationError('已放弃的项目不能公开最终作品')
  }

  const now = new Date().toISOString()
  const nextStatus = visibility === 'public' ? 'pending' : 'draft'
  const { data, error } = await client
    .from('project_journey_records')
    .update({
      visibility,
      status: nextStatus,
      moderation_state: visibility === 'public' ? 'pending' : 'approved',
      moderation_source: visibility === 'public' ? 'ai' : 'private_draft',
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      published_at: null,
      updated_at: now,
    })
    .eq('id', recordId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error

  await syncLegacyJourneyRecord(client, journey, data as JourneyRecord)
  // Hiding or re-submitting a final work reopens the attempt. A completed
  // Journey must not remain completed while its only final record is private
  // or waiting for review.
  if (data.record_kind === 'final') {
    await touchJourney(client, journeyId, userId, {
      status: 'active',
      completedAt: null,
    })
  } else {
    await touchJourney(client, journeyId, userId)
  }
  return data as JourneyRecord
}

/**
 * User-facing Journey updates are deliberately narrow. Completion is a
 * moderation result, not a client-controlled flag; abandoning is the only
 * terminal transition a user can request directly.
 */
export async function updateJourney(
  client: JourneyClient,
  journeyId: number,
  userId: string,
  input: { status?: 'abandoned'; projectGoal?: string | null },
) {
  const journey = await requireOwnedJourney(client, journeyId, userId)
  if (input.status && input.status !== journey.status) {
    if (input.status !== 'abandoned' || journey.status !== 'active') {
      throw new ValidationError('当前项目状态不能这样变更，请开始一次新的项目尝试')
    }
  }
  if (input.projectGoal !== undefined && journey.status !== 'active') {
    throw new ValidationError('已结束的项目不能修改项目目标')
  }
  if (input.status === undefined && input.projectGoal === undefined) return journey

  const now = new Date().toISOString()
  const nextStatus = input.status ?? journey.status
  const { data, error } = await client
    .from('project_journeys')
    .update({
      status: nextStatus,
      completed_at: nextStatus === 'completed' ? journey.completed_at : null,
      ...(input.projectGoal !== undefined ? { project_goal: normalizeNullableText(input.projectGoal) } : {}),
      last_activity_at: now,
      updated_at: now,
    } as never)
    .eq('id', journeyId)
    .eq('user_id', userId)
    .select('*')
    .single()
  if (error) throw error
  return mapJourney(data as JourneyRow)
}

export async function touchJourney(
  client: JourneyClient,
  journeyId: number,
  userId: string,
  updates: { status?: JourneyStatus; completedAt?: string | null } = {},
) {
  const now = new Date().toISOString()
  const { error } = await client
    .from('project_journeys')
    .update({
      last_activity_at: now,
      updated_at: now,
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.completedAt !== undefined ? { completed_at: updates.completedAt } : {}),
    })
    .eq('id', journeyId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function listUserJourneys(
  client: JourneyClient,
  userId: string,
  options: {
    status?: JourneyStatus | 'all'
    sourceType?: JourneySourceType
    sourceId?: number
    limit?: number
  } = {},
) {
  const limit = Math.min(100, Math.max(1, options.limit ?? 50))
  let query = client
    .from('project_journeys')
    .select('*')
    .eq('user_id', userId)
    .order('last_activity_at', { ascending: false })
    .limit(limit)
  if (options.status && options.status !== 'all') query = query.eq('status', options.status)
  if (options.sourceType) query = query.eq('source_type', options.sourceType)
  if (options.sourceType && options.sourceId) query = applySourceFilter(query, options.sourceType, options.sourceId)

  const { data, error } = await query
  if (error) throw error
  return ((data || []) as JourneyRow[]).map(mapJourney)
}

export async function completeJourneyForApprovedFinal(
  client: JourneyClient,
  journeyId: number,
  userId: string,
  recordId: number,
) {
  const { data: record, error: recordError } = await client
    .from('project_journey_records')
    .select('id, record_kind, status, visibility, moderation_state, updated_at')
    .eq('id', recordId)
    .eq('journey_id', journeyId)
    .eq('user_id', userId)
    .maybeSingle()
  if (recordError) throw recordError
  if (!record || record.record_kind !== 'final') return
  if (
    record.status !== 'approved'
    || record.visibility !== 'public'
    || record.moderation_state !== 'approved'
  ) return

  await touchJourney(client, journeyId, userId, {
    status: 'completed',
    completedAt: record.updated_at,
  })
}

/** Re-open the attempt when its final work is rejected and can be edited again. */
export async function reopenJourneyAfterRejectedRecord(
  client: JourneyClient,
  recordId: number,
) {
  const { data: record, error: recordError } = await client
    .from('project_journey_records')
    .select('journey_id, record_kind, user_id')
    .eq('id', recordId)
    .maybeSingle()
  if (recordError) throw recordError
  if (!record || record.record_kind !== 'final') return

  const now = new Date().toISOString()
  const { error } = await client
    .from('project_journeys')
    .update({
      status: 'active',
      completed_at: null,
      last_activity_at: now,
      updated_at: now,
    } as never)
    .eq('id', record.journey_id)
    .eq('user_id', record.user_id)
    .eq('status', 'completed')
  if (error) throw error
}

/** Remove a Journey record and revoke its old public compatibility projection. */
export async function removeJourneyRecord(
  client: JourneyClient,
  journeyId: number,
  recordId: number,
  userId: string,
) {
  const journey = await requireOwnedJourney(client, journeyId, userId)
  const { data: record, error: recordError } = await client
    .from('project_journey_records')
    .select('*')
    .eq('id', recordId)
    .eq('journey_id', journeyId)
    .eq('user_id', userId)
    .maybeSingle()
  if (recordError) throw recordError
  if (!record) throw new ValidationError('记录不存在')

  if (journey.source_type === 'project') {
    const { error } = await client
      .from('completed_projects')
      .update({
        is_public: false,
        status: 'rejected',
        moderation_state: 'hidden',
        moderation_source: 'journey_deleted',
        rejection_reason: '记录已删除',
        reviewed_by: null,
        reviewed_at: null,
        journey_record_id: null,
      } as never)
      .eq('journey_record_id', recordId)
      .eq('user_id', userId)
    if (error) throw error

    // The old exploration is only a pointer. Do not touch another attempt's
    // pointer when a historical Journey is deleted.
    const { error: explorationError } = await client
      .from('project_explorations')
      .update({
        status: 'active',
        completed_at: null,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('journey_id', journeyId)
      .eq('user_id', userId)
    if (explorationError) throw explorationError
  } else if (record.record_kind === 'final' && journey.challenge_id) {
    const { error } = await client
      .from('challenge_submissions')
      .update({
        is_public: false,
        status: 'rejected',
        moderation_state: 'hidden',
        rejection_reason: '记录已删除',
        reviewed_by: null,
        reviewed_at: null,
        journey_record_id: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('journey_record_id', recordId)
      .eq('user_id', userId)
    if (error) throw error
  } else if (record.anchor_type === 'stage' && journey.challenge_id) {
    const { error } = await client
      .from('challenge_stage_progress')
      .update({ journey_record_id: null } as never)
      .eq('journey_record_id', recordId)
      .eq('user_id', userId)
      .eq('challenge_id', journey.challenge_id)
    if (error) throw error
  }

  const { error } = await client
    .from('project_journey_records')
    .delete()
    .eq('id', recordId)
    .eq('journey_id', journeyId)
    .eq('user_id', userId)
  if (error) throw error

  if (record.record_kind === 'final' && journey.status === 'completed') {
    await touchJourney(client, journeyId, userId, { status: 'active', completedAt: null })
  } else {
    await touchJourney(client, journeyId, userId)
  }
}

/** Apply a staff/worker moderation decision to the authoritative Journey row. */
export async function reviewJourneyRecordModeration(
  client: JourneyClient,
  recordId: number,
  state: 'pending' | 'approved' | 'rejected' | 'hidden',
  reviewedBy?: string | null,
  rejectionReason?: string | null,
  moderationSource: 'manual' | 'ai' = 'manual',
) {
  const { data: existing, error: existingError } = await client
    .from('project_journey_records')
    .select('*')
    .eq('id', recordId)
    .maybeSingle()
  if (existingError) throw existingError
  if (!existing) return null

  const now = new Date().toISOString()
  const isApproved = state === 'approved'
  const { data, error } = await client
    .from('project_journey_records')
    .update({
      status: isApproved ? 'approved' : state === 'pending' ? 'pending' : 'rejected',
      moderation_state: state,
      moderation_source: moderationSource,
      rejection_reason: isApproved ? null : (rejectionReason || (state === 'hidden' ? '内容已暂时隐藏' : null)),
      reviewed_by: reviewedBy ?? null,
      reviewed_at: reviewedBy ? now : null,
      published_at: isApproved && existing.visibility === 'public' ? (existing.published_at || now) : null,
      updated_at: now,
    } as never)
    .eq('id', recordId)
    .select('*')
    .single()
  if (error) throw error

  const journey = await getJourneyById(client, existing.journey_id)
  if (journey) {
    await syncLegacyJourneyRecord(client, journey, data as JourneyRecord)
    if (isApproved && data.record_kind === 'final') {
      await completeJourneyForApprovedFinal(client, journey.id, journey.user_id, recordId)
    } else if (!isApproved && data.record_kind === 'final') {
      await reopenJourneyAfterRejectedRecord(client, recordId)
    }
  }
  return data as JourneyRecord
}

function legacyStatus(record: JourneyRecord): 'pending' | 'approved' | 'rejected' {
  if (record.status === 'rejected' || record.moderation_state === 'rejected') return 'rejected'
  if (record.status === 'approved' && record.moderation_state === 'approved') return 'approved'
  return 'pending'
}

/**
 * Keep the old project work row as a compatibility projection. The Journey
 * row remains authoritative; this projection only keeps old works links and
 * existing galleries readable while clients migrate to the new model.
 */
export async function syncLegacyProjectRecord(
  client: JourneyClient,
  journey: Journey,
  record: JourneyRecord,
) {
  if (journey.source_type !== 'project' || !journey.project_id) return null

  const now = new Date().toISOString()
  const activeJourney = journey.status === 'active'
    ? journey
    : await getActiveJourney(client, journey.user_id, 'project', journey.project_id)
  const pointerJourney = activeJourney ?? journey
  const finalApproved =
    record.record_kind === 'final'
    && record.visibility === 'public'
    && legacyStatus(record) === 'approved'
  const { data: legacyExploration, error: explorationError } = await client
    .from('project_explorations')
    .select('id')
    .eq('user_id', journey.user_id)
    .eq('project_id', journey.project_id)
    .maybeSingle()
  if (explorationError) throw explorationError

  let explorationId = (legacyExploration as { id: number } | null)?.id ?? null
  if (explorationId) {
    const { error } = await client
      .from('project_explorations')
      .update({
        status: finalApproved && pointerJourney.id === journey.id ? 'completed' : 'active',
        completed_at: finalApproved && pointerJourney.id === journey.id ? (record.updated_at || now) : null,
        journey_id: pointerJourney.id,
        started_at: pointerJourney.started_at,
        last_activity_at: now,
        updated_at: now,
      } as never)
      .eq('id', explorationId)
    if (error) throw error
  } else {
    const { data, error } = await client
      .from('project_explorations')
      .insert({
        user_id: journey.user_id,
        project_id: journey.project_id,
        status: finalApproved && pointerJourney.id === journey.id ? 'completed' : 'active',
        started_at: pointerJourney.started_at,
        last_activity_at: now,
        completed_at: finalApproved && pointerJourney.id === journey.id ? (record.updated_at || now) : null,
        journey_id: pointerJourney.id,
        updated_at: now,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    explorationId = (data as { id: number }).id
  }

  if (record.visibility === 'private') {
    // A public record may be switched back to a private draft. Hide the old
    // compatibility row as well, otherwise legacy galleries would still leak
    // the work after the Journey row became private.
    const { data: existing, error } = await client
      .from('completed_projects')
      .select('id')
      .eq('journey_record_id', record.id)
      .maybeSingle()
    if (error) throw error
    if (existing) {
      const { error: updateError } = await client
        .from('completed_projects')
        .update({
          is_public: false,
          status: 'pending',
          moderation_state: 'approved',
          moderation_source: 'private_draft',
          reviewed_by: null,
          reviewed_at: null,
          rejection_reason: null,
        } as never)
        .eq('id', existing.id)
      if (updateError) throw updateError
    }
    return null
  }

  const recordData = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : null
  const recordType = typeof recordData?.recordType === 'string' ? recordData.recordType : null
  const stageLabel = typeof recordData?.stageLabel === 'string' ? recordData.stageLabel : null

  const payload = {
    user_id: journey.user_id,
    project_id: journey.project_id,
    course_lesson_id: null,
    completed_at: record.created_at,
    proof_images: record.images,
    proof_captions: record.image_captions,
    proof_video_url: record.video_url,
    notes: record.notes,
    is_public: record.visibility === 'public',
    status: legacyStatus(record),
    reviewed_by: record.reviewed_by,
    reviewed_at: record.reviewed_at,
    rejection_reason: record.rejection_reason,
    record_kind: record.record_kind,
    record_type: recordType,
    stage_label: stageLabel,
    exploration_id: explorationId,
    journey_record_id: record.id,
    moderation_source: record.moderation_source,
    moderation_state: record.moderation_state,
  }

  const { data: existing, error: existingError } = await client
    .from('completed_projects')
    .select('id')
    .eq('journey_record_id', record.id)
    .maybeSingle()
  if (existingError) throw existingError

  const response = existing
    ? await client.from('completed_projects').update(payload as never).eq('id', existing.id).select('id').single()
    : await client.from('completed_projects').insert(payload as never).select('id').single()
  if (response.error) throw response.error
  return (response.data as { id: number }).id
}

/**
 * A PBL final Journey record is also written to the legacy challenge
 * submission projection. Challenge pages and moderation tools can therefore
 * continue to read the same final work while the Journey timeline is shown
 * alongside it.
 */
export async function syncLegacyChallengeFinal(
  client: JourneyClient,
  journey: Journey,
  record: JourneyRecord,
) {
  if (journey.source_type !== 'challenge' || !journey.challenge_id || record.record_kind !== 'final') return null

  // The legacy challenge table is one row per user/challenge. Keep it as the
  // pointer for the current/latest attempt only; historical Journey records
  // must stay authoritative in project_journey_records.
  const activeJourney = await getActiveJourney(client, journey.user_id, 'challenge', journey.challenge_id)
  const latestJourney = activeJourney ?? await getLatestJourney(client, journey.user_id, 'challenge', journey.challenge_id)
  if (latestJourney && latestJourney.id !== journey.id) return null

  const payload = {
    challenge_id: journey.challenge_id,
    user_id: journey.user_id,
    title: record.title || journey.title || '我的挑战作品',
    notes: record.notes,
    proof_images: record.images,
    proof_captions: record.image_captions,
    proof_video_url: record.video_url,
    is_public: record.visibility === 'public',
    status: legacyStatus(record),
    reviewed_by: record.reviewed_by,
    reviewed_at: record.reviewed_at,
    rejection_reason: record.rejection_reason,
    moderation_state: record.moderation_state,
    journey_record_id: record.id,
    updated_at: new Date().toISOString(),
  }

  const { data: existing, error: existingError } = await client
    .from('challenge_submissions')
    .select('id')
    .eq('challenge_id', journey.challenge_id)
    .eq('user_id', journey.user_id)
    .maybeSingle()
  if (existingError) throw existingError

  const response = existing
    ? await client.from('challenge_submissions').update(payload as never).eq('id', existing.id).select('id').single()
    : await client.from('challenge_submissions').insert(payload as never).select('id').single()
  if (response.error) throw response.error
  return (response.data as { id: number }).id
}

/** Keep the old PBL stage row aligned with a new stage Journey record. */
export async function syncLegacyChallengeStage(
  client: JourneyClient,
  journey: Journey,
  record: JourneyRecord,
) {
  if (
    journey.source_type !== 'challenge'
    || !journey.challenge_id
    || record.record_kind !== 'progress'
    || record.anchor_type !== 'stage'
    || record.anchor_index === null
  ) return null

  // challenge_stage_progress has a source-level unique key. Do not let a
  // moderation update for an old attempt overwrite the current attempt's
  // compatibility pointer.
  const activeJourney = await getActiveJourney(client, journey.user_id, 'challenge', journey.challenge_id)
  const latestJourney = activeJourney ?? await getLatestJourney(client, journey.user_id, 'challenge', journey.challenge_id)
  if (latestJourney && latestJourney.id !== journey.id) return null

  const data = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data
    : null
  const { data: existingProgress, error: existingProgressError } = await client
    .from('challenge_stage_progress')
    .select('status')
    .eq('challenge_id', journey.challenge_id)
    .eq('user_id', journey.user_id)
    .eq('stage_index', record.anchor_index)
    .maybeSingle()
  if (existingProgressError) throw existingProgressError
  const status = (existingProgress as { status?: string } | null)?.status
    || (typeof (data as Record<string, unknown> | null)?.progressStatus === 'string'
      ? (data as Record<string, unknown>).progressStatus as string
      : 'in_progress')
  const payload = {
    challenge_id: journey.challenge_id,
    user_id: journey.user_id,
    stage_index: record.anchor_index,
    status,
    notes: record.notes,
    images: record.images,
    data,
    video_url: record.video_url,
    journey_id: journey.id,
    journey_record_id: record.id,
    updated_at: record.updated_at,
  }

  const { data: responseData, error } = await client
    .from('challenge_stage_progress')
    .upsert(payload as never, { onConflict: 'challenge_id,user_id,stage_index' })
    .select('id')
    .single()
  if (error) throw error
  return (responseData as { id: number }).id
}

/** Sync whichever compatibility projection belongs to a Journey record. */
export async function syncLegacyJourneyRecord(
  client: JourneyClient,
  journey: Journey,
  record: JourneyRecord,
) {
  if (journey.source_type === 'project') {
    return syncLegacyProjectRecord(client, journey, record)
  }
  if (record.record_kind === 'final') {
    return syncLegacyChallengeFinal(client, journey, record)
  }
  return syncLegacyChallengeStage(client, journey, record)
}

export { getJourneySourceId }
