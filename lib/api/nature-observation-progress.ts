import { logger } from '@/lib/logger'
import { mapDbSpecies } from '@/lib/mappers/types'
import {
  calculateProgressPercent,
  type NaturalObservationProgressSummary,
  type SpeciesTopicProgress,
} from '@/lib/observations/progress'
import { createClient } from '@/lib/supabase/server'
import {
  getNatureTopicLabel,
  resolveSpeciesNatureTopicKey,
  visibleSpeciesTopicKeys,
} from '@/lib/utils/nature-topic-classification'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export async function getApprovedObservedSpeciesData(supabase: SupabaseServerClient, userId: string) {
  const { data: events, error: eventsError } = await supabase
    .from('observation_events')
    .select('id, observed_at')
    .eq('user_id', userId)
    .eq('status', 'approved')

  if (eventsError) {
    logger.error('Error fetching approved user events for natural observation progress', { error: eventsError })
    throw eventsError
  }

  const typedEvents = (events || []) as Array<{ id: number; observed_at: string }>
  const eventIds = typedEvents.map((e) => e.id)
  const eventDateMap = new Map(typedEvents.map((e) => [e.id, e.observed_at]))
  const totalObservations = eventIds.length

  if (eventIds.length === 0) {
    return {
      totalObservations,
      speciesRows: [] as Array<Record<string, unknown>>,
      speciesFirstSeen: new Map<number, string>(),
      speciesEventIds: new Map<number, number[]>(),
    }
  }

  const { data: linkedRows, error: linkedError } = await supabase
    .from('observation_event_species')
    .select('species_id, observation_event_id')
    .in('observation_event_id', eventIds)

  if (linkedError) {
    logger.error('Error fetching observation_event_species for natural observation progress', { error: linkedError })
    throw linkedError
  }

  const speciesFirstSeen = new Map<number, string>()
  const speciesEventIds = new Map<number, number[]>()

  for (const row of (linkedRows || []) as Array<{ species_id: number; observation_event_id: number }>) {
    if (!speciesEventIds.has(row.species_id)) {
      speciesEventIds.set(row.species_id, [])
    }
    speciesEventIds.get(row.species_id)!.push(row.observation_event_id)
  }

  const speciesIds = Array.from(speciesEventIds.keys())

  if (speciesIds.length === 0) {
    return {
      totalObservations,
      speciesRows: [] as Array<Record<string, unknown>>,
      speciesFirstSeen,
      speciesEventIds,
    }
  }

  const { data: speciesRows, error: speciesError } = await supabase
    .from('species')
    .select('*')
    .in('id', speciesIds)

  if (speciesError) {
    logger.error('Error fetching observed species rows for natural observation progress', { error: speciesError })
    throw speciesError
  }

  for (const [speciesId, eventIdsForSpecies] of speciesEventIds) {
    let earliest = ''
    for (const eventId of eventIdsForSpecies) {
      const date = eventDateMap.get(eventId) || ''
      if (!earliest || (date && date < earliest)) earliest = date
    }
    speciesFirstSeen.set(speciesId, earliest)
  }

  return {
    totalObservations,
    speciesRows: (speciesRows || []) as Array<Record<string, unknown>>,
    speciesFirstSeen,
    speciesEventIds,
  }
}

export async function getNaturalObservationProgressSummary(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<NaturalObservationProgressSummary> {
  const { totalObservations, speciesRows, speciesEventIds } = await getApprovedObservedSpeciesData(supabase, userId)
  const observedSpeciesIds = new Set(Array.from(speciesEventIds.keys()))

  const { data: activeSpeciesRows, error: activeSpeciesError } = await supabase
    .from('species')
    .select('*')
    .eq('is_active', true)
    .in('nature_topic', [...visibleSpeciesTopicKeys])
    .order('common_name', { ascending: true })

  if (activeSpeciesError) {
    logger.error('Error fetching active species for natural observation progress', { error: activeSpeciesError })
    throw activeSpeciesError
  }

  const activeSpecies = ((activeSpeciesRows || []) as Array<Record<string, unknown>>).map((row) => {
    const base = mapDbSpecies(row as never)
    const topicKey = resolveSpeciesNatureTopicKey({
      nature_topic: row.nature_topic as string | null,
      common_name: row.common_name as string | null,
      scientific_name: row.scientific_name as string | null,
      taxon_group: row.taxon_group as string | null,
    })
    return { ...base, topicKey, topicLabel: getNatureTopicLabel(topicKey) }
  })

  const topicProgressBase: SpeciesTopicProgress[] = [
    {
      topic: 'all',
      label: '全部物种',
      total: activeSpecies.length,
      observedCount: activeSpecies.filter((item) => observedSpeciesIds.has(item.id)).length,
      unobservedCount: activeSpecies.filter((item) => !observedSpeciesIds.has(item.id)).length,
      progressPercent: 0,
    },
    ...visibleSpeciesTopicKeys.map((topicKey) => {
      const speciesForTopic = activeSpecies.filter((item) => item.topicKey === topicKey)
      const observedCount = speciesForTopic.filter((item) => observedSpeciesIds.has(item.id)).length
      return {
        topic: topicKey,
        label: getNatureTopicLabel(topicKey),
        total: speciesForTopic.length,
        observedCount,
        unobservedCount: Math.max(0, speciesForTopic.length - observedCount),
        progressPercent: calculateProgressPercent(observedCount, speciesForTopic.length),
      }
    }),
  ]

  const topicProgress = topicProgressBase.map((item) => ({
    ...item,
    progressPercent: calculateProgressPercent(item.observedCount, item.total),
  }))

  const unobservedSpeciesPreview = activeSpecies
    .filter((item) => !observedSpeciesIds.has(item.id))
    .slice(0, 6)

  return {
    totalObservations,
    uniqueSpeciesCount: speciesRows.length,
    topicProgress,
    unobservedSpeciesPreview,
  }
}
