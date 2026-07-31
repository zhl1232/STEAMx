import { NextResponse } from 'next/server'

import { getSpeciesAtlas } from '@/lib/api/nature-observation-atlas'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const atlas = await getSpeciesAtlas()
    return NextResponse.json(atlas, {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
      },
    })
  } catch (error) {
    logger.error('Error in GET /api/species/atlas', { error })
    return NextResponse.json({ error: 'Failed to fetch species atlas' }, { status: 500 })
  }
}
