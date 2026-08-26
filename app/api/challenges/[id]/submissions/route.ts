import { NextRequest, NextResponse } from 'next/server'

import { getChallengeSubmissions } from '@/lib/api/challenge-submissions'
import { getContentClassificationSettings } from '@/lib/content-classification'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const challengeId = Number.parseInt(id, 10)
    if (Number.isNaN(challengeId)) {
      return NextResponse.json({ error: 'Invalid challenge id' }, { status: 400 })
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('challenges')
      .select('id, status, classification_status')
      .eq('id', challengeId)
      .maybeSingle()

    if (challengeError) throw challengeError
    const classificationSettings = await getContentClassificationSettings()
    if (
      !challenge
      || !['active', 'ended'].includes(challenge.status)
      || (classificationSettings.enforcementEnabled && challenge.classification_status !== 'reviewed')
    ) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 })
    }

    const submissions = await getChallengeSubmissions(supabase, challengeId, {
      requireReviewedParents: classificationSettings.enforcementEnabled,
    })
    return NextResponse.json({ submissions })
  } catch (error) {
    logger.error('Error in GET /api/challenges/[id]/submissions', { error })
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
  }
}
