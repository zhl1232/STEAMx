import { supabaseAdmin } from '@/lib/supabase/admin'
import { callRpc } from '@/lib/supabase/rpc'
export const COMPLETION_XP = 20

export type CompletionRewardResult = {
  completion_id: number
  status: 'approved'
  xp_awarded: boolean
  record_kind: string
}

export async function awardCompletionXp(completionId: number): Promise<CompletionRewardResult> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured, cannot award XP')
  }

  const { data, error } = await callRpc(supabaseAdmin, 'system_approve_completion_with_reward', {
    p_completion_id: completionId,
  })
  if (error) throw error
  return data as unknown as CompletionRewardResult
}

export async function approveCompletionWithXp(completionId: number) {
  return awardCompletionXp(completionId)
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
