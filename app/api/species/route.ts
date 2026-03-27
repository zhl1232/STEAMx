import { NextRequest, NextResponse } from 'next/server'

import { getSpeciesList } from '@/lib/api/nature-observation-data'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || undefined
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10) || 12))

    const { species, total, hasMore } = await getSpeciesList({ query, page, pageSize })
    return NextResponse.json({ species, total, hasMore })
  } catch (error) {
    logger.error('Error in GET /api/species', { error })
    return NextResponse.json({ error: 'Failed to fetch species' }, { status: 500 })
  }
}
