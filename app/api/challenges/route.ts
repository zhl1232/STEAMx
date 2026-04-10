import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapDbChallenge } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: challengeRows, error: challengeError } = await supabase
      .from('challenges')
      .select('*')
      .in('status', ['active', 'ended'])
      .order('created_at', { ascending: false })
      .limit(50)

    if (challengeError) throw challengeError

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let joinedIds = new Set<number>()
    let approvedSubmissionIds = new Set<number>()
    const mySubmissionStatusByChallenge = new Map<number, string>()

    const challengeIds = ((challengeRows || []) as { id: number }[]).map((row) => row.id)
    let submissionsCountByChallenge = new Map<number, number>()

    if (challengeIds.length > 0) {
      const { data: submissionRows } = await supabase
        .from('challenge_submissions')
        .select('challenge_id')
        .in('challenge_id', challengeIds)
        .eq('status', 'approved')
        .eq('is_public', true)

      for (const row of (submissionRows || []) as { challenge_id: number }[]) {
        submissionsCountByChallenge.set(
          row.challenge_id,
          (submissionsCountByChallenge.get(row.challenge_id) || 0) + 1,
        )
      }
    }

    if (user) {
      const [{ data: participants }, { data: submissions }] = await Promise.all([
        supabase.from('challenge_participants').select('challenge_id').eq('user_id', user.id),
        supabase.from('challenge_submissions').select('challenge_id, status').eq('user_id', user.id),
      ])

      if (participants) {
        joinedIds = new Set((participants as { challenge_id: number }[]).map(r => r.challenge_id))
      }
      if (submissions) {
        for (const row of submissions as { challenge_id: number; status: string }[]) {
          mySubmissionStatusByChallenge.set(row.challenge_id, row.status)
        }
        approvedSubmissionIds = new Set(
          (submissions as { challenge_id: number; status: string }[])
            .filter((row) => row.status === 'approved')
            .map((row) => row.challenge_id),
        )
      }
    }

    const rows = (challengeRows || []) as Record<string, unknown>[]

    const activeTimed = rows
      .filter(r => r.challenge_type === 'timed' && r.status === 'active')
      .map(r => mapDbChallenge({
        ...r,
        submissions_count: submissionsCountByChallenge.get(r.id as number) || 0,
        my_submission_status: mySubmissionStatusByChallenge.get(r.id as number),
      } as never, joinedIds.has(r.id as number), approvedSubmissionIds.has(r.id as number)))

    const evergreen = rows
      .filter(r => r.challenge_type === 'evergreen' && r.status === 'active')
      .map(r => mapDbChallenge({
        ...r,
        submissions_count: submissionsCountByChallenge.get(r.id as number) || 0,
        my_submission_status: mySubmissionStatusByChallenge.get(r.id as number),
      } as never, joinedIds.has(r.id as number), approvedSubmissionIds.has(r.id as number)))

    const ended = rows
      .filter(r => r.status === 'ended')
      .map(r => mapDbChallenge({
        ...r,
        submissions_count: submissionsCountByChallenge.get(r.id as number) || 0,
        my_submission_status: mySubmissionStatusByChallenge.get(r.id as number),
      } as never, joinedIds.has(r.id as number), approvedSubmissionIds.has(r.id as number)))

    return NextResponse.json({ activeTimed, evergreen, ended })
  } catch (error) {
    logger.error('Error in GET /api/challenges', { error })
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}
