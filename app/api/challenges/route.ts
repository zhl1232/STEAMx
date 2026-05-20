import { NextResponse } from 'next/server'

import { getCommunityChallengeGroups } from '@/lib/api/community-challenges'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { challenges, error } = await getCommunityChallengeGroups()
    if (error) throw new Error(error)
    return NextResponse.json(challenges)
  } catch (error) {
    logger.error('Error in GET /api/challenges', { error })
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}
