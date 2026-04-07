import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, requireRole, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateDateTimeString, validateUUID } from '@/lib/api/validation'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'

const PAGE_SIZE = 20
const USER_ALLOWED_TYPES = new Set(['mention', 'reply', 'like', 'follow'])
const ALLOWED_TYPES = new Set([
  ...USER_ALLOWED_TYPES,
  'system',
  'creator_update',
])
const ALLOWED_RELATED_TYPES = new Set([
  'comment',
  'discussion_reply',
  'project',
  'discussion',
])

function toPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null

  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) return null

  return num
}

async function assertNotificationPayloadAllowed(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  actorUserId: string
  recipientUserId: string
  type: string
  relatedType: string | null
  relatedId: number | null
  projectId: number | null
}) {
  const { supabase, actorUserId, recipientUserId, type, relatedType, relatedId, projectId } = params

  if (type === 'system') {
    return
  }

  if (type === 'follow') {
    const { data: follow, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', actorUserId)
      .eq('following_id', recipientUserId)
      .maybeSingle()

    if (error) throw error
    if (!follow) {
      return NextResponse.json({ error: 'Invalid follow notification payload' }, { status: 403 })
    }
    return
  }

  if (type === 'like') {
    if (relatedType !== 'project' || !projectId) {
      return NextResponse.json({ error: 'Invalid like notification payload' }, { status: 400 })
    }

    const [{ data: project, error: projectError }, { data: likeRow, error: likeError }] = await Promise.all([
      supabase
        .from('projects')
        .select('author_id')
        .eq('id', projectId)
        .maybeSingle(),
      supabase
        .from('likes')
        .select('user_id')
        .eq('user_id', actorUserId)
        .eq('project_id', projectId)
        .maybeSingle(),
    ])

    if (projectError) throw projectError
    if (likeError) throw likeError

    if (!project || (project as { author_id: string }).author_id !== recipientUserId || !likeRow) {
      return NextResponse.json({ error: 'Invalid like notification payload' }, { status: 403 })
    }
    return
  }

  if (type === 'creator_update') {
    if (relatedType !== 'project' || !projectId) {
      return NextResponse.json({ error: 'Invalid creator update payload' }, { status: 400 })
    }

    const [
      { data: project, error: projectError },
      { data: follow, error: followError },
      { data: recipientProfile, error: profileError },
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('author_id')
        .eq('id', projectId)
        .maybeSingle(),
      supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', recipientUserId)
        .eq('following_id', actorUserId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('notify_followed_creator_updates')
        .eq('id', recipientUserId)
        .maybeSingle(),
    ])

    if (projectError) throw projectError
    if (followError) throw followError
    if (profileError) throw profileError

    const allowsCreatorUpdates =
      !recipientProfile ||
      (recipientProfile as { notify_followed_creator_updates?: boolean | null })
        .notify_followed_creator_updates !== false

    const typedProject = project as { author_id: string; status?: string | null } | null

    if (
      !project ||
      typedProject?.author_id !== actorUserId ||
      (typedProject?.status && typedProject.status !== 'approved') ||
      !follow ||
      !allowsCreatorUpdates
    ) {
      return NextResponse.json({ error: 'Invalid creator update payload' }, { status: 403 })
    }
    return
  }

  if (type === 'mention' || type === 'reply') {
    if (!relatedType || !relatedId) {
      return NextResponse.json({ error: 'Invalid reply notification payload' }, { status: 400 })
    }

    if (relatedType === 'comment') {
      const { data: comment, error } = await supabase
        .from('comments')
        .select('author_id, reply_to_user_id')
        .eq('id', relatedId)
        .maybeSingle()

      if (error) throw error

      const typedComment = comment as { author_id: string; reply_to_user_id: string | null } | null
      if (!typedComment || typedComment.author_id !== actorUserId || typedComment.reply_to_user_id !== recipientUserId) {
        return NextResponse.json({ error: 'Invalid comment notification payload' }, { status: 403 })
      }
      return
    }

    if (relatedType === 'discussion_reply') {
      const { data: reply, error } = await supabase
        .from('discussion_replies')
        .select('author_id, reply_to_user_id')
        .eq('id', relatedId)
        .maybeSingle()

      if (error) throw error

      const typedReply = reply as { author_id: string; reply_to_user_id: string | null } | null
      if (!typedReply || typedReply.author_id !== actorUserId || typedReply.reply_to_user_id !== recipientUserId) {
        return NextResponse.json({ error: 'Invalid discussion reply notification payload' }, { status: 403 })
      }
      return
    }

    return NextResponse.json({ error: 'Unsupported related_type for notification' }, { status: 400 })
  }

  return NextResponse.json({ error: 'Unsupported notification type' }, { status: 400 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-notifications-read', limit: 30, windowMs: 60_000 })
    const searchParams = request.nextUrl.searchParams
    const beforeParam = searchParams.get('before')
    const before = beforeParam ? validateDateTimeString(beforeParam, 'before') : null

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data, error } = await query
    if (error) throw error

    const list = (data || []) as Record<string, unknown>[]
    const hasMore = list.length === PAGE_SIZE

    return NextResponse.json({ notifications: list, hasMore })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-notifications-create', limit: 60, windowMs: 60_000 })
    const body = await request.json()

    const userId = validateUUID(body?.user_id, 'user_id')
    const type = typeof body?.type === 'string' ? body.type : null
    const content =
      typeof body?.content === 'string' ? body.content.trim() : ''

    if (!type || !content) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Content must not exceed 500 characters' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const isSystem = type === 'system'
    if (isSystem) {
      await requireRole(supabase, ['moderator', 'admin'])
    } else if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot create notifications for yourself' }, { status: 400 })
    }

    const relatedType =
      typeof body?.related_type === 'string' ? body.related_type : null
    if (relatedType && !ALLOWED_RELATED_TYPES.has(relatedType)) {
      return NextResponse.json(
        { error: 'Invalid related_type' },
        { status: 400 }
      )
    }

    const relatedId = toPositiveInteger(body?.related_id)
    const projectId = toPositiveInteger(body?.project_id)
    const discussionId = toPositiveInteger(body?.discussion_id)

    const validationResponse = await assertNotificationPayloadAllowed({
      supabase,
      actorUserId: user.id,
      recipientUserId: userId,
      type,
      relatedType,
      relatedId,
      projectId,
    })

    if (validationResponse) {
      return validationResponse
    }

    let fromUsername: string | null = null
    let fromAvatar: string | null = null
    if (isSystem) {
      fromUsername = '系统'
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const fallbackName = user.email?.split('@')[0] || null
      const fallbackAvatar = getDefaultAvatarPath(user.id)

      fromUsername = profile?.display_name || fallbackName
      fromAvatar = profile?.avatar_url || fallbackAvatar
    }

    const payload = {
      user_id: userId,
      type,
      content,
      related_type: relatedType,
      related_id: relatedId,
      project_id: projectId,
      discussion_id: discussionId,
      from_user_id: isSystem ? null : user.id,
      from_username: fromUsername,
      from_avatar: fromAvatar,
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert(payload as never)
      .select('id')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, id: data?.id ?? null })
  } catch (error) {
    return handleApiError(error)
  }
}
