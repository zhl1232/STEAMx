import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe, isOwnedCommentImageUrl } from '@/lib/api/validation'

const COMMENT_SELECT = `
  *,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

function canAccessProject(
  project: { author_id: string; status: string | null } | null,
  viewerId: string,
) {
  if (!project) return false
  if (!project.status || project.status === 'approved') return true
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
      .select('author_id, status')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) throw projectError
    if (!projectRow) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }
    if (!canAccessProject(projectRow as { author_id: string; status: string | null }, user.id)) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
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

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('level')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      const level = Number((profileRow as { level?: number } | null)?.level ?? 1)
      if (level < 2) {
        return NextResponse.json({ error: '等级达到 2 级后才可发送评论图片' }, { status: 403 })
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

      replyToUserId = typedParent.author_id
      replyToUsername = typedParent.profiles?.display_name || null
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
      } as never)
      .select(COMMENT_SELECT)
      .single()

    if (error || !data) throw error

    return NextResponse.json({ comment: data })
  } catch (error) {
    return handleApiError(error)
  }
}
