import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
import { logger } from '@/lib/logger'

export const COMPLETION_XP = 20

export async function awardCompletionXp(completionId: number) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured, cannot award XP')
  }

  const { data: completion, error: completionError } = await supabaseAdmin
    .from('completed_projects')
    .select('user_id, project_id, course_lesson_id, record_kind')
    .eq('id', completionId)
    .maybeSingle()

  if (completionError) throw completionError
  if (!completion) return

  const recordKind = (completion as { record_kind?: string }).record_kind ?? 'final'
  if (recordKind !== 'final') return

  const source = completion.course_lesson_id
    ? { actionType: 'publish_course_work', resourceId: String(completion.course_lesson_id) }
    : completion.project_id
      ? { actionType: 'complete_project', resourceId: String(completion.project_id) }
      : null
  if (!source) return

  const { data: inserted, error: xpLogError } = await supabaseAdmin
    .from('xp_logs')
    .upsert(
      {
        user_id: completion.user_id,
        action_type: source.actionType,
        resource_id: source.resourceId,
        xp_amount: COMPLETION_XP,
      } as never,
      { onConflict: 'user_id,action_type,resource_id', ignoreDuplicates: true },
    )
    .select('id')

  if (xpLogError) throw xpLogError

  if (!inserted || inserted.length === 0) {
    logger.info('XP already awarded, skipping', { completionId })
    return
  }

  const { error: xpIncrementError } = await callRpc(supabaseAdmin, 'increment_user_xp', {
    p_user_id: completion.user_id,
    p_amount: COMPLETION_XP,
  })

  if (xpIncrementError) throw xpIncrementError
}

export async function approveCompletionWithXp(completionId: number) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const { error } = await callRpc(supabaseAdmin, 'system_approve_completion', {
    p_completion_id: completionId,
  })

  if (error) throw error

  try {
    await awardCompletionXp(completionId)
  } catch (xpError) {
    logger.error(xpError, { context: 'XP award failed after AI approval', completionId })
  }
}

export async function rejectCompletion(completionId: number, reason: string) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const { error } = await callRpc(supabaseAdmin, 'system_reject_completion', {
    p_completion_id: completionId,
    p_reason: reason,
  })

  if (error) throw error
}
