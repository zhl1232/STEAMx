import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { validateNumber } from '@/lib/api/validation'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/projects/[id]/explorations/start
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'save_progress')
    const { id } = await params
    const projectId = validateNumber(id, 'Project id', { min: 1, integer: true })

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .maybeSingle()

    if (projectError) throw projectError
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { data: exploration, error: explorationError } = await supabase
      .from('project_explorations')
      .upsert(
        {
          user_id: user.id,
          project_id: projectId,
          status: 'active',
          started_at: now,
          last_activity_at: now,
          completed_at: null,
          updated_at: now,
        } as never,
        { onConflict: 'user_id,project_id' },
      )
      .select('*')
      .single()

    if (explorationError) throw explorationError

    return NextResponse.json({ exploration })
  } catch (error) {
    return handleApiError(error)
  }
}
