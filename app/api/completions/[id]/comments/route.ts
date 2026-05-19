import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { validateContentSafe, validateNumber } from '@/lib/api/validation'
import { mapDbComment, type DbCommentWithProfile } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'

const COMMENT_SELECT = `
  id,
  content,
  created_at,
  author_id,
  parent_id,
  reply_to_user_id,
  reply_to_username,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = validateNumber(id, 'Completion id', { min: 1, integer: true })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const completion = await getAccessibleCompletion(supabase, completionId, user?.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }

    const limit = Math.min(200, Math.max(1, parseNumber(request.nextUrl.searchParams.get('limit'), 200)))

    const { data, error } = await supabase
      .from('completion_comments')
      .select(COMMENT_SELECT)
      .eq('completed_project_id', completionId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    const comments = ((data || []) as DbCommentWithProfile[]).map(mapDbComment)

    return NextResponse.json({ comments })
  } catch (error) {
    logger.error('Error in GET /api/completions/[id]/comments', { error })
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-completion-comments', limit: 10, windowMs: 60_000 })
    const { id } = await params
    const completionId = validateNumber(id, 'Completion id', { min: 1, integer: true })

    const completion = await getAccessibleCompletion(supabase, completionId, user.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const payload = body as { content?: unknown; parent_id?: unknown }
    const content = typeof payload.content === 'string' ? payload.content.trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
    }
    if (content.length > 500) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 })
    }

    validateContentSafe(content, '评论内容')

    let parentId: number | null = null
    if (payload.parent_id != null && payload.parent_id !== '') {
      const parsedParent = Number(payload.parent_id)
      if (!Number.isInteger(parsedParent) || parsedParent <= 0) {
        return NextResponse.json({ error: '无效的 parent_id' }, { status: 400 })
      }
      parentId = parsedParent
    }

    let replyToUserId: string | null = null
    let replyToUsername: string | null = null

    if (parentId !== null) {
      const { data: parentComment } = await supabase
        .from('completion_comments')
        .select('completed_project_id, author_id, profiles:author_id(display_name)')
        .eq('id', parentId)
        .maybeSingle()

      if (!parentComment) {
        return NextResponse.json({ error: '父评论不存在' }, { status: 400 })
      }

      const typed = parentComment as {
        completed_project_id: number
        author_id: string
        profiles?: { display_name?: string | null } | null
      }

      if (typed.completed_project_id !== completionId) {
        return NextResponse.json({ error: '父评论不属于当前探索记录' }, { status: 400 })
      }

      replyToUserId = typed.author_id
      replyToUsername = typed.profiles?.display_name || null
    }

    const { data, error } = await supabase
      .from('completion_comments')
      .insert({
        completed_project_id: completionId,
        author_id: user.id,
        content,
        parent_id: parentId,
        reply_to_user_id: replyToUserId,
        reply_to_username: replyToUsername,
      } as never)
      .select(COMMENT_SELECT)
      .single()

    if (error) throw error

    return NextResponse.json({ comment: mapDbComment(data as DbCommentWithProfile) })
  } catch (error) {
    return handleApiError(error)
  }
}
