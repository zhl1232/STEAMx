import { NextRequest, NextResponse } from 'next/server'
import { getProjectComments } from '@/lib/api/explore-data'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(0, parsed)
}

function canAccessProject(project: { author_id: string; status: string | null } | null, viewerId?: string) {
  if (!project) return false
  if (!project.status || project.status === 'approved') return true
  return project.author_id === viewerId
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
    }
    const projectId = Number(id)
    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
    }

    const { data: authData } = await supabase.auth.getUser()
    const viewerId = authData.user?.id

    const { data: projectRow, error: projectError } = await supabase
      .from('projects')
      .select('author_id, status')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) throw projectError
    if (!projectRow || !canAccessProject(projectRow as { author_id: string; status: string | null }, viewerId)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseNumber(searchParams.get('page'), 0)
    const pageSize = Math.min(50, Math.max(1, parseNumber(searchParams.get('pageSize'), 5)))

    const data = await getProjectComments(projectId, page, pageSize, { userId: viewerId })
    return NextResponse.json(data)
  } catch (error) {
    logger.error('Error in GET /api/projects/[id]/comments', { error })
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}
