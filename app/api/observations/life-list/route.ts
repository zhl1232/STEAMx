import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import {
  getApprovedObservedSpeciesData,
  getNaturalObservationProgressSummary,
} from '@/lib/api/nature-observation-progress'
import { mapDbSpecies, type Species } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

type ObservedSpeciesItem = Species & {
  firstSeenAt: string | null
  observationCount: number
}

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)
    const [
      { totalObservations, speciesRows, speciesFirstSeen, speciesEventIds },
      progress,
    ] = await Promise.all([
      getApprovedObservedSpeciesData(supabase, user.id),
      getNaturalObservationProgressSummary(supabase, user.id),
    ])

    const observedSpecies: ObservedSpeciesItem[] = speciesRows.map((row) => {
      const base = mapDbSpecies(row as never)
      return {
        ...base,
        firstSeenAt: speciesFirstSeen.get(base.id) || null,
        observationCount: speciesEventIds.get(base.id)?.length || 0,
      }
    }).sort((a, b) => {
      if (a.firstSeenAt && b.firstSeenAt) return a.firstSeenAt > b.firstSeenAt ? -1 : 1
      return 0
    })

    return NextResponse.json({
      species: observedSpecies,
      totalObservations,
      uniqueSpeciesCount: observedSpecies.length,
      topicProgress: progress.topicProgress,
      unobservedSpeciesPreview: progress.unobservedSpeciesPreview,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
