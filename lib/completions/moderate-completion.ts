import type { Json } from '@/lib/supabase/types'
import { evaluateCompletionContent } from '@/lib/ai/completion-moderation'
import { enqueueAutoInteractionsForTarget } from '@/lib/auto-interactions'
import { approveCompletionWithXp, rejectCompletion } from '@/lib/completions/approve'
import { callRpc } from '@/lib/supabase/rpc'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createModerationCase } from '@/lib/safety/server'
import { reviewJourneyRecordModeration } from '@/lib/journeys/service'

type CompletionRow = {
  id: number
  user_id: string
  project_id: number | null
  course_lesson_id: number | null
  record_kind: string | null
  status: string | null
  proof_images: string[] | null
  notes: string | null
  exploration_id: number | null
  journey_record_id: number | null
  moderation_state: string | null
}

export async function runCompletionModeration(completionId: number): Promise<{
  status: 'approved' | 'rejected' | 'skipped'
  reason?: string
}> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const { data: completion, error: fetchError } = await supabaseAdmin
    .from('completed_projects')
    .select('id, user_id, project_id, course_lesson_id, record_kind, status, proof_images, notes, exploration_id, journey_record_id, moderation_state')
    .eq('id', completionId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!completion) {
    return { status: 'skipped', reason: 'not_found' }
  }

  const row = completion as CompletionRow
  if (row.status !== 'pending') {
    return { status: 'skipped', reason: 'not_pending' }
  }

  await supabaseAdmin
    .from('completion_moderation_logs')
    .upsert(
      {
        completion_id: completionId,
        status: 'running',
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'completion_id' },
    )

  try {
    const decision = await evaluateCompletionContent({
      notes: row.notes,
      imageUrls: row.proof_images || [],
      skipImageModeration: row.moderation_state === 'approved',
    })

    const rawResponse = {
      imageResults: decision.imageResults,
    } as Json

    if (decision.pending) {
      await supabaseAdmin
        .from('completed_projects')
        .update({ moderation_state: 'pending' } as never)
        .eq('id', completionId)
      if (row.journey_record_id) {
        await reviewJourneyRecordModeration(
          supabaseAdmin,
          row.journey_record_id,
          'pending',
          null,
          decision.reason || '等待人工审核',
          'ai',
        )
      }
      const caseId = await createModerationCase({
        contentType: 'completion',
        contentId: completionId,
        authorId: row.user_id,
        riskLevel: 'medium',
        category: 'moderation_unavailable',
        reason: decision.reason || '图片审核服务暂时不可用，等待人工审核。',
        modelName: 'completion-vision-unavailable',
        snapshot: {
          authorId: row.user_id,
          text: row.notes,
          metadata: { imageUrls: row.proof_images || [] },
        },
      })
      await supabaseAdmin
        .from('completion_moderation_logs')
        .update({
          status: 'queued',
          moderation_pass: null,
          moderation_reason: decision.reason,
          raw_response: rawResponse,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('completion_id', completionId)
      return { status: 'skipped', reason: `moderation_pending:${caseId}` }
    }

    if (!decision.pass) {
      await rejectCompletion(completionId, decision.reason || '内容未通过审核')
      await supabaseAdmin
        .from('completed_projects')
        .update({ moderation_state: 'rejected' } as never)
        .eq('id', completionId)
      if (row.journey_record_id) {
        await reviewJourneyRecordModeration(
          supabaseAdmin,
          row.journey_record_id,
          'rejected',
          null,
          decision.reason || '内容未通过审核',
          'ai',
        )
      }
      await supabaseAdmin
        .from('completion_moderation_logs')
        .update({
          status: 'done',
          moderation_pass: false,
          moderation_reason: decision.reason,
          raw_response: rawResponse,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('completion_id', completionId)

      return { status: 'rejected', reason: decision.reason || undefined }
    }

    const recordKind = row.record_kind ?? 'final'
    if (recordKind === 'final') {
      await approveCompletionWithXp(completionId)
    } else {
      const { error: approveError } = await callRpc(supabaseAdmin, 'system_approve_completion', {
        p_completion_id: completionId,
      })
      if (approveError) throw approveError
    }

    await supabaseAdmin
      .from('completed_projects')
      .update({ moderation_state: 'approved' } as never)
      .eq('id', completionId)

    if (row.journey_record_id) {
      await reviewJourneyRecordModeration(
        supabaseAdmin,
        row.journey_record_id,
        'approved',
        null,
        null,
        'ai',
      )
    }

    if (recordKind !== 'final' && row.exploration_id) {
      await supabaseAdmin
        .from('project_explorations')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
        .eq('id', row.exploration_id)
    }

    try {
      await enqueueAutoInteractionsForTarget('completion', completionId)
    } catch (autoInteractionError) {
      logger.error(autoInteractionError, { context: 'Completion auto interaction enqueue failed', completionId })
    }

    await supabaseAdmin
      .from('completion_moderation_logs')
      .update({
        status: 'done',
        moderation_pass: true,
        moderation_reason: null,
        raw_response: rawResponse,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('completion_id', completionId)

    return { status: 'approved' }
  } catch (error) {
    logger.error(error, { context: 'runCompletionModeration', completionId })
    await supabaseAdmin
      .from('completion_moderation_logs')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('completion_id', completionId)
    throw error
  }
}

export function scheduleCompletionModeration(completionId: number) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL?.startsWith('http')
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET
  if (!secret) {
    void runCompletionModeration(completionId).catch((error) => {
      logger.error(error, { context: 'inline moderation failed', completionId })
    })
    return
  }

  void fetch(`${baseUrl}/api/internal/moderate-completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ completionId }),
  }).catch((error) => {
    logger.error(error, { context: 'scheduleCompletionModeration fetch failed', completionId })
    void runCompletionModeration(completionId).catch((inner) => {
      logger.error(inner, { context: 'fallback moderation failed', completionId })
    })
  })
}
