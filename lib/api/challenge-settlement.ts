import { callRpc } from '@/lib/supabase/rpc'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type ChallengeSettlement = {
  total_submissions: number
  winners: { rank: number; submission_id: number; title: string; avg_score: number; rating_count: number }[]
}

/** Ranking, prizes, XP and the ended state commit together; retry returns the stored result. */
export async function settleTimedChallenge(challengeId: number): Promise<ChallengeSettlement> {
  if (!supabaseAdmin) throw new Error('supabaseAdmin not configured, cannot settle challenge')
  const { data, error } = await callRpc(supabaseAdmin, 'settle_timed_challenge', { p_challenge_id: challengeId })
  if (error) throw error
  if (!data || typeof data !== 'object' || !('winners' in data)) throw new Error('Invalid challenge settlement result')
  return data as unknown as ChallengeSettlement
}
