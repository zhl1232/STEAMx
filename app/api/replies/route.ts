import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe, isOwnedCommentImageUrl } from '@/lib/api/validation'

const REPLY_SELECT = `
  *,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

/**
 * POST /api/replies
 * 创建讨论回复（含敏感词过滤）
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-replies-create', limit: 30, windowMs: 60_000 })

    const body = await request.json()
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const discussionId = Number(body?.discussion_id)
    const parentId = body?.parent_id == null ? null : Number(body.parent_id)
    const imageUrl = body?.image_url ?? null

    if (!content && !imageUrl) {
      return NextResponse.json({ error: '回复内容不能为空' }, { status: 400 })
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: '回复内容过长' }, { status: 400 })
    }
    if (!Number.isInteger(discussionId) || discussionId <= 0) {
      return NextResponse.json({ error: '缺少 discussion_id' }, { status: 400 })
    }
    if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
      return NextResponse.json({ error: '无效的 parent_id' }, { status: 400 })
    }

    const { data: discussionRow, error: discussionError } = await supabase
      .from('discussions')
      .select('id')
      .eq('id', discussionId)
      .maybeSingle()

    if (discussionError) throw discussionError
    if (!discussionRow) {
      return NextResponse.json({ error: '讨论不存在' }, { status: 404 })
    }

    if (content) {
      validateContentSafe(content, '回复内容')
    }

    if (imageUrl !== null) {
      if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
        return NextResponse.json({ error: '无效的回复图片' }, { status: 400 })
      }

      if (!isOwnedCommentImageUrl(imageUrl, user.id)) {
        return NextResponse.json({ error: '回复图片必须使用当前账号上传的文件' }, { status: 400 })
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('level')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) throw profileError

      const level = Number((profileRow as { level?: number } | null)?.level ?? 1)
      if (level < 2) {
        return NextResponse.json({ error: '等级达到 2 级后才可发送回复图片' }, { status: 403 })
      }
    }

    let replyToUserId: string | null = null
    let replyToUsername: string | null = null

    if (parentId !== null) {
      const { data: parentReply, error: parentError } = await supabase
        .from('discussion_replies')
        .select('discussion_id, author_id, profiles:author_id(display_name)')
        .eq('id', parentId)
        .maybeSingle()

      if (parentError) throw parentError
      if (!parentReply) {
        return NextResponse.json({ error: '父回复不存在' }, { status: 400 })
      }

      const typedParent = parentReply as {
        discussion_id: number
        author_id: string
        profiles?: { display_name?: string | null } | null
      }

      if (typedParent.discussion_id !== discussionId) {
        return NextResponse.json({ error: '父回复不属于当前讨论' }, { status: 400 })
      }

      replyToUserId = typedParent.author_id
      replyToUsername = typedParent.profiles?.display_name || null
    }

    const { data, error } = await supabase
      .from('discussion_replies')
      .insert({
        discussion_id: discussionId,
        author_id: user.id,
        content,
        parent_id: parentId,
        reply_to_user_id: replyToUserId,
        reply_to_username: replyToUsername,
        image_url: imageUrl,
      } as never)
      .select(REPLY_SELECT)
      .single()

    if (error || !data) throw error

    return NextResponse.json({ reply: data })
  } catch (error) {
    return handleApiError(error)
  }
}
