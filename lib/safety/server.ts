import type { SupabaseClient } from '@supabase/supabase-js'

import { PermissionError } from '@/lib/api/auth'
import { checkContent } from '@/lib/content-filter'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'
import type {
  ContentSnapshot,
  ModerationDecision,
  ModerationRisk,
  SafetyActionType,
} from '@/lib/safety/types'

type DbClient = SupabaseClient<Database>

const URL_RE = /(?:https?:\/\/|www\.)\S+/iu
const EMAIL_RE = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/u
const PHONE_RE = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/u
const MESSAGE_CONTEXT_LIMIT = 3

export function moderateTextContent(
  text: string,
  context: 'public' | 'message' = 'public',
): ModerationDecision {
  const value = text.trim()
  const result = checkContent(value)

  if (!result.passed) {
    return {
      state: 'rejected',
      riskLevel: 'high',
      category: 'inappropriate',
      reason: '文字内容包含不适宜信息，请修改后重试。',
      modelName: 'local-sensitive-filter-v1',
    }
  }

  if (context === 'message' && (URL_RE.test(value) || EMAIL_RE.test(value) || PHONE_RE.test(value))) {
    return {
      state: 'pending',
      riskLevel: 'medium',
      category: 'contact_or_link',
      reason: '消息包含外链或联系方式，需要人工确认。',
      modelName: 'local-contact-filter-v1',
    }
  }

  return {
    state: 'approved',
    riskLevel: 'low',
    category: null,
    reason: null,
    modelName: 'local-sensitive-filter-v1',
  }
}

export async function moderateImageContent(
  imageSource: string,
  contextLabel = '图片',
): Promise<ModerationDecision> {
  // The existing image moderation client is intentionally optional here. A
  // missing/failed provider never turns into an automatic allow.
  try {
    const { moderateUploadedImage } = await import('@/lib/ai/upload-content-moderation')
    const result = await moderateUploadedImage(imageSource, contextLabel)
    return {
      state: result.pass ? 'approved' : 'rejected',
      riskLevel: result.pass ? 'low' : 'high',
      category: result.pass ? null : 'image_safety',
      reason: result.reason,
      modelName: result.modelName,
    }
  } catch (error) {
    logger.warn('Image moderation unavailable; queueing content', { error })
    return {
      state: 'pending',
      riskLevel: 'medium',
      category: 'moderation_unavailable',
      reason: '图片审核服务暂时不可用，内容已进入人工审核。',
      modelName: 'unavailable',
    }
  }
}

export async function moderateUserContent(input: {
  text?: string | null
  imageSources?: string[]
  context?: 'public' | 'message'
}): Promise<ModerationDecision> {
  const text = input.text?.trim() || ''
  const textDecision = text
    ? moderateTextContent(text, input.context ?? 'public')
    : {
        state: 'approved' as const,
        riskLevel: 'low' as const,
        category: null,
        reason: null,
        modelName: 'no-text-v1',
      }

  if (textDecision.state === 'rejected') return textDecision

  const imageSources = (input.imageSources ?? []).filter((source) => source.trim().length > 0)
  if (imageSources.length === 0) return textDecision

  const imageDecisions = await Promise.all(
    imageSources.map((source) => moderateImageContent(source, input.context === 'message' ? '私信图片' : '社区图片')),
  )
  const rejected = imageDecisions.find((decision) => decision.state === 'rejected')
  if (rejected) return rejected

  const pending = imageDecisions.find((decision) => decision.state === 'pending')
  if (pending) {
    return {
      state: 'pending',
      riskLevel: pending.riskLevel === 'high' ? 'high' : 'medium',
      category: pending.category,
      reason: pending.reason,
      modelName: pending.modelName,
    }
  }

  return textDecision
}

export async function areUsersBlocked(
  supabase: DbClient,
  firstUserId: string,
  secondUserId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocker_id, blocked_user_id')
    .or(
      `and(blocker_id.eq.${firstUserId},blocked_user_id.eq.${secondUserId}),and(blocker_id.eq.${secondUserId},blocked_user_id.eq.${firstUserId})`,
    )
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}

export async function assertUsersNotBlocked(
  supabase: DbClient,
  firstUserId: string,
  secondUserId: string,
) {
  if (firstUserId === secondUserId) return
  if (await areUsersBlocked(supabase, firstUserId, secondUserId)) {
    throw new PermissionError('你已屏蔽该用户，或对方已屏蔽你', 'USER_BLOCKED', {
      userId: secondUserId,
    })
  }
}

