import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { mapDbComment, mapDiscussionFromRow, type DbCommentWithProfile, type DbDiscussionWithProfile } from '@/lib/mappers/types'

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
      .order('created_at', { ascending: false })
      .range(from, to)

    if (replyError) throw replyError

    let mappedReplies = mapReplyRows((rootReplies as unknown) as DbCommentWithProfile[] | null)

    if (rootReplies && rootReplies.length > 0) {
      const rootIds = (rootReplies as { id: number }[]).map((reply) => reply.id)
      const { data: nestedReplies } = await supabase
        .from('discussion_replies')
        .select(REPLY_SELECT)
        .in('parent_id', rootIds)
        .order('created_at', { ascending: false })
      mappedReplies = [
        ...mappedReplies,
        ...mapReplyRows((nestedReplies as unknown) as DbCommentWithProfile[] | null),
      ]
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
