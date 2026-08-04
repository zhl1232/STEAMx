import { NextRequest, NextResponse } from 'next/server'

import { handleApiError } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { mapDbComment, type DbCommentWithProfile } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

const MAX_COMPLETION_IDS = 60
const PREVIEW_PER_COMPLETION = 2

const COMMENT_SELECT = `
  id,
  content,
  created_at,
  author_id,
  parent_id,
  reply_to_user_id,
  reply_to_username,
  completed_project_id,
  moderation_state,
  profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
`

function parseCompletionIds(raw: string | null): number[] {
  if (!raw?.trim()) return []

  const ids = new Set<number>()
  for (const part of raw.split(',')) {
    const parsed = Number.parseInt(part.trim(), 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      ids.add(parsed)
    }
    if (ids.size >= MAX_COMPLETION_IDS) break
  }

  return Array.from(ids)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const completionIds = parseCompletionIds(request.nextUrl.searchParams.get('ids'))
    if (completionIds.length === 0) {
      return NextResponse.json({ previews: {} })
    }

    const rowLimit = Math.min(completionIds.length * 12, 240)
    const { data, error } = await supabase
      .from('completion_comments')
      .select(COMMENT_SELECT)
      .in('completed_project_id', completionIds)
      .eq('moderation_state', 'approved')
      .order('created_at', { ascending: false })
      .limit(rowLimit)

    if (error) throw error

    const previews: Record<string, ReturnType<typeof mapDbComment>[]> = {}
    for (const id of completionIds) {
      previews[String(id)] = []
    }

    for (const row of (data as DbCommentWithProfile[] | null) || []) {
      const completionId = Number((row as { completed_project_id?: number }).completed_project_id)
      const key = String(completionId)
      const bucket = previews[key]
      if (!bucket || bucket.length >= PREVIEW_PER_COMPLETION) continue
      bucket.unshift(mapDbComment(row))
    }

    return NextResponse.json({ previews })
  } catch (error) {
    logger.error('Error in GET /api/completions/comments/preview', { error })
    return handleApiError(error)
  }
}