export async function filterBlockedRecipients(actorId: string, recipientIds: string[]) {
  const uniqueRecipients = [...new Set(recipientIds)].filter((id) => id && id !== actorId)
  if (uniqueRecipients.length === 0 || !supabaseAdmin) return uniqueRecipients

  const [{ data: outgoing, error: outgoingError }, { data: incoming, error: incomingError }] = await Promise.all([
    supabaseAdmin
      .from('user_blocks')
      .select('blocked_user_id')
      .eq('blocker_id', actorId)
      .in('blocked_user_id', uniqueRecipients),
    supabaseAdmin
      .from('user_blocks')
      .select('blocker_id')
      .eq('blocked_user_id', actorId)
      .in('blocker_id', uniqueRecipients),
  ])

  if (outgoingError) throw outgoingError
  if (incomingError) throw incomingError

  const blocked = new Set([
    ...(outgoing ?? []).map((row) => row.blocked_user_id),
    ...(incoming ?? []).map((row) => row.blocker_id),
  ])
  return uniqueRecipients.filter((id) => !blocked.has(id))
}

export async function purgeExpiredReportEvidence() {
  if (!supabaseAdmin) return

  const { error } = await supabaseAdmin.rpc('purge_expired_report_evidence' as never)
  if (error) {
    logger.warn('Failed to purge expired report evidence', { error })
  }
}

export async function createModerationCase(input: {
  contentType: string
  contentId: number
  authorId?: string | null
  source?: 'automatic' | 'report' | 'admin' | 'appeal'
  status?: 'pending' | 'approved' | 'rejected' | 'hidden'
  riskLevel: ModerationRisk
  category?: string | null
  reason?: string | null
  modelName?: string | null
  snapshot?: ContentSnapshot | null
}) {
  if (!supabaseAdmin) throw new Error('安全审核服务未配置')

  const { data, error } = await supabaseAdmin
    .from('moderation_cases')
    .insert({
      content_type: input.contentType,
      content_id: input.contentId,
      author_id: input.authorId ?? null,
      source: input.source ?? 'automatic',
      status: input.status ?? 'pending',
      risk_level: input.riskLevel,
      category: input.category ?? null,
      reason: input.reason ?? null,
      model_name: input.modelName ?? null,
      snapshot_text: input.snapshot?.text?.slice(0, 4000) ?? null,
      snapshot_metadata: (input.snapshot?.metadata ?? {}) as never,
    } as never)
    .select('id')
    .single()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('moderation_cases')
        .select('id')
        .eq('content_type', input.contentType)
        .eq('content_id', input.contentId)
        .in('status', ['pending', 'hidden'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existingError) throw existingError
      if (existing) return existing.id
    }
    throw error
  }
  return data.id
}

export async function setContentModerationState(
  contentType: string,
  contentId: number,
  state: 'pending' | 'approved' | 'rejected' | 'hidden',
) {
  if (!supabaseAdmin) throw new Error('安全审核服务未配置')

  const tableByContentType: Record<string, string> = {
    project: 'projects',
    comment: 'comments',
    discussion: 'discussions',
    discussion_reply: 'discussion_replies',
    completion_comment: 'completion_comments',
    observation_comment: 'observation_comments',
    completion: 'completed_projects',
    challenge_submission: 'challenge_submissions',
    observation: 'observation_events',
    message: 'messages',
  }
  const table = tableByContentType[contentType]
  if (!table) return

  const dynamicClient = supabaseAdmin as unknown as {
    from: (tableName: string) => {
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: number) => Promise<{ error: unknown }>
      }
    }
  }
  const { error } = await dynamicClient
    .from(table)
    .update({ moderation_state: state })
    .eq('id', contentId)

  if (error) throw error
}

export async function applySafetyAction(input: {
  userId: string
  actionType: SafetyActionType
  reason: string
  createdBy: string
  sourceReportId?: number | null
  sourceCaseId?: number | null
  endsAt?: string | null
  metadata?: Record<string, unknown>
}) {
  if (!supabaseAdmin) throw new Error('安全管理服务未配置')

  const { data, error } = await supabaseAdmin
    .from('safety_actions')
    .insert({
      user_id: input.userId,
      action_type: input.actionType,
      reason: input.reason,
      created_by: input.createdBy,
      source_report_id: input.sourceReportId ?? null,
      source_case_id: input.sourceCaseId ?? null,
      ends_at: input.endsAt ?? null,
      metadata: (input.metadata ?? {}) as never,
    } as never)
    .select('id, action_type, status, starts_at, ends_at')
    .single()

  if (error) throw error
  await syncSafetyProjection(input.userId)
  return data
}

