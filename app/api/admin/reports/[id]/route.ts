import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, handleApiError } from '@/lib/api/auth'
import { rollbackObservationGamification } from '@/lib/api/observation-gamification'
import { validateEnum, validateOptionalString } from '@/lib/api/validation'
import { applySafetyAction, setContentModerationState, syncSafetyProjection } from '@/lib/safety/server'

const STATUSES = ['resolved', 'dismissed'] as const
const ACTIONS = [
  'none',
  'hide_content',
  'restore_content',
  'hide_observation',
  'warning',
  'restrict_24h',
  'restrict_7d',
  'restrict_30d',
  'suspend',
  'ban',
] as const

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
      .select('id, status, content_type, content_id, author_id, moderation_case_id')
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
      await setContentModerationState('observation', existingReport.content_id, 'hidden')
    }

    if (action === 'hide_content') {
      await setContentModerationState(existingReport.content_type, existingReport.content_id, 'hidden')
    }

    if (action === 'restore_content') {
      await setContentModerationState(existingReport.content_type, existingReport.content_id, 'approved')
    }

    const accountActions = new Set([
      'warning',
      'restrict_24h',
      'restrict_7d',
      'restrict_30d',
      'suspend',
      'ban',
    ])
    if (accountActions.has(action) && existingReport.author_id) {
      const durationHours = action === 'restrict_24h'
        ? 24
        : action === 'restrict_7d'
          ? 24 * 7
          : action === 'restrict_30d' || action === 'suspend'
            ? 24 * 30
            : undefined
      const actionType = action === 'warning'
        ? 'warning'
        : action === 'ban'
          ? 'account_ban'
          : action === 'suspend'
            ? 'account_suspension'
            : 'interaction_restriction'
      const endsAt = durationHours
        ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
        : null

      await applySafetyAction({
        userId: existingReport.author_id,
        actionType,
        reason: reviewer_note || '举报确认违规',
        createdBy: user.id,
        sourceReportId: reportId,
        sourceCaseId: existingReport.moderation_case_id,
        endsAt,
        metadata: { action },
      })
      await syncSafetyProjection(existingReport.author_id)
    }

    if (existingReport.moderation_case_id) {
      const moderationCaseStatus = status === 'resolved' && action === 'restore_content'
        ? 'approved'
        : status === 'resolved' && (action === 'hide_content' || action === 'hide_observation')
          ? 'hidden'
          : 'rejected'
      const { error: caseError } = await supabase
        .from('moderation_cases')
        .update({
          status: moderationCaseStatus,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', existingReport.moderation_case_id)
      if (caseError) throw caseError
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
