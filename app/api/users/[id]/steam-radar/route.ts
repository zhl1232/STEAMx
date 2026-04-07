import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { getSteamRadarWithGuidanceSafe } from '@/lib/profile/steam-radar'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const radar = await getSteamRadarWithGuidanceSafe(supabase, id, 'GET /api/users/[id]/steam-radar')
    return NextResponse.json({ radar })
  } catch (error) {
    logger.error('Error in GET /api/users/[id]/steam-radar', { error })
    return NextResponse.json({ error: 'Failed to calculate STEAM radar' }, { status: 500 })
  }
}
