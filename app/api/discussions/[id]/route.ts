import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'
import { mapDbComment, mapDiscussionFromRow, type DbCommentWithProfile, type DbDiscussionWithProfile, type Comment } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'

const REPLY_SELECT = `
  *,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

function mapReplyRows(rows: DbCommentWithProfile[] | null) {
  return (rows || []).map(mapDbComment)
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

/**
 * GET /api/discussions/[id]
 * 获取讨论详情 + 分页回复
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const discussionId = parseInt(id, 10)
    if (Number.isNaN(discussionId)) {
      return NextResponse.json({ error: 'Invalid discussion id' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseNumber(searchParams.get('page'), 0)
    const pageSize = Math.min(50, Math.max(1, parseNumber(searchParams.get('pageSize'), 10)))

    const { data: rawData, error } = await supabase
      .from('discussions')
      .select(`
        *,
        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
      `)
      .eq('id', discussionId)
      .single()

    if (error || !rawData) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 })
    }

    const from = page * pageSize
    const to = from + pageSize - 1

    // Phase 1: fetch root replies with counts for heat sorting
    const MAX_ROOTS = 500
    const { data: rootReplies, count: rootCount, error: replyError } = await supabase
      .from('discussion_replies')
      .select(REPLY_SELECT, { count: 'exact' })
      .eq('discussion_id', discussionId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(MAX_ROOTS)

    if (replyError) throw replyError

    const rootMapped = mapReplyRows((rootReplies as unknown) as DbCommentWithProfile[] | null)

    // Lightweight descendant count via a single aggregate query
    const rootIds = rootMapped.map((r) => Number(r.id)).filter(Number.isFinite)
    const childCountByRoot = new Map<number, number>()
    if (rootIds.length > 0) {
      const { data: countRows } = await supabase
        .from('discussion_replies')
        .select('parent_id')
        .eq('discussion_id', discussionId)
        .in('parent_id', rootIds) as { data: { parent_id: number }[] | null }
      for (const row of countRows || []) {
        const pid = Number(row.parent_id)
        childCountByRoot.set(pid, (childCountByRoot.get(pid) || 0) + 1)
      }
    }

    const getLikeCount = (reply: Comment): number => {
      const raw = reply as Comment & {
        likes_count?: number
        likes?: number
        like_count?: number
        likeCount?: number
      }
      const value = raw.likes_count ?? raw.likes ?? raw.like_count ?? raw.likeCount ?? 0
      const num = Number(value)
      return Number.isFinite(num) && num > 0 ? num : 0
    }

    const sortedRoots = [...rootMapped].sort((a, b) => {
      const heatA = getLikeCount(a) + (childCountByRoot.get(Number(a.id)) || 0)
      const heatB = getLikeCount(b) + (childCountByRoot.get(Number(b.id)) || 0)
      if (heatB !== heatA) return heatB - heatA
      const t1 = a.created_at ?? ''
      const t2 = b.created_at ?? ''
      if (t2 !== t1) return t2.localeCompare(t1)
      return Number(b.id) - Number(a.id)
    })

    const pagedRoots = sortedRoots.slice(from, to + 1)

    // Phase 2: only fetch nested replies for the paginated roots
    const pagedRootIds = pagedRoots.map((r) => Number(r.id)).filter(Number.isFinite)
    let nestedMapped: Comment[] = []
    if (pagedRootIds.length > 0) {
      const { data: nestedReplies, error: nestedError } = await supabase
        .from('discussion_replies')
        .select(REPLY_SELECT)
        .eq('discussion_id', discussionId)
        .in('parent_id', pagedRootIds)
        .order('created_at', { ascending: true })
        .limit(200)

      if (nestedError) throw nestedError
      nestedMapped = mapReplyRows((nestedReplies as unknown) as DbCommentWithProfile[] | null)
    }

    const mappedReplies = [...pagedRoots, ...nestedMapped]

    let discussionLiked = false
    let likedReplyIds: number[] = []
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (userId) {
      const { data: dLike } = await supabase
        .from('discussion_likes')
        .select('discussion_id')
        .eq('user_id', userId)
        .eq('discussion_id', discussionId)
        .maybeSingle()
      discussionLiked = !!dLike
    }
    if (userId && mappedReplies.length > 0) {
      const replyIds = mappedReplies
        .map((reply) => Number(reply.id))
        .filter((rid) => Number.isFinite(rid))
      if (replyIds.length > 0) {
        const { data: likes, error: likesError } = await supabase
          .from('discussion_reply_likes')
          .select('reply_id')
          .eq('user_id', userId)
          .in('reply_id', replyIds)
        if (likesError) {
          logger.error('Error fetching reply likes', { error: likesError })
        } else if (likes) {
          likedReplyIds = likes
            .map((row) => row.reply_id)
            .filter((rid): rid is number => Number.isFinite(Number(rid)))
        }
      }
    }

    const totalReplies = rootCount || 0
    const hasMore = totalReplies > to + 1

    const discussion = mapDiscussionFromRow(
      rawData as unknown as DbDiscussionWithProfile,
      mappedReplies
    )

    return NextResponse.json({
      discussion,
      totalReplies,
      hasMore,
      likedReplyIds,
      discussionLiked,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/discussions/[id]
 * 编辑讨论标题和正文（仅作者可编辑）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-discussions-write', limit: 20, windowMs: 60_000 })
    const { id } = await params
    const discussionId = parseInt(id, 10)
    if (Number.isNaN(discussionId)) {
      return NextResponse.json({ error: 'Invalid discussion id' }, { status: 400 })
    }

    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (title.length === 0 || content.length === 0) {
      return NextResponse.json({ error: '标题和内容不能为空' }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json({ error: '标题过长' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: '内容过长' }, { status: 400 })
    }

    validateContentSafe(title, '讨论标题')
    validateContentSafe(content, '讨论内容')

    const { data: row } = await supabase
      .from('discussions')
      .select('author_id')
      .eq('id', discussionId)
      .single()
    if (!row || (row as { author_id: string }).author_id !== user.id) {
      return NextResponse.json({ error: '无权编辑此讨论' }, { status: 403 })
    }

    const { error } = await supabase
      .from('discussions')
      .update({ title, content, updated_at: new Date().toISOString() } as never)
      .eq('id', discussionId)
      .eq('author_id', user.id)
    if (error) throw error

    return NextResponse.json({ message: 'Discussion updated', title, content })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/discussions/[id]
 * 删除讨论主题
 * 用户可以删除自己的讨论，管理员/版主可以删除任何讨论
 * 权限由 RLS 策略控制
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-discussions-write', limit: 20, windowMs: 60_000 })
    const { id } = await params
    const discussionId = parseInt(id, 10)

    if (Number.isNaN(discussionId)) {
      return NextResponse.json({ error: 'Invalid discussion id' }, { status: 400 })
    }

    const { data: existingDiscussion, error: existingError } = await supabase
      .from('discussions')
      .select('id')
      .eq('id', discussionId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existingDiscussion) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 })
    }

    const { data: deletedDiscussion, error } = await supabase
      .from('discussions')
      .delete()
      .eq('id', discussionId)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this discussion' },
          { status: 403 }
        )
      }
      throw error
    }

    if (!deletedDiscussion) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this discussion' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      message: 'Discussion deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}
