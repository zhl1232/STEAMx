import { logger } from '@/lib/logger'
import { AI_IDENTIFICATION_CONFIDENCE_THRESHOLD } from '@/lib/observations/identifications'
import {
  mergeObservedSpeciesEventLinks,
  observedSpeciesIdsFromEventLinks,
  type ObservedSpeciesAiIdentificationRow,
  type ObservedSpeciesConsensusRow,
} from '@/lib/observations/observed-species-progress'
import { createClient } from '@/lib/supabase/server'

const OBSERVED_SPECIES_EVENT_BATCH_SIZE = 200

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function fetchObservedSpeciesEventLinksForApprovedEvents(
  supabase: SupabaseServerClient,
  eventIds: number[],
  context: { userId?: string; logLabel?: string } = {},
): Promise<Map<number, number[]>> {
  if (eventIds.length === 0) {
    return new Map()
  }

  const consensusRows: ObservedSpeciesConsensusRow[] = []
  const aiIdentificationRows: ObservedSpeciesAiIdentificationRow[] = []
  const logLabel = context.logLabel ?? 'observed species progress'

  for (const eventIdBatch of chunkItems(eventIds, OBSERVED_SPECIES_EVENT_BATCH_SIZE)) {
    const [linkedResult, aiResult] = await Promise.all([
      supabase
        .from('observation_event_species')
        .select('species_id, observation_event_id')
        .in('observation_event_id', eventIdBatch),
      supabase
        .from('observation_identifications')
        .select('species_id, observation_event_id, source, confidence')
        .in('observation_event_id', eventIdBatch)
        .eq('is_active', true)
        .eq('source', 'ai')
        .gte('confidence', AI_IDENTIFICATION_CONFIDENCE_THRESHOLD),
    ])

    if (linkedResult.error) {
      logger.error(`Error fetching observation_event_species for ${logLabel}`, {
        error: linkedResult.error,
        userId: context.userId,
      })
      throw linkedResult.error
    }

    if (aiResult.error) {
      logger.error(`Error fetching AI identifications for ${logLabel}`, {
        error: aiResult.error,
        userId: context.userId,
      })
      throw aiResult.error
    }

    consensusRows.push(...((linkedResult.data || []) as ObservedSpeciesConsensusRow[]))
    aiIdentificationRows.push(...((aiResult.data || []) as ObservedSpeciesAiIdentificationRow[]))
  }

  return mergeObservedSpeciesEventLinks(consensusRows, aiIdentificationRows)
}

export async function fetchObservedSpeciesIdsForApprovedEvents(
  supabase: SupabaseServerClient,
  eventIds: number[],
  context: { userId?: string; logLabel?: string } = {},
): Promise<Set<number>> {
  const speciesEventLinks = await fetchObservedSpeciesEventLinksForApprovedEvents(supabase, eventIds, context)
  return observedSpeciesIdsFromEventLinks(speciesEventLinks)
}
