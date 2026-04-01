import { NextResponse } from 'next/server'

import { requireAuth, handleApiError } from '@/lib/api/auth'
import { logger } from '@/lib/logger'
import { mapDbSpecies, type Species } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

type LifeListSpeciesItem = Species & {
  firstSeenAt: string | null
  observationCount: number
}

export async function GET() {
  const supabase = await createClient()

  try {
    const user = await requireAuth(supabase)

    const { data: events, error: eventsError } = await supabase
      .from('observation_events')
      .select('id')
      .eq('user_id', user.id)

    if (eventsError) {
      logger.error('Error fetching user events for life list', { error: eventsError })
      throw eventsError
    }

    const eventIds = (events || []).map((e) => (e as { id: number }).id)
    const totalObservations = eventIds.length

    if (eventIds.length === 0) {
      return NextResponse.json({
        species: [],
        totalObservations: 0,
        uniqueSpeciesCount: 0,
      })
    }

    const { data: oesRows, error: oesError } = await supabase
      .from('observation_event_species')
      .select('species_id, observation_event_id')
      .in('observation_event_id', eventIds)

    if (oesError) {
      logger.error('Error fetching observation_event_species for life list', { error: oesError })
      throw oesError
    }

    const speciesFirstSeen = new Map<number, string>()
    const speciesEventIds = new Map<number, number[]>()

    for (const row of (oesRows || []) as Array<{ species_id: number; observation_event_id: number }>) {
      if (!speciesEventIds.has(row.species_id)) {
        speciesEventIds.set(row.species_id, [])
      }
      speciesEventIds.get(row.species_id)!.push(row.observation_event_id)
    }

    const speciesIds = Array.from(speciesEventIds.keys())

    if (speciesIds.length === 0) {
      return NextResponse.json({
        species: [],
        totalObservations,
        uniqueSpeciesCount: 0,
      })
    }

    const { data: speciesRows } = await supabase.from('species').select('*').in('id', speciesIds)

    const { data: eventDates } = await supabase
      .from('observation_events')
      .select('id, observed_at')
      .in('id', eventIds)

    const eventDateMap = new Map(
      ((eventDates || []) as Array<{ id: number; observed_at: string }>).map((e) => [e.id, e.observed_at]),
    )

    for (const [speciesId, eIds] of speciesEventIds) {
      let earliest = ''
      for (const eid of eIds) {
        const date = eventDateMap.get(eid) || ''
        if (!earliest || (date && date < earliest)) earliest = date
      }
      speciesFirstSeen.set(speciesId, earliest)
    }

    const lifeList: LifeListSpeciesItem[] = ((speciesRows || []) as Array<Record<string, unknown>>).map((row) => {
      const base = mapDbSpecies(row as never)
      const id = base.id
      return {
        ...base,
        firstSeenAt: speciesFirstSeen.get(id) || null,
        observationCount: speciesEventIds.get(id)?.length || 0,
      }
    }).sort((a, b) => {
      if (a.firstSeenAt && b.firstSeenAt) return a.firstSeenAt > b.firstSeenAt ? -1 : 1
      return 0
    })

    return NextResponse.json({
      species: lifeList,
      totalObservations,
      uniqueSpeciesCount: lifeList.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