export async function syncSafetyProjection(userId: string) {
  if (!supabaseAdmin) throw new Error('安全管理服务未配置')

  const { error } = await supabaseAdmin.rpc('sync_safety_projection' as never, {
    p_user_id: userId,
  } as never)

  if (error) throw error
}

export async function getContentSnapshot(
  supabase: DbClient,
  contentType: string,
  contentId: number,
): Promise<ContentSnapshot | null> {
  type DynamicQuery = {
    select: (columns: string) => {
      eq: (column: string, value: number) => {
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>
      }
    }
  }
  const dynamicClient = supabase as unknown as { from: (table: string) => DynamicQuery }
  const query = async (table: string, select: string, idField = 'id') => {
    const { data, error } = await dynamicClient
      .from(table)
      .select(select)
      .eq(idField, contentId)
      .maybeSingle()
    if (error) throw error
    return data as Record<string, unknown> | null
  }

  let row: Record<string, unknown> | null = null
  switch (contentType) {
    case 'project':
      row = await query('projects', 'id, author_id, title, description, image_url')
      break
    case 'comment':
      row = await query('comments', 'id, author_id, content, project_id')
      break
    case 'completion_comment':
      row = await query('completion_comments', 'id, author_id, content, completed_project_id')
      break
    case 'discussion':
      row = await query('discussions', 'id, author_id, title, content')
      break
    case 'discussion_reply':
      row = await query('discussion_replies', 'id, author_id, content, discussion_id')
      break
    case 'observation':
      row = await query('observation_events', 'id, user_id, notes, media_urls')
      break
    case 'message':
      row = await query('messages', 'id, sender_id, receiver_id, content, created_at')
      break
    default:
      return null
  }

  if (!row) return null
  const authorId = typeof row.author_id === 'string'
    ? row.author_id
    : typeof row.user_id === 'string'
      ? row.user_id
      : typeof row.sender_id === 'string'
        ? row.sender_id
        : null
  const text = [row.title, row.description, row.content, row.notes]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .slice(0, 4000) || null

  const metadata: Record<string, unknown> = {
    contentType,
    contentId,
    receiverId: typeof row.receiver_id === 'string' ? row.receiver_id : undefined,
    imageUrl: typeof row.image_url === 'string' ? row.image_url : undefined,
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls.slice(0, 3) : undefined,
  }

  if (contentType === 'message') {
    const messageContext = await getMessageContext(supabase, row)
    if (messageContext.length > 0) {
      metadata.messageContext = { messages: messageContext }
    }
  }

  return {
    authorId,
    text,
    metadata,
  }
}

type MessageContextRow = {
  id: number
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
}

async function getMessageContext(supabase: DbClient, target: Record<string, unknown>) {
  const targetId = Number(target.id)
  const senderId = typeof target.sender_id === 'string' ? target.sender_id : ''
  const receiverId = typeof target.receiver_id === 'string' ? target.receiver_id : ''
  const content = typeof target.content === 'string' ? target.content : ''
  const createdAt = typeof target.created_at === 'string' ? target.created_at : ''

  if (!Number.isInteger(targetId) || !senderId || !receiverId || !createdAt) return []

  const targetItem = {
    id: targetId,
    senderId,
    receiverId,
    content: content.slice(0, 2000),
    createdAt,
  }
  const conversationFilter = `and(sender_id.eq.${senderId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${senderId})`

  try {
    const [{ data: previous, error: previousError }, { data: next, error: nextError }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(conversationFilter)
        .lt('created_at', createdAt)
        .order('created_at', { ascending: false })
        .limit(MESSAGE_CONTEXT_LIMIT),
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(conversationFilter)
        .gt('created_at', createdAt)
        .order('created_at', { ascending: true })
        .limit(MESSAGE_CONTEXT_LIMIT),
    ])

    if (previousError) throw previousError
    if (nextError) throw nextError

    const mapMessage = (message: MessageContextRow) => ({
      id: message.id,
      senderId: message.sender_id,
      receiverId: message.receiver_id,
      content: message.content.slice(0, 2000),
      createdAt: message.created_at,
    })

    return [
      ...((previous ?? []) as MessageContextRow[]).reverse().map(mapMessage),
      targetItem,
      ...((next ?? []) as MessageContextRow[]).map(mapMessage),
    ]
  } catch (error) {
    logger.warn('Failed to capture message report context', { error, contentId: targetId })
    return [targetItem]
  }
}
