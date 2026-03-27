import { NextRequest, NextResponse } from 'next/server'

import { getSpeciesBySlug } from '@/lib/api/nature-observation-data'
import { logger } from '@/lib/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const species = await getSpeciesBySlug(slug)

    if (!species) {
      return NextResponse.json({ error: 'Species not found' }, { status: 404 })
    }

    return NextResponse.json({ species })
  } catch (error) {
    logger.error('Error in GET /api/species/[slug]', { error })
    return NextResponse.json({ error: 'Failed to fetch species detail' }, { status: 500 })
  }
}
