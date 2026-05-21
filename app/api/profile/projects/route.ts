import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { ValidationError } from '@/lib/api/validation'
import { getLatestCompletionStatusMap, getTrackedCompletedProjectIds } from '@/lib/completion-records'
import { logger } from '@/lib/logger'
import { type DbProject, mapProject } from '@/lib/mappers/project'
import { createClient } from '@/lib/supabase/server'

type ProjectListType = 'my-projects' | 'liked' | 'collected' | 'completed' | 'exploring'

function parseProjectListType(value: string | null): ProjectListType {
  if (
    value === 'my-projects' ||
    value === 'liked' ||
    value === 'collected' ||
    value === 'completed' ||
    value === 'exploring'
  ) {
    return value
  }

  throw new ValidationError('Invalid project list type')
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError('Invalid pagination params')
  }

  return parsed
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const type = parseProjectListType(request.nextUrl.searchParams.get('type'))
    const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1)
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 12)

    if (type === 'my-projects') {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('*, profiles:author_id (display_name)', { count: 'exact' })
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (projectError) throw projectError

      return NextResponse.json({
        projects: ((projectRows as DbProject[] | null) || []).map((project) => mapProject(project)),
        total: projectRows?.length || 0,
      })
    }

    if (type === 'liked' || type === 'collected') {
      const table = type === 'liked' ? 'likes' : 'collections'
      const { data: rows, error: rowsError } = await supabase
        .from(table)
        .select('project_id')
        .eq('user_id', user.id)

      if (rowsError) throw rowsError

      const projectIds = ((rows as { project_id: number }[] | null) || []).map((row) => row.project_id)
      if (projectIds.length === 0) {
        return NextResponse.json({ projects: [] })
      }

      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('*, profiles:author_id (display_name)')
        .in('id', projectIds)
        .order('created_at', { ascending: false })

      if (projectError) throw projectError

      return NextResponse.json({
        projects: ((projectRows as DbProject[] | null) || []).map((project) => mapProject(project)),
      })
    }

    if (type === 'exploring') {
      const { data: explorationRows, error: explorationError } = await supabase
        .from('project_explorations')
        .select('project_id, started_at, last_activity_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('last_activity_at', { ascending: false })

      if (explorationError) throw explorationError

      const projectIds = ((explorationRows as { project_id: number }[] | null) || []).map(
        (row) => row.project_id,
      )

      if (projectIds.length === 0) {
        return NextResponse.json({ projects: [] })
      }

      const { data: projectRows, error: projectError } = await supabase
        .from('projects')
        .select('*, profiles:author_id (display_name)')
        .in('id', projectIds)

      if (projectError) throw projectError

      const projectMap = new Map(
        (((projectRows as DbProject[] | null) || []).map((project) => [Number(project.id), project] as const)),
      )

      const explorationRowsTyped = (explorationRows as {
        project_id: number
        last_activity_at: string
      }[] | null) || []

      return NextResponse.json({
        projects: projectIds
          .map((projectId) => projectMap.get(projectId))
          .filter((project): project is DbProject => Boolean(project))
          .map((project) => mapProject(project)),
        explorations: explorationRowsTyped.map((row) => ({
          projectId: row.project_id,
          lastActivityAt: row.last_activity_at,
        })),
      })
    }

    const { data: completionRows, error: completionRowsError } = await supabase
      .from('completed_projects')
      .select('project_id, status, rejection_reason, completed_at, record_kind')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })

    if (completionRowsError) throw completionRowsError

    const completionData = completionRows as {
      project_id: number
      status?: string | null
      rejection_reason?: string | null
    }[] | null
    const projectIds = getTrackedCompletedProjectIds(completionData || [])

    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [], completionStatusEntries: [] })
    }

    const { data: projectRows, error: projectError } = await supabase
      .from('projects')
      .select('*, profiles:author_id (display_name)')
      .in('id', projectIds)

    if (projectError) throw projectError

    const projectMap = new Map(
      (((projectRows as DbProject[] | null) || []).map((project) => [Number(project.id), project] as const)),
    )
    const completionStatusMap = getLatestCompletionStatusMap(completionData || [])

    return NextResponse.json({
      projects: projectIds
        .map((projectId) => projectMap.get(projectId))
        .filter((project): project is DbProject => Boolean(project))
        .map((project) => mapProject(project)),
      completionStatusEntries: Array.from(completionStatusMap.entries()),
    })
  } catch (error) {
    logger.error('Error in GET /api/profile/projects', { error })
    return handleApiError(error)
  }
}
