import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { mapDbComment, mapDiscussionFromRow, type DbCommentWithProfile, type DbDiscussionWithProfile, type Comment } from '@/lib/mappers/types'

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

    const { data: rootReplies, count: rootCount, error: replyError } = await supabase
      .from('discussion_replies')
      .select(REPLY_SELECT, { count: 'exact' })
      .eq('discussion_id', discussionId)
      .is('parent_id', null)

    if (replyError) throw replyError

    const { data: nestedReplies, error: nestedError } = await supabase
      .from('discussion_replies')
      .select(REPLY_SELECT)
      .eq('discussion_id', discussionId)
      .not('parent_id', 'is', null)
      .order('created_at', { ascending: false })

    if (nestedError) throw nestedError

    const rootMapped = mapReplyRows((rootReplies as unknown) as DbCommentWithProfile[] | null)
    const nestedMapped = mapReplyRows((nestedReplies as unknown) as DbCommentWithProfile[] | null)
    const allReplies = [...rootMapped, ...nestedMapped]

    // Build reply graph for heat calculation (likes + reply count)
    const childrenByParent = new Map<number, Comment[]>()
    for (const reply of allReplies) {
      if (reply.parent_id == null) continue
      const pid = Number(reply.parent_id)
      if (Number.isNaN(pid)) continue
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid)!.push(reply)
    }

    const replyCountMemo = new Map<number, number>()
    const countDescendants = (id: number): number => {
      if (replyCountMemo.has(id)) return replyCountMemo.get(id)!
      const children = childrenByParent.get(id) || []
      let total = 0
      for (const child of children) {
        total += 1 + countDescendants(Number(child.id))
      }
      replyCountMemo.set(id, total)
      return total
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
      const heatA = getLikeCount(a) + countDescendants(Number(a.id))
      const heatB = getLikeCount(b) + countDescendants(Number(b.id))
      if (heatB !== heatA) return heatB - heatA
      const t1 = a.created_at ?? ''
      const t2 = b.created_at ?? ''
      if (t2 !== t1) return t2.localeCompare(t1)
      return Number(b.id) - Number(a.id)
    })

    const pagedRoots = sortedRoots.slice(from, to + 1)
    const pagedReplies: Comment[] = []
    const seen = new Set<string>()

    const collectDescendants = (rootId: number) => {
      const queue = [rootId]
      while (queue.length > 0) {
        const id = queue.shift()!
        const children = childrenByParent.get(id) || []
        for (const child of children) {
          const key = String(child.id)
          if (seen.has(key)) continue
          seen.add(key)
          pagedReplies.push(child)
          queue.push(Number(child.id))
        }
      }
    }

    for (const root of pagedRoots) {
      const key = String(root.id)
      if (!seen.has(key)) {
        seen.add(key)
        pagedReplies.push(root)
      }
      collectDescendants(Number(root.id))
    }

    const mappedReplies = pagedReplies

    let likedReplyIds: number[] = []
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id
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
          console.error('Error fetching reply likes:', likesError)
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
    })
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  
  try {
    // 检查用户认证
    await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-discussions-write', limit: 20, windowMs: 60_000 })
    const { id } = await params
    const discussionId = parseInt(id)
    
    // 直接执行删除,RLS 策略会自动检查权限
    // 策略: 仅讨论作者或管理员/版主可删除 discussion 记录
    const { error } = await supabase
      .from('discussions')
      .delete()
      .eq('id', discussionId)
    
    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to delete this discussion' },
          { status: 403 }
        )
      }
      throw error
    }
    
    return NextResponse.json({ 
      message: 'Discussion deleted successfully' 
    })
  } catch (error) {
    return handleApiError(error)
  }
}
