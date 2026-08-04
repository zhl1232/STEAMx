import { NextRequest, NextResponse } from 'next/server'

import { requireRole, handleApiError } from '@/lib/api/auth'
import { validateEnum, validateNumber, validateOptionalString } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import { awardXpOnce } from '@/lib/api/server-awards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { setContentModerationState } from '@/lib/safety/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const actor = await requireRole(supabase, ['moderator', 'admin'])
    const body = await request.json()

    const action = validateEnum(body.action, 'Action', ['approve', 'reject'] as const)
    const rejectionReason = validateOptionalString(body.rejection_reason, 'Rejection reason', 500)

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json({ error: 'Rejection reason is required when rejecting a submission' }, { status: 400 })
    }

    const { id } = await params
    const submissionId = validateNumber(id, 'Submission id', { min: 1, integer: true })

    const { data: existing, error: existingError } = await supabase
      .from('challenge_submissions')
      .select('id, user_id, challenge_id, status')
      .eq('id', submissionId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json({ error: 'Challenge submission not found' }, { status: 404 })
    }

    if (action === 'approve') {
      const { error: updateError } = await supabase
        .from('challenge_submissions')
        .update({
          status: 'approved',
          reviewed_by: actor.user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
        } as never)
        .eq('id', submissionId)

      if (updateError) throw updateError
      await setContentModerationState('challenge_submission', submissionId, 'approved')

      let evergreenCompletionRecorded = false
      try {
        evergreenCompletionRecorded = await handleEvergreenCompletion(
          existing as { user_id: string; challenge_id: number },
        )
      } catch (completionError) {
        logger.error(completionError, { context: 'Failed to record evergreen challenge completion', submissionId })
      }

      return NextResponse.json({
        message: 'Challenge submission approved successfully',
        status: 'approved',
        evergreenCompletionRecorded,
      })
    }

    const { error: updateError } = await supabase
      .from('challenge_submissions')
      .update({
        status: 'rejected',
        reviewed_by: actor.user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason || '',
      } as never)
      .eq('id', submissionId)

    if (updateError) throw updateError
    await setContentModerationState('challenge_submission', submissionId, 'rejected')

    return NextResponse.json({
      message: 'Challenge submission rejected',
      status: 'rejected',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

async function handleEvergreenCompletion(submission: { user_id: string; challenge_id: number }) {
  if (!supabaseAdmin) {
    return false
  }

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('challenges')
    .select('id, challenge_type, status')
    .eq('id', submission.challenge_id)
    .maybeSingle()

  if (challengeError) throw challengeError
  if (!challenge || challenge.challenge_type !== 'evergreen') {
    return false
  }

  const { data: insertedCompletion, error: completionError } = await supabaseAdmin
    .from('challenge_completions')
    .upsert({
      user_id: submission.user_id,
      challenge_id: submission.challenge_id,
      project_id: null,
    } as never, { onConflict: 'user_id,challenge_id', ignoreDuplicates: true })
    .select('challenge_id')

  if (completionError) throw completionError
  if (!insertedCompletion || insertedCompletion.length === 0) {
    return false
  }

  await awardXpOnce({
    userId: submission.user_id,
    actionType: 'complete_challenge',
    resourceId: submission.challenge_id,
  })

  return true
}
