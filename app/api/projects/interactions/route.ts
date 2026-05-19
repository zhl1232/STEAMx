import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { getTrackedCompletedProjectIds } from '@/lib/completion-records'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

const MAX_PROJECT_IDS = 80

function parseProjectIds(raw: string | null): number[] {
  if (!raw?.trim()) return []

  const ids = new Set<number>()
  for (const part of raw.split(',')) {
    const parsed = Number.parseInt(part.trim(), 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      ids.add(parsed)
    }
    if (ids.size >= MAX_PROJECT_IDS) break
  }

  return Array.from(ids)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const projectIds = parseProjectIds(request.nextUrl.searchParams.get('ids'))

    if (projectIds.length === 0) {
      return NextResponse.json({
        liked: [],
        collected: [],
        completed: [],
        exploring: [],
      })
    }

    const [likesResponse, collectionsResponse, completionsResponse, explorationsResponse] =
      await Promise.all([
        supabase.from('likes').select('project_id').eq('user_id', user.id).in('project_id', projectIds),
        supabase
          .from('collections')
          .select('project_id')
          .eq('user_id', user.id)
          .in('project_id', projectIds),
        supabase
          .from('completed_projects')
          .select('project_id, status, record_kind')
          .eq('user_id', user.id)
          .in('project_id', projectIds),
        supabase
          .from('project_explorations')
          .select('project_id, status')
          .eq('user_id', user.id)
          .in('project_id', projectIds),
      ])

    if (likesResponse.error) throw likesResponse.error
    if (collectionsResponse.error) throw collectionsResponse.error
    if (completionsResponse.error) throw completionsResponse.error
    if (explorationsResponse.error) throw explorationsResponse.error

    const liked = ((likesResponse.data as { project_id: number }[] | null) || []).map(
      (row) => row.project_id,
    )
    const collected = ((collectionsResponse.data as { project_id: number }[] | null) || []).map(
      (row) => row.project_id,
    )
    const completed = getTrackedCompletedProjectIds(
      (completionsResponse.data as {
        project_id: number
        status?: string | null
        record_kind?: string | null
      }[] | null) || [],
    ).filter((id) => projectIds.includes(id))
    const exploring = (
      (explorationsResponse.data as { project_id: number; status?: string }[] | null) || []
    )
      .filter((row) => row.status === 'active')
      .map((row) => row.project_id)

    return NextResponse.json({ liked, collected, completed, exploring })
  } catch (error) {
    logger.error('Error in GET /api/projects/interactions', { error })
    return handleApiError(error)
  }
}
