import { NextRequest, NextResponse } from 'next/server'

import { getObservationById } from '@/lib/api/nature-observation-data'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const observation = await getObservationById(id)

    if (!observation) {
      return NextResponse.json({ error: 'Observation not found' }, { status: 404 })
    }

    return NextResponse.json({ observation })
  } catch (error) {
    logger.error('Error in GET /api/observations/[id]', { error })
    return NextResponse.json({ error: 'Failed to fetch observation detail' }, { status: 500 })
  }
}
