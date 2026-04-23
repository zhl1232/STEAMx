import { NextRequest, NextResponse } from 'next/server'

import { rollbackObservationGamification } from '@/lib/api/observation-gamification'
import { getObservationById } from '@/lib/api/nature-observation-data'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const observation = await getObservationById(id)

    if (!observation) {
      return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
    }

    return NextResponse.json({ observation })
  } catch (error) {
    logger.error('Error in GET /api/observations/[id]', { error })
    return NextResponse.json({ error: 'Failed to fetch observation detail' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const { id } = await params
    const observationId = Number(id)

    if (!Number.isInteger(observationId) || observationId <= 0) {
      return NextResponse.json({ error: 'Invalid observation id' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('observation_events')
      .select('id, user_id')
      .eq('id', observationId)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase
      .from('observation_events')
      .delete()
      .eq('id', observationId)
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    const rollback = await rollbackObservationGamification(user.id, observationId)

    return NextResponse.json({ ok: true, rollback })
  } catch (error) {
    return handleApiError(error)
  }
}
