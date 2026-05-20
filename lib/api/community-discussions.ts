import { formatRelativeTime } from '@/lib/date-utils'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { sanitizeSearch } from '@/lib/api/validation'

export type DiscussionListItem = {
  id: string | number
  title: string
  author: string
  authorId: string
  authorAvatar?: string
  authorAvatarFrameId?: string | null
  authorNameColorId?: string | null
  content: string
  date: string
  likes: number
  tags: string[]
  repliesCount: number
}

export type DiscussionSortOption = 'newest' | 'hottest' | 'most_replies' | 'latest_reply'

export function parseDiscussionSort(value: string | null): DiscussionSortOption {
  if (value === 'hottest' || value === 'most_replies' || value === 'latest_reply' || value === 'newest') {
    return value
  }
  return 'newest'
}

export function parseNonNegativeInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

const DISCUSSION_LIST_SELECT = `
  id,
  title,
  author_id,
  content,
  created_at,
  likes_count,
  tags,
  replies_count,
  last_reply_at,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
`

export async function getDiscussionList(options: {
  page?: number
  pageSize?: number
  query?: string
  tag?: string | null
  sort?: DiscussionSortOption
} = {}): Promise<{ discussions: DiscussionListItem[]; total: number; hasMore: boolean }> {
  const supabase = await createClient()
  const page = Math.max(0, options.page ?? 0)
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 10))
  const searchQuery = options.query ? sanitizeSearch(options.query) : ''
  const selectedTag = (options.tag || '').trim().slice(0, 30)
  const sortBy = options.sort ?? 'newest'
  const from = page * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('discussions')
    .select(DISCUSSION_LIST_SELECT, { count: 'exact' })

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

  const { data, count, error } = await query.range(from, to)
  if (error) {
    logger.error('Error fetching discussion list', { error })
    throw error
  }

  const rows = (data as unknown as {
    id: number
    title: string
    author_id: string
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

  return {
    discussions: rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.profiles?.display_name || 'Unknown',
      authorId: row.author_id,
      authorAvatar: row.profiles?.avatar_url || undefined,
      authorAvatarFrameId: row.profiles?.equipped_avatar_frame_id ?? undefined,
      authorNameColorId: row.profiles?.equipped_name_color_id ?? undefined,
      content: row.content,
      date: formatRelativeTime(row.created_at),
      likes: row.likes_count,
      tags: row.tags || [],
      repliesCount: row.replies_count || 0,
    })),
    total: count ?? rows.length,
    hasMore: typeof count === 'number' ? count > to + 1 : rows.length === pageSize,
  }
}

export async function getDiscussionTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('discussions')
    .select('tags')
    .limit(200)

  if (error) {
    logger.error('Error fetching discussion tags', { error })
    throw error
  }

  return Array.from(
    new Set(
      ((data as { tags: string[] | null }[] | null) || [])
        .flatMap((row) => row.tags || [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 10)
}
