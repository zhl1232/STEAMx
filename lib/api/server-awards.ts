import { callRpc } from '@/lib/supabase/rpc'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getWeekKey, getWeekStartISO } from '@/lib/date-utils'

export type ServerXpAction =
  | 'publish_project'
  | 'comment_project'
  | 'like_project'
  | 'join_challenge'
  | 'submit_observation'
  | 'complete_challenge'
  | 'challenge_participation'
  | 'complete_project'
  | 'publish_course_work'
  | 'weekly_goal_comments_5'

/** Awards are intentionally service-role-only and idempotent by business resource. */
export async function awardXpOnce(params: {
  userId: string
  actionType: ServerXpAction
  resourceId: string | number
}) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured, cannot award XP')
  }

  const { data, error } = await callRpc(supabaseAdmin, 'award_xp_once', {
    p_user_id: params.userId,
    p_action_type: params.actionType,
    p_resource_id: String(params.resourceId),
  })

  if (error) throw error
  return Number(data ?? 0)
}

/** Award the weekly discussion milestone from trusted XP history only. */
export async function awardWeeklyCommentGoalIfEligible(userId: string) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured, cannot award weekly XP')
  }

  const { count, error } = await supabaseAdmin
    .from('xp_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('action_type', ['comment_project', 'reply_discussion'])
    .gte('created_at', getWeekStartISO())

  if (error) throw error
  if ((count ?? 0) < 5) return 0

  return awardXpOnce({
    userId,
    actionType: 'weekly_goal_comments_5',
    resourceId: getWeekKey(),
  })
}
