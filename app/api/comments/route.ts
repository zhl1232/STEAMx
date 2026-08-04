import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe, isOwnedCommentImageUrl } from '@/lib/api/validation'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import { awardWeeklyCommentGoalIfEligible, awardXpOnce } from '@/lib/api/server-awards'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  assertUsersNotBlocked,
  createModerationCase,
  filterBlockedRecipients,
  moderateUserContent,
} from '@/lib/safety/server'

const COMMENT_SELECT = `
  *,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

function canAccessProject(
  project: { author_id: string; status: string | null; moderation_state?: string | null } | null,
  viewerId: string,
) {
  if (!project) return false
  if ((!project.status || project.status === 'approved') && project.moderation_state === 'approved') return true
  return project.author_id === viewerId
}

/**
 * POST /api/comments
 * 创建项目评论（含敏感词过滤）
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-comments-create', limit: 30, windowMs: 60_000 })

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const projectId = Number(body?.project_id)
    const parentId = body?.parent_id == null ? null : Number(body.parent_id)
    const imageUrl = body?.image_url ?? null

    if (!content && !imageUrl) {
      return NextResponse.json({ error: '评论内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '评论内容过长' }, { status: 400 })
    }

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json({ error: '缺少 project_id' }, { status: 400 })
    }
    if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
      return NextResponse.json({ error: '无效的 parent_id' }, { status: 400 })
    }

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('author_id, status, moderation_state, title')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) throw projectError
    if (!projectRow) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }
    const typedProject = projectRow as { author_id: string; status: string | null; moderation_state?: string | null; title?: string | null }
    if (!canAccessProject(typedProject, user.id)) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }
    if (typedProject.author_id) {
      await assertUsersNotBlocked(supabase, user.id, typedProject.author_id)
    }

    if (content) {
      validateContentSafe(content, '评论内容')
    }

    if (imageUrl !== null) {
      if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
        return NextResponse.json({ error: '无效的评论图片' }, { status: 400 })
      }

      if (!isOwnedCommentImageUrl(imageUrl, user.id)) {
        return NextResponse.json({ error: '评论图片必须使用当前账号上传的文件' }, { status: 400 })
      }

    }

    let replyToUserId: string | null = null
    let replyToUsername: string | null = null

    if (parentId !== null) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('project_id, author_id, profiles:author_id(display_name)')
        .eq('id', parentId)
        .maybeSingle()

      if (parentError) throw parentError
      if (!parentComment) {
        return NextResponse.json({ error: '父评论不存在' }, { status: 400 })
      }

      const typedParent = parentComment as {
        project_id: number
        author_id: string
        profiles?: { display_name?: string | null } | null
      }

      if (typedParent.project_id !== projectId) {
        return NextResponse.json({ error: '父评论不属于当前项目' }, { status: 400 })
      }

      await assertUsersNotBlocked(supabase, user.id, typedParent.author_id)

      replyToUserId = typedParent.author_id
      replyToUsername = typedParent.profiles?.display_name || null
    }

    await requireInteractionAccess(supabase, user, 'comment')

    const moderation = await moderateUserContent({
      text: content,
      imageSources: imageUrl ? [imageUrl] : [],
    })
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
      .from('comments')
      .insert({
        project_id: projectId,
        author_id: user.id,
        content,
        parent_id: parentId,
        reply_to_user_id: replyToUserId,
        reply_to_username: replyToUsername,
        image_url: imageUrl,
        moderation_state: moderation.state,
      } as never)
      .select(COMMENT_SELECT)
      .single()

    if (error || !data) throw error

    const typedComment = data as {
      id: number
      profiles?: { display_name?: string | null; avatar_url?: string | null } | null
    }
    const actorName = typedComment.profiles?.display_name || user.email?.split('@')[0] || '用户'
    const actorAvatar = typedComment.profiles?.avatar_url || getDefaultAvatarPath(user.id)

    if (moderation.state === 'pending') {
      const caseId = await createModerationCase({
        contentType: 'comment',
        contentId: typedComment.id,
        authorId: user.id,
        riskLevel: moderation.riskLevel,
        category: moderation.category,
        reason: moderation.reason,
        modelName: moderation.modelName,
        snapshot: {
          authorId: user.id,
          text: content || null,
          metadata: { projectId, imageUrl },
        },
      })
      return NextResponse.json(
        { comment: data, moderation: { state: 'pending', caseId } },
        { status: 202 },
      )
    }

    const recipients = new Set<string>()

    if (typedProject.author_id && typedProject.author_id !== user.id) {
      recipients.add(typedProject.author_id)
    }
    if (replyToUserId && replyToUserId !== user.id) {
      recipients.add(replyToUserId)
    }

    const notificationRecipients = await filterBlockedRecipients(user.id, [...recipients])
    if (notificationRecipients.length > 0) {
      const projectTitle = typedProject.title || '项目'
      const notificationRows = notificationRecipients.map((recipientId) => ({
        user_id: recipientId,
        type: 'reply',
        content:
          recipientId === replyToUserId
            ? `${actorName} 回复了你在《${projectTitle}》下的评论`
            : `${actorName} 评论了你的项目《${projectTitle}》`,
        related_type: 'comment',
        related_id: typedComment.id,
        project_id: projectId,
        from_user_id: user.id,
        from_username: actorName,
        from_avatar: actorAvatar,
      }))

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationRows as never)

      if (notificationError) throw notificationError
    }

    try {
      await awardXpOnce({
        userId: user.id,
        actionType: 'comment_project',
        resourceId: typedComment.id,
      })
    } catch (awardError) {
      logger.error('Failed to award comment XP', { error: awardError, commentId: typedComment.id })
    }

    try {
      await awardWeeklyCommentGoalIfEligible(user.id)
    } catch (awardError) {
      logger.error('Failed to award weekly comment goal XP', { error: awardError, userId: user.id })
    }

    return NextResponse.json({ comment: data })
  } catch (error) {
    return handleApiError(error)
  }
}
