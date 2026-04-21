import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLinkedItem,
  type Species,
} from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

import type {
  ObservationEventRow,
  SpeciesRow,
} from './nature-observation-internal-types'
import { normalizeSpeciesRow } from './nature-observation-cover-image'
import { loadObservationSpeciesForEvents } from './nature-observation-events'

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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('is_active', true)
    .order('common_name', { ascending: true })
    .limit(limit)

  if (error) {
    logger.error('Error fetching homepage species', { error })
    return []
  }

  return ((data || []) as SpeciesRow[]).map((row) => mapDbSpecies(normalizeSpeciesRow(row) as never))
}

export async function getBirdObservationRecentObservations(limit = 6): Promise<ObservationEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('observation_events')
    .select('*')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('observed_at', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Error fetching homepage observations', { error })
    return []
  }

  const observationRows = (data || []) as ObservationEventRow[]
  const speciesByEvent = await loadObservationSpeciesForEvents(observationRows.map((row) => row.id))

  return observationRows.map((row) =>
    mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || []),
  )
}

export async function getBirdObservationHomepageData(): Promise<BirdHomepageData> {
  const [featuredSpecies, recentObservations] = await Promise.all([
    getBirdObservationFeaturedSpecies(),
    getBirdObservationRecentObservations(),
  ])

  return {
    featuredSpecies,
    recentObservations,
  }
}
