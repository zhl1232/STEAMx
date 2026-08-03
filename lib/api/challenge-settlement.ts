import { awardXpOnce } from '@/lib/api/server-awards'
import { supabaseAdmin } from '@/lib/supabase/admin'

interface RankedSubmission {
  submissionId: number
  userId: string
  title: string
  avgScore: number
  ratingCount: number
  rank: number
}

const PRIZE_BY_RANK: Record<number, number> = {
  1: 20,
  2: 10,
  3: 5,
}

export async function settleTimedChallenge(challengeId: number) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured, cannot settle challenge')
  }

  const { data: challenge, error: challengeError } = await supabaseAdmin
    .from('challenges')
    .select('id, status, challenge_type')
    .eq('id', challengeId)
    .maybeSingle()

  if (challengeError) throw challengeError
  if (!challenge) throw new Error('Challenge not found')
  if (challenge.challenge_type !== 'timed') throw new Error('Only timed challenges can be settled')
  if (challenge.status !== 'active') throw new Error('Only active timed challenges can be settled')

  const { data: submissions, error: submissionError } = await supabaseAdmin
    .from('challenge_submissions')
    .select('id, user_id, title, updated_at')
    .eq('challenge_id', challengeId)
    .eq('status', 'approved')
    .eq('is_public', true)

  if (submissionError) throw submissionError

  const submissionRows = (submissions || []) as {
    id: number
    user_id: string
    title: string
    updated_at: string
  }[]

  const submissionIds = submissionRows.map((row) => row.id)

  const { data: ratings, error: ratingsError } = submissionIds.length > 0
    ? await supabaseAdmin
        .from('challenge_submission_ratings')
        .select('submission_id, creative_expression, completion_quality, evidence_completeness, reflection_depth')
        .in('submission_id', submissionIds)
    : { data: [], error: null }

  if (ratingsError) throw ratingsError

  const ratingsBySubmissionId = new Map<number, {
    total: number
    count: number
  }>()

  for (const row of ((ratings || []) as {
    submission_id: number
    creative_expression: number
    completion_quality: number
    evidence_completeness: number
    reflection_depth: number
  }[])) {
    const current = ratingsBySubmissionId.get(row.submission_id) || { total: 0, count: 0 }
    current.total += (row.creative_expression + row.completion_quality + row.evidence_completeness + row.reflection_depth) / 4
    current.count += 1
    ratingsBySubmissionId.set(row.submission_id, current)
  }

  const ranked: RankedSubmission[] = submissionRows
    .map((submission) => {
      const summary = ratingsBySubmissionId.get(submission.id)
      const avgScore = summary && summary.count > 0
        ? Math.round((summary.total / summary.count) * 100) / 100
        : 0
      return {
        submissionId: submission.id,
        userId: submission.user_id,
        title: submission.title,
        avgScore,
        ratingCount: summary?.count || 0,
        rank: 0,
      }
    })
    .sort((a, b) => {
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore
      if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount
      const updatedA = submissionRows.find((row) => row.id === a.submissionId)?.updated_at || ''
      const updatedB = submissionRows.find((row) => row.id === b.submissionId)?.updated_at || ''
      return Date.parse(updatedA) - Date.parse(updatedB)
    })
    .map((submission, index) => ({ ...submission, rank: index + 1 }))

  const prizeWinnerIds = ranked
    .filter((submission) => PRIZE_BY_RANK[submission.rank])
    .map((submission) => submission.userId)

  const { data: profiles } = prizeWinnerIds.length > 0
    ? await supabaseAdmin
        .from('profiles')
        .select('id, coins')
        .in('id', prizeWinnerIds)
    : { data: [] as { id: string; coins: number }[] }

  const profileCoinsByUserId = new Map(
    ((profiles || []) as { id: string; coins: number }[]).map((profile) => [profile.id, profile.coins || 0]),
  )

  for (const submission of ranked) {
    await awardXpOnce({
      userId: submission.userId,
      actionType: 'challenge_participation',
      resourceId: challengeId,
    })

    const prize = PRIZE_BY_RANK[submission.rank]
    if (!prize) continue

    const { error: coinLogError } = await supabaseAdmin
      .from('coin_logs')
      .insert({
        user_id: submission.userId,
        amount: prize,
        action_type: 'challenge_prize',
        resource_id: String(challengeId),
        counterparty_display_text: `挑战第${submission.rank}名奖励`,
      } as never)

    if (coinLogError) throw coinLogError

    const nextCoins = (profileCoinsByUserId.get(submission.userId) || 0) + prize
    profileCoinsByUserId.set(submission.userId, nextCoins)
    const { error: updateCoinsError } = await supabaseAdmin
      .from('profiles')
      .update({ coins: nextCoins } as never)
      .eq('id', submission.userId)
    if (updateCoinsError) throw updateCoinsError
  }

  const { error: updateChallengeError } = await supabaseAdmin
    .from('challenges')
    .update({ status: 'ended' } as never)
    .eq('id', challengeId)

  if (updateChallengeError) throw updateChallengeError

  return {
    total_submissions: ranked.length,
    winners: ranked.filter((submission) => submission.rank <= 3).map((submission) => ({
      rank: submission.rank,
      submission_id: submission.submissionId,
      title: submission.title,
      avg_score: submission.avgScore,
      rating_count: submission.ratingCount,
    })),
  }
}
