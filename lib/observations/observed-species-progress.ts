import { AI_IDENTIFICATION_CONFIDENCE_THRESHOLD } from '@/lib/observations/identifications'

export interface ObservedSpeciesEventLink {
  speciesId: number
  observationEventId: number
}

export interface ObservedSpeciesConsensusRow {
  species_id: number
  observation_event_id: number
}

export interface ObservedSpeciesAiIdentificationRow {
  species_id: number
  observation_event_id: number
  source: string
  confidence: number | null
}

export function isQualifyingAiObservedSpecies(
  confidence: number | null | undefined,
  threshold = AI_IDENTIFICATION_CONFIDENCE_THRESHOLD,
): boolean {
  return typeof confidence === 'number' && confidence >= threshold
}

export function mergeObservedSpeciesEventLinks(
  consensusRows: ObservedSpeciesConsensusRow[],
  aiIdentificationRows: ObservedSpeciesAiIdentificationRow[],
): Map<number, number[]> {
  const eventsWithConsensus = new Set(consensusRows.map((row) => row.observation_event_id))
  const speciesEventIds = new Map<number, number[]>()

  const addLink = (speciesId: number, eventId: number) => {
    const current = speciesEventIds.get(speciesId) ?? []
    if (!current.includes(eventId)) {
      current.push(eventId)
      speciesEventIds.set(speciesId, current)
    }
  }

  for (const row of consensusRows) {
    addLink(row.species_id, row.observation_event_id)
  }

  for (const row of aiIdentificationRows) {
    if (eventsWithConsensus.has(row.observation_event_id)) continue
    if (row.source !== 'ai') continue
    if (!isQualifyingAiObservedSpecies(row.confidence)) continue
    addLink(row.species_id, row.observation_event_id)
  }

  return speciesEventIds
}

export function observedSpeciesIdsFromEventLinks(speciesEventIds: Map<number, number[]>): Set<number> {
  return new Set(speciesEventIds.keys())
}
