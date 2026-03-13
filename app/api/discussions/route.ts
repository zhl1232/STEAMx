import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatRelativeTime } from '@/lib/date-utils'
import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireRateLimit } from '@/lib/api/rate-limit'
import { sanitizeSearch } from '@/lib/api/validation'
type DiscussionListItem = {
  id: string | number
  title: string
  author: string
  authorAvatar?: string
  authorAvatarFrameId?: string | null
  authorNameColorId?: string | null
  content: string
  date: string
  likes: number
  tags: string[]
  repliesCount: number
}

type SortOption = 'newest' | 'hottest' | 'most_replies' | 'latest_reply'

function parseSort(value: string | null): SortOption {
  if (value === 'hottest' || value === 'most_replies' || value === 'latest_reply' || value === 'newest') {
    return value
  }
  return 'newest'
}

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const searchParams = request.nextUrl.searchParams

  const page = parseNumber(searchParams.get('page'), 0)
  const pageSize = Math.min(50, Math.max(1, parseNumber(searchParams.get('pageSize'), 10)))
  const rawQuery = searchParams.get('q') || ''
  const searchQuery = rawQuery ? sanitizeSearch(rawQuery) : ''
  const selectedTag = searchParams.get('tag') || ''
  const sortBy = parseSort(searchParams.get('sort'))

  const from = page * pageSize
  const to = from + pageSize - 1

  try {
    let query = supabase
      .from('discussions')
      .select(`
        *,
        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
      `)

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
    }

    if (selectedTag) {
      query = query.contains('tags', [selectedTag])
    }

    switch (sortBy) {
      case 'hottest':
        query = query.order('likes_count', { ascending: false })
        break
      case 'most_replies':
        query = query.order('replies_count', { ascending: false })
        break
      case 'latest_reply':
        query = query.order('last_reply_at', { ascending: false, nullsFirst: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    query = query.range(from, to)

    const { data, error } = await query
    if (error) throw error

    const rows = (data as unknown as {
      id: number
      title: string
      content: string
      created_at: string
      likes_count: number
      tags: string[] | null
      replies_count?: number
      profiles?: {
        display_name?: string | null
        avatar_url?: string | null
        equipped_avatar_frame_id?: string | null
        equipped_name_color_id?: string | null
      } | null
    }[]) || []

    const discussions: DiscussionListItem[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.profiles?.display_name || 'Unknown',
      authorAvatar: row.profiles?.avatar_url || undefined,
      authorAvatarFrameId: row.profiles?.equipped_avatar_frame_id ?? undefined,
      authorNameColorId: row.profiles?.equipped_name_color_id ?? undefined,
      content: row.content,
      date: formatRelativeTime(row.created_at),
      likes: row.likes_count,
      tags: row.tags || [],
      repliesCount: row.replies_count || 0,
    }))

    return NextResponse.json({
      discussions,
      hasMore: rows.length === pageSize,
    })
  } catch (error) {
    console.error('Error in GET /api/discussions:', error)
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
