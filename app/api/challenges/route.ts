import { NextResponse } from 'next/server'

import { getPblChallengeGroups } from '@/lib/api/pbl-challenges'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const { challenges, error } = await getPblChallengeGroups()
    if (error) throw new Error(error)
    return NextResponse.json(challenges)
  } catch (error) {
    logger.error('Error in GET /api/challenges', { error })
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 })
  }
}
