import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapDbChallenge } from '@/lib/mappers/types'
import { getCuratedChallengeProjects } from '@/lib/api/nature-observation-data'
import { getMyChallengeSubmissionStatus } from '@/lib/api/challenge-submissions'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = parseInt(id)

    const { data: challenge, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()

    if (error || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    let joined = false
    let completed = false
    let mySubmissionId: number | undefined
    let mySubmissionStatus: 'pending' | 'approved' | 'rejected' | undefined

    if (user) {
      const [{ data: participant }, mySubmission] = await Promise.all([
        supabase.from('challenge_participants').select('user_id').eq('user_id', user.id).eq('challenge_id', challengeId).maybeSingle(),
        getMyChallengeSubmissionStatus(supabase, challengeId, user.id),
      ])

      joined = !!participant
      if (mySubmission) {
        mySubmissionId = mySubmission.id
        mySubmissionStatus = mySubmission.status as 'pending' | 'approved' | 'rejected'
        completed = mySubmission.status === 'approved'
      }
    }

    const [{ count: submissionsCount }, recommendedProjects] = await Promise.all([
      supabase
        .from('challenge_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('challenge_id', challengeId)
        .eq('status', 'approved')
        .eq('is_public', true),
      getCuratedChallengeProjects(challengeId),
    ])

    const mapped = {
      ...mapDbChallenge({
        ...(challenge as Record<string, unknown>),
        submissions_count: submissionsCount || 0,
        my_submission_id: mySubmissionId,
        my_submission_status: mySubmissionStatus,
        can_edit_submission: (challenge as { status: string }).status === 'active',
      } as never, joined, completed),
      recommendedProjects,
    }

    return NextResponse.json({ challenge: mapped })
  } catch (error) {
    logger.error('Error in GET /api/challenges/[id]', { error })
    return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 })
  }
}
