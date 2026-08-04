import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getObservationById } from '@/lib/api/nature-observation-data'
import { validateContentSafe } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import {
  mapDbObservationComment,
  type DbObservationCommentWithProfile,
} from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  assertUsersNotBlocked,
  createModerationCase,
  moderateUserContent,
} from '@/lib/safety/server'

const COMMENT_SELECT = `
  *,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: '无效的观察记录 ID' }, { status: 400 })
    }

    const observation = await getObservationById(observationId)
    if (!observation) {
      return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
    }
    if (observation.status !== 'approved') {
      return NextResponse.json({ error: '观察记录尚未通过审核' }, { status: 403 })
    }
    const { data, error } = await supabase
      .from('observation_comments')
      .select(COMMENT_SELECT)
      .eq('observation_event_id', observationId)
      .order('created_at', { ascending: true })

    if (error) {
      logger.error('Error fetching observation comments', { error, observationId })
      throw error
    }

    const rows = (data || []) as DbObservationCommentWithProfile[]
    return NextResponse.json({ comments: rows.map(mapDbObservationComment) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'comment')
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: '无效的观察记录 ID' }, { status: 400 })
    }

    const observation = await getObservationById(observationId)
    if (!observation) {
      return NextResponse.json({ error: '观察记录不存在或无权评论' }, { status: 404 })
    }
    if (observation.status !== 'approved') {
      return NextResponse.json({ error: '观察记录尚未通过审核' }, { status: 403 })
    }
    await assertUsersNotBlocked(supabase, user.id, observation.userId)

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const parentId = body?.parent_id == null ? null : Number(body.parent_id)

    if (!content) {
      return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '评论内容过长' }, { status: 400 })
    }

    validateContentSafe(content, '评论内容')

    let replyToUserId: string | null = null
    let replyToUsername: string | null = null

    if (parentId !== null) {
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return NextResponse.json({ error: '无效的 parent_id' }, { status: 400 })
      }

      const { data: parentComment } = await supabase
        .from('observation_comments')
        .select('observation_event_id, author_id, profiles:author_id(display_name)')
        .eq('id', parentId)
        .maybeSingle()

      if (!parentComment) {
        return NextResponse.json({ error: '父评论不存在' }, { status: 400 })
      }

      const typed = parentComment as {
        observation_event_id: number
        author_id: string
        profiles?: { display_name?: string | null } | null
      }

      if (typed.observation_event_id !== observationId) {
        return NextResponse.json({ error: '父评论不属于当前观察记录' }, { status: 400 })
      }

      replyToUserId = typed.author_id
      replyToUsername = typed.profiles?.display_name || null
      await assertUsersNotBlocked(supabase, user.id, typed.author_id)
    }

    const moderation = await moderateUserContent({ text: content })
    if (moderation.state === 'rejected') {
      return NextResponse.json(
        { error: moderation.reason || '评论未通过安全检查', code: 'CONTENT_REJECTED' },
        { status: 422 },
      )
    }
    if (moderation.state === 'pending' && !supabaseAdmin) {
      return NextResponse.json(
        { error: '审核服务暂时不可用，请稍后重试', code: 'MODERATION_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const { data, error } = await supabase
      .from('observation_comments')
      .insert({
        observation_event_id: observationId,
        author_id: user.id,
        content,
        parent_id: parentId,
        reply_to_user_id: replyToUserId,
        reply_to_username: replyToUsername,
        moderation_state: moderation.state,
      } as never)
      .select(COMMENT_SELECT)
      .single()

    if (error || !data) throw error

    const typedComment = data as { id: number }
    if (moderation.state === 'pending') {
      const caseId = await createModerationCase({
        contentType: 'observation_comment',
        contentId: typedComment.id,
        authorId: user.id,
        riskLevel: moderation.riskLevel,
        category: moderation.category,
        reason: moderation.reason,
        modelName: moderation.modelName,
        snapshot: {
          authorId: user.id,
          text: content,
          metadata: { observationId, parentId },
        },
      })
      return NextResponse.json(
        { comment: data, moderation: { state: 'pending', caseId } },
        { status: 202 },
      )
    }

    await supabase.rpc('increment_observation_comments', { target_observation_id: observationId })

    return NextResponse.json({ comment: mapDbObservationComment(data as DbObservationCommentWithProfile) })
  } catch (error) {
    return handleApiError(error)
  }
}
