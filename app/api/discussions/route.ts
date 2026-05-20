import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { validateContentSafe } from '@/lib/api/validation'
import {
  getDiscussionList,
  parseDiscussionSort,
  parseNonNegativeInt,
} from '@/lib/api/community-discussions'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  try {
    const result = await getDiscussionList({
      page: parseNonNegativeInt(searchParams.get('page'), 0),
      pageSize: parseNonNegativeInt(searchParams.get('pageSize'), 10),
      query: searchParams.get('q') || '',
      tag: searchParams.get('tag'),
      sort: parseDiscussionSort(searchParams.get('sort')),
    })
    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error in GET /api/discussions', { error })
    return NextResponse.json({ error: 'Failed to fetch discussions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireRateLimit(supabase, { key: 'api-discussions-write', limit: 20, windowMs: 60_000 })
    const body = await request.json()

    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    const tags = Array.isArray(body?.tags)
      ? body.tags.map((tag: string) => String(tag).trim()).filter(Boolean).slice(0, 10)
      : []

    if (!title || !content) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    if (title.length > 200) {
      return NextResponse.json({ error: 'Title must not exceed 200 characters' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Content must not exceed 5000 characters' }, { status: 400 })
    }
    if (tags.some((t: string) => t.length > 30)) {
      return NextResponse.json({ error: 'Each tag must not exceed 30 characters' }, { status: 400 })
    }

    validateContentSafe(title, '讨论标题')
    validateContentSafe(content, '讨论内容')

    const { data, error } = await supabase
      .from('discussions')
      .insert({
        title,
        content,
        author_id: user.id,
        tags,
      } as never)
      .select(`
        *,
        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
      `)
      .single()

    if (error || !data) throw error

    return NextResponse.json({ discussion: data })
  } catch (error) {
    return handleApiError(error)
  }
}
