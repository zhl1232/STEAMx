import { sanitizeSearch } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLocationSummary,
  type Species,
} from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

import type {
  ObservationEventRow,
  ObservationEventSpeciesRow,
  SpeciesRow,
} from './nature-observation-internal-types'
import { normalizeSpeciesRow } from './nature-observation-cover-image'

export interface SpeciesListOptions {
  query?: string
  page?: number
  pageSize?: number
}

export async function getSpeciesList(
  options: SpeciesListOptions = {},
): Promise<{ species: Species[]; total: number; hasMore: boolean }> {
  const supabase = await createClient()
  const { query, page = 0, pageSize = 12 } = options
  const from = page * pageSize
  const to = from + pageSize - 1
  const sanitizedQuery = sanitizeSearch(query ?? '')

  let request = supabase
    .from('species')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .order('common_name', { ascending: true })
    .range(from, to)

  if (sanitizedQuery) {
    request = request.or(
      `common_name.ilike.%${sanitizedQuery}%,scientific_name.ilike.%${sanitizedQuery}%,taxon_group.ilike.%${sanitizedQuery}%`,
    )
  }

  const { data, error, count } = await request

  if (error) {
    logger.error('Error fetching species list', { error })
    return { species: [], total: 0, hasMore: false }
  }

  const rows = (data || []) as SpeciesRow[]
  return {
    species: rows.map((row) => mapDbSpecies(normalizeSpeciesRow(row) as never)),
    total: count || 0,
    hasMore: (count || 0) > to + 1,
  }
}

export async function getSpeciesBySlug(slug: string): Promise<Species | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching species by slug', { error, slug })
    return null
  }

  if (!data) return null

  const baseSpecies = mapDbSpecies(normalizeSpeciesRow(data as SpeciesRow) as never)

  const { data: linkedRows, error: linkedError } = await supabase
    .from('observation_event_species')
    .select('*')
    .eq('species_id', data.id)

  if (linkedError) {
    logger.error('Error fetching observation_event_species for species', { error: linkedError, slug })
    return baseSpecies
  }

  const typedLinkedRows = (linkedRows || []) as ObservationEventSpeciesRow[]
  const eventIds = Array.from(new Set(typedLinkedRows.map((row) => row.observation_event_id)))

  if (eventIds.length === 0) {
    return baseSpecies
  }

  const { data: eventRows, error: eventError } = await supabase
    .from('observation_events')
    .select('*')
    .in('id', eventIds)
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('observed_at', { ascending: false })
    .limit(12)

  if (eventError) {
    logger.error('Error fetching recent observations for species', { error: eventError, slug })
    return baseSpecies
  }

  const typedEventRows = (eventRows || []) as ObservationEventRow[]
  const visibleEventIds = new Set(typedEventRows.map((row) => row.id))
  const filteredLinkedRows = typedLinkedRows.filter((row) => visibleEventIds.has(row.observation_event_id))
  const speciesSummariesByEvent = new Map<number, ObservationEvent['species']>()

  for (const row of filteredLinkedRows) {
    const current = speciesSummariesByEvent.get(row.observation_event_id) || []
    current.push(mapDbObservationEventSpecies(row as never, data as never))
    speciesSummariesByEvent.set(row.observation_event_id, current)
  }

  const topLocationsMap = new Map<string, ObservationLocationSummary>()
  for (const row of typedEventRows) {
    const existing = topLocationsMap.get(row.location_name)
    if (!existing) {
      topLocationsMap.set(row.location_name, {
        locationName: row.location_name,
        observationCount: 1,
        latestObservedAt: row.observed_at,
        latitude: row.latitude,
        longitude: row.longitude,
      })
      continue
    }

    topLocationsMap.set(row.location_name, {
      ...existing,
      observationCount: existing.observationCount + 1,
      latestObservedAt:
        new Date(existing.latestObservedAt) > new Date(row.observed_at) ? existing.latestObservedAt : row.observed_at,
      latitude: existing.latitude ?? row.latitude,
      longitude: existing.longitude ?? row.longitude,
    })
  }

  const topLocations = Array.from(topLocationsMap.values()).sort((left, right) => {
    if (right.observationCount !== left.observationCount) {
      return right.observationCount - left.observationCount
    }
    return new Date(right.latestObservedAt).getTime() - new Date(left.latestObservedAt).getTime()
  })

  return {
    ...baseSpecies,
    recentObservations: typedEventRows.map((row) =>
      mapDbObservationEvent(row as never, speciesSummariesByEvent.get(row.id) || []),
    ),
    topLocations,
  }
}
