import { NextResponse } from 'next/server'

import { getDiscussionTags } from '@/lib/api/community-discussions'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const tags = await getDiscussionTags()
    return NextResponse.json({ tags })
  } catch (error) {
    logger.error('Error in GET /api/discussions/tags', { error })
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}
