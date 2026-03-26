import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { getAccessibleCompletion } from '@/lib/api/completion-access'
import { logger } from '@/lib/logger'

function parseCompletionId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) {
    return null
  }

  const completionId = Number(id)
  if (!Number.isSafeInteger(completionId)) {
    return null
  }

  return completionId
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = parseCompletionId(id)
    if (completionId == null) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const completion = await getAccessibleCompletion(supabase, completionId, user?.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }

    const { count, error: countError } = await supabase
      .from('completion_likes')
      .select('*', { count: 'exact', head: true })
      .eq('completed_project_id', completionId)

    if (countError) throw countError

    let isLiked = false
    if (user) {
      const { data: likeRow, error: likeError } = await supabase
        .from('completion_likes')
        .select('user_id')
        .eq('completed_project_id', completionId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (likeError) throw likeError
      isLiked = !!likeRow
    }

    return NextResponse.json({
      count: count || 0,
      isLiked,
    })
  } catch (error) {
    logger.error('Error in GET /api/completions/[id]/likes', { error })
    return NextResponse.json({ error: 'Failed to fetch likes' }, { status: 500 })
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = parseCompletionId(id)
    if (completionId == null) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-completion-likes', limit: 20, windowMs: 60_000 })

    const completion = await getAccessibleCompletion(supabase, completionId, user.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }
    if (completion.user_id === user.id) {
      return NextResponse.json({ error: '不能给自己的作品点赞' }, { status: 403 })
    }

    const { error } = await supabase
      .from('completion_likes')
      .insert({
        completed_project_id: completionId,
        user_id: user.id,
      } as never)

    if (error && error.code !== '23505') {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const completionId = parseCompletionId(id)
    if (completionId == null) {
      return NextResponse.json({ error: 'Invalid completion id' }, { status: 400 })
    }
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-completion-likes', limit: 20, windowMs: 60_000 })

    const completion = await getAccessibleCompletion(supabase, completionId, user.id)
    if (!completion) {
      return NextResponse.json({ error: '作品不存在' }, { status: 404 })
    }

    const { error } = await supabase
      .from('completion_likes')
      .delete()
      .eq('completed_project_id', completionId)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
