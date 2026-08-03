import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { getAccessibleProject } from '@/lib/api/project-access'
import { createClient } from '@/lib/supabase/server'

function parseProjectId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) return null

  const projectId = Number(id)
  return Number.isSafeInteger(projectId) ? projectId : null
}

/**
 * POST /api/projects/[id]/collection
 * 收藏/取消收藏项目。
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { id } = await params
  const projectId = parseProjectId(id)

  if (projectId == null) {
    return NextResponse.json({ error: 'Invalid project id' }, { status: 400 })
  }

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'engage')

    const project = await getAccessibleProject(supabase, projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { data: existingCollection, error: existingError } = await supabase
      .from('collections')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()

    if (existingError) throw existingError

    if (existingCollection) {
      const { data: deletedRows, error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('user_id', user.id)
        .eq('project_id', projectId)
        .select('user_id')

      if (deleteError) throw deleteError

      return NextResponse.json({
        collected: false,
        action: 'uncollected',
        changed: Boolean(deletedRows?.length),
      })
    }

    const { error: insertError } = await supabase
      .from('collections')
      .insert({ user_id: user.id, project_id: projectId } as never)

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ collected: true, action: 'collected', changed: false })
      }
      throw insertError
    }

    return NextResponse.json({ collected: true, action: 'collected', changed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
