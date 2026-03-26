import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { validateContentSafe, validateNumber } from '@/lib/api/validation'
import { logger } from '@/lib/logger'

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
      .select('id, content')
      .eq('completed_project_id', completionId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ comments: data || [] })
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
    const content = typeof (body as { content?: unknown })?.content === 'string' ? ((body as { content: string }).content).trim() : ''
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 })
    }
    if (content.length > 500) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 })
    }

    validateContentSafe(content, '评论内容')

    const { data, error } = await supabase
      .from('completion_comments')
      .insert({
        completed_project_id: completionId,
        author_id: user.id,
        content,
      } as never)
      .select('id, content')
      .single()

    if (error) throw error

    return NextResponse.json({ comment: data })
  } catch (error) {
    return handleApiError(error)
  }
}
