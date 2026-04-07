import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { type DbProject, mapProject } from '@/lib/mappers/project'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    const { data: projectRows, error: projectError, count } = await supabase
      .from('projects')
      .select('*, profiles:author_id (display_name)', { count: 'exact' })
      .eq('author_id', user.id)
      .gt('likes_count', 0)
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })

    if (projectError) throw projectError

    const projects = ((projectRows as DbProject[] | null) || []).map((project) => mapProject(project))
    const totalLikesReceived = projects.reduce((sum, project) => sum + (project.likes || 0), 0)

    return NextResponse.json({
      projects,
      totalProjects: count || 0,
      totalLikesReceived,
    })
  } catch (error) {
    logger.error('Error in GET /api/profile/likes-received', { error })
    return handleApiError(error)
  }
}
