import { unstable_cache } from 'next/cache'

import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLinkedItem,
  type Species,
} from '@/lib/mappers/types'
import { createClient, createPublicClient } from '@/lib/supabase/server'

import type {
  ObservationEventRow,
  ObservationEventSpeciesRow,
  SpeciesRow,
} from './nature-observation-internal-types'
import { normalizeSpeciesRow } from './nature-observation-cover-image'

const HOMEPAGE_SPECIES_SELECT = [
  'id',
  'slug',
  'common_name',
  'scientific_name',
  'aliases',
  'taxon_group',
  'identification_notes',
  'habitat_notes',
  'seasonality_notes',
  'cover_image_url',
  'audio_url',
  'is_active',
].join(',')

const HOMEPAGE_OBSERVATION_SELECT = [
  'id',
  'user_id',
  'observed_at',
  'location_name',
  'latitude',
  'longitude',
  'location_precision',
  'habitat',
  'weather',
  'notes',
  'media_urls',
  'is_public',
  'status',
  'likes_count',
  'comments_count',
].join(',')

async function loadObservationSpeciesForEventsPublic(eventIds: number[]) {
  const supabase = createPublicClient()

  if (eventIds.length === 0) {
    return new Map<number, ObservationEvent['species']>()
  }

  const { data: rows, error } = await supabase
    .from('observation_event_species')
    .select('observation_event_id,species_id,count,behavior_tags,confidence,notes')
    .in('observation_event_id', eventIds)

  if (error) {
    logger.error('Error fetching homepage observation_event_species', { error, eventIds })
    return new Map<number, ObservationEvent['species']>()
  }

  const typedRows = (rows || []) as ObservationEventSpeciesRow[]
  const speciesIds = Array.from(new Set(typedRows.map((row) => row.species_id)))

  if (speciesIds.length === 0) {
    return new Map<number, ObservationEvent['species']>()
  }

  const { data: speciesRows, error: speciesError } = await supabase
    .from('species')
    .select('id,slug,common_name,scientific_name')
    .in('id', speciesIds)

  if (speciesError) {
    logger.error('Error fetching homepage species for observations', { error: speciesError, speciesIds })
    return new Map<number, ObservationEvent['species']>()
  }

  const speciesById = new Map<number, Pick<SpeciesRow, 'id' | 'slug' | 'common_name' | 'scientific_name'>>(
    ((speciesRows || []) as Pick<SpeciesRow, 'id' | 'slug' | 'common_name' | 'scientific_name'>[]).map((row) => [row.id, row]),
  )

  const grouped = new Map<number, ObservationEvent['species']>()
  for (const row of typedRows) {
    const species = speciesById.get(row.species_id)
    if (!species) continue
    const current = grouped.get(row.observation_event_id) || []
    current.push(mapDbObservationEventSpecies(row as never, species))
    grouped.set(row.observation_event_id, current)
  }

  return grouped
}

export interface BirdHomepageData {
  featuredSpecies: Species[]
  recentObservations: ObservationEvent[]
}

export async function getCuratedChallengeProjects(challengeId: number): Promise<ObservationLinkedItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, title')
    .eq('challenge_id', challengeId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Error fetching curated challenge projects', { error, challengeId })
    return []
  }

  return ((data || []) as { id: number; title: string }[]).map((row) => ({
    id: row.id,
    title: row.title,
  }))
}

export async function getBirdObservationFeaturedSpecies(limit = 8): Promise<Species[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('species')
    .select(HOMEPAGE_SPECIES_SELECT)
    .eq('is_active', true)
    .order('common_name', { ascending: true })
    .limit(limit)

  if (error) {
    logger.error('Error fetching homepage species', { error })
    return []
  }

  return ((data || []) as unknown as SpeciesRow[]).map((row) => mapDbSpecies(normalizeSpeciesRow(row) as never))
}

export async function getBirdObservationRecentObservations(limit = 6): Promise<ObservationEvent[]> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('observation_events')
    .select(HOMEPAGE_OBSERVATION_SELECT)
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('observed_at', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Error fetching homepage observations', { error })
    return []
  }

  const observationRows = (data || []) as unknown as ObservationEventRow[]
  const speciesByEvent = await loadObservationSpeciesForEventsPublic(observationRows.map((row) => row.id))

  return observationRows.map((row) =>
    mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || []),
  )
}

const getBirdObservationHomepageDataCached = unstable_cache(
  async (): Promise<BirdHomepageData> => {
    const [featuredSpecies, recentObservations] = await Promise.all([
      getBirdObservationFeaturedSpecies(),
      getBirdObservationRecentObservations(),
    ])

    return {
      featuredSpecies,
      recentObservations,
    }
  },
  ['nature-homepage-v2'],
  { revalidate: 300, tags: ['nature-homepage'] },
)

export async function getBirdObservationHomepageData(): Promise<BirdHomepageData> {
  return getBirdObservationHomepageDataCached()
}
