import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { rollbackObservationGamification } from '@/lib/api/observation-gamification'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'

const STATUSES = ['resolved', 'dismissed'] as const
const ACTIONS = ['none', 'hide_observation'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { user } = await requireRole(supabase, ['moderator', 'admin'])

    const { id } = await params
    const reportId = parseInt(id)
    if (isNaN(reportId) || reportId < 1) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const body = await request.json()
    const status = validateEnum(body?.status, 'status', STATUSES)
    const reviewer_note = validateOptionalString(body?.reviewer_note, 'reviewer_note', 1000)
    const action = validateEnum(body?.action || 'none', 'action', ACTIONS)

    if (action !== 'none' && status !== 'resolved') {
      return NextResponse.json({ error: '仅在确认处理时允许执行内容动作' }, { status: 400 })
    }

    const { data: existingReport, error: reportLoadError } = await supabase
      .from('reports')
      .select('id, status, content_type, content_id')
      .eq('id', reportId)
      .maybeSingle()

    if (reportLoadError) throw reportLoadError
    if (!existingReport || existingReport.status !== 'pending') {
      return NextResponse.json({ error: '举报不存在或已处理' }, { status: 404 })
    }

    if (action === 'hide_observation') {
      if (existingReport.content_type !== 'observation') {
        return NextResponse.json({ error: '该动作仅适用于观察记录举报' }, { status: 400 })
      }

      const { data: observation, error: observationError } = await supabase
        .from('observation_events')
        .select('id, user_id, status')
        .eq('id', existingReport.content_id)
        .maybeSingle()

      if (observationError) throw observationError
      if (!observation) {
        return NextResponse.json({ error: '观察记录不存在' }, { status: 404 })
      }

      const { error: updateObservationError } = await supabase
        .from('observation_events')
        .update({ status: 'rejected' } as never)
        .eq('id', existingReport.content_id)

      if (updateObservationError) throw updateObservationError

      if (observation.status === 'approved') {
        await rollbackObservationGamification(observation.user_id, observation.id)
      }
    }

    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        reviewer_id: user.id,
        reviewer_note: reviewer_note || null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq('id', reportId)
      .eq('status', 'pending')
      .select('id, status')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: '举报不存在或已处理' }, { status: 404 })
    }

    return NextResponse.json({ report: data })
  } catch (error) {
    return handleApiError(error)
  }
}
