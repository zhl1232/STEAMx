import { NextRequest, NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { loadObservationSpeciesForEvents } from '@/lib/api/nature-observation-data'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { mapDbObservationEvent } from '@/lib/mappers/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || '12', 10) || 12))
    const from = page * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('observation_events')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('observed_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('Error fetching user observations', { error })
      throw error
    }

    const rows = (data || []) as Array<Record<string, unknown>>
    const eventIds = rows.map((row) => row.id as number)
    const speciesByEvent = await loadObservationSpeciesForEvents(eventIds)

    const observations = rows.map((row) =>
      mapDbObservationEvent(row as never, speciesByEvent.get(row.id as number) || []),
    )

    return NextResponse.json({
      observations,
      total: count || 0,
      hasMore: (count || 0) > to + 1,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
