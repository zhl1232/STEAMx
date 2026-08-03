import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getObservationById } from '@/lib/api/nature-observation-data'
import { handleApiError, requireAuth } from '@/lib/api/auth'
import { requireInteractionAccess } from '@/lib/access/interaction-access'
import { observationLifecycleStageValues, observationSexValues } from '@/lib/observations/traits'
import { callRpc } from '@/lib/supabase/rpc'
import { createClient } from '@/lib/supabase/server'

const IdentificationSchema = z.object({
  species_id: z.number().int().positive(),
  lifecycle_stage: z.enum(observationLifecycleStageValues).nullable().optional(),
  sex: z.enum(observationSexValues).nullable().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

function parseObservationId(id: string): number | null {
  const observationId = Number(id)
  return Number.isInteger(observationId) && observationId > 0 ? observationId : null
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params
  const observation = await getObservationById(id)
  if (!observation) return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
  if (observation.status !== 'approved') return NextResponse.json({ error: '观察记录尚未通过审核' }, { status: 403 })

  return NextResponse.json({
    identificationStatus: observation.identificationStatus,
    confirmedSpecies: observation.species[0] ?? null,
    identifications: observation.identifications ?? [],
  })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'comment')
    const { id } = await params
    const observationId = parseObservationId(id)
    if (!observationId) return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })

    const observation = await getObservationById(observationId)
    if (!observation) return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
    if (observation.status !== 'approved') return NextResponse.json({ error: '观察记录尚未通过审核' }, { status: 403 })

    const parsed = IdentificationSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: '请选择有效物种' }, { status: 400 })

    const { error } = await callRpc(supabase, 'upsert_observation_identification', {
      p_observation_id: observationId,
      p_species_id: parsed.data.species_id,
      p_source: 'human',
      p_lifecycle_stage: parsed.data.lifecycle_stage ?? null,
      p_sex: parsed.data.sex ?? null,
    })
    if (error) throw error

    return GET(request, { params: Promise.resolve({ id }) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  try {
    const user = await requireAuth(supabase)
    await requireInteractionAccess(supabase, user, 'comment')
    const { id } = await params
    const observationId = parseObservationId(id)
    if (!observationId) return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })

    const observation = await getObservationById(observationId)
    if (!observation) return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
    if (observation.status !== 'approved') return NextResponse.json({ error: '观察记录尚未通过审核' }, { status: 403 })

    const { error } = await callRpc(supabase, 'withdraw_my_observation_identification', {
      p_observation_id: observationId,
    })
    if (error) throw error

    return GET(request, { params: Promise.resolve({ id }) })
  } catch (error) {
    return handleApiError(error)
  }
}
