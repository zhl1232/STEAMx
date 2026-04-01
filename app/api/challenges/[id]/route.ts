import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapDbChallenge } from '@/lib/mappers/types'
import { getCuratedChallengeProjects } from '@/lib/api/nature-observation-data'
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

    if (user) {
      const [{ data: participant }, { data: completion }] = await Promise.all([
        supabase.from('challenge_participants').select('user_id').eq('user_id', user.id).eq('challenge_id', challengeId).maybeSingle(),
        supabase.from('challenge_completions').select('user_id').eq('user_id', user.id).eq('challenge_id', challengeId).maybeSingle(),
      ])

      joined = !!participant
      completed = !!completion
    }

    const recommendedProjects = await getCuratedChallengeProjects(challengeId)
    const mapped = {
      ...mapDbChallenge(challenge as never, joined, completed),
      recommendedProjects,
    }

    return NextResponse.json({ challenge: mapped })
  } catch (error) {
    logger.error('Error in GET /api/challenges/[id]', { error })
    return NextResponse.json({ error: 'Failed to fetch challenge' }, { status: 500 })
  }
}
