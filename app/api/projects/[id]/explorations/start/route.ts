import { NextRequest, NextResponse } from 'next/server'

import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { validateNumber } from '@/lib/api/validation'
import { ensureJourney } from '@/lib/journeys/service'
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

    const journey = await ensureJourney(supabase, {
      userId: user.id,
      sourceType: 'project',
      sourceId: projectId,
    })
    const now = new Date().toISOString()
    const { data: legacyExploration, error: legacyReadError } = await supabase
      .from('project_explorations')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()
    if (legacyReadError) throw legacyReadError

    const legacyPayload = {
      status: 'active',
      started_at: now,
      last_activity_at: now,
      completed_at: null,
      journey_id: journey.id,
      updated_at: now,
    }
    const legacyResponse = legacyExploration
      ? await supabase
          .from('project_explorations')
          .update(legacyPayload as never)
          .eq('id', legacyExploration.id)
          .select('*')
          .single()
      : await supabase
          .from('project_explorations')
          .insert({ ...legacyPayload, user_id: user.id, project_id: projectId } as never)
          .select('*')
          .single()
    if (legacyResponse.error) throw legacyResponse.error

    return NextResponse.json({ exploration: legacyResponse.data, journey })
  } catch (error) {
    return handleApiError(error)
  }
}
