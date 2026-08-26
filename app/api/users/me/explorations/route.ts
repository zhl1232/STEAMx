import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { mapDbProject } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/users/me/explorations?status=active
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const status = request.nextUrl.searchParams.get('status') || 'active'

    let query = supabase
      .from('project_explorations')
      .select('*, projects:project_id (*, profiles:author_id (display_name))')
      .eq('user_id', user.id)
      .order('last_activity_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query
    if (error) throw error

    const items = ((data as Array<Record<string, unknown>>) || []).map((row) => {
      const project = row.projects as Parameters<typeof mapDbProject>[0] | null
      return {
        id: row.id,
        projectId: row.project_id,
        status: row.status,
        startedAt: row.started_at,
        lastActivityAt: row.last_activity_at,
        project: project ? mapDbProject(project, { includeInternalDifficulty: true }) : null,
      }
    })

    return NextResponse.json({ explorations: items })
  } catch (error) {
    return handleApiError(error)
  }
}
