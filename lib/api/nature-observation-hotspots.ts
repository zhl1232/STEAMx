import type {
  ObservationHotspotSpeciesSummary,
  ObservationLocationSummary,
} from '@/lib/mappers/types'

export interface TopicHotspotObservationInput {
  id: number
  observedAt: string
  locationName?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface TopicHotspotSpeciesInput {
  speciesId: number
  speciesSlug?: string
  commonName: string
  scientificName?: string | null
  count?: number | null
}

export interface TopicCategoryObservationInput {
  id: number
  locationName?: string | null
}

export interface TopicCategorySpeciesLinkInput {
  observationEventId: number
  speciesId: number
}

export interface TopicCategoryStats {
  speciesCount: number
  observationCount: number
  locationCount: number
}

interface MutableLocationSummary extends Omit<ObservationLocationSummary, 'species'> {
  speciesById: Map<number, ObservationHotspotSpeciesSummary>
}

function getTime(value: string) {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function latestDate(left: string, right: string) {
  return getTime(right) > getTime(left) ? right : left
}

export function getTopicObservationIds(
  topicSpeciesIds: Iterable<number>,
  linkedRows: TopicCategorySpeciesLinkInput[],
): Set<number> {
  const speciesIds = new Set(topicSpeciesIds)
  const observationIds = new Set<number>()

  if (speciesIds.size === 0) return observationIds

  for (const row of linkedRows) {
    if (speciesIds.has(row.speciesId)) {
      observationIds.add(row.observationEventId)
    }
  }

  return observationIds
}

export function buildTopicCategoryStats(
  topicSpeciesIds: Iterable<number>,
  observations: TopicCategoryObservationInput[],
  linkedRows: TopicCategorySpeciesLinkInput[],
): TopicCategoryStats {
  const speciesIds = new Set(topicSpeciesIds)
  const observationIds = getTopicObservationIds(speciesIds, linkedRows)
  const locations = new Set<string>()
  let observationCount = 0

  for (const observation of observations) {
    if (!observationIds.has(observation.id)) continue

    observationCount += 1
    const locationName = observation.locationName?.trim()
    if (locationName) locations.add(locationName)
  }

  return {
    speciesCount: speciesIds.size,
    observationCount,
    locationCount: locations.size,
  }
}

export function buildTopicHotspotSummaries(
  observations: TopicHotspotObservationInput[],
  speciesByEvent: Map<number, TopicHotspotSpeciesInput[]>,
  options: { locationLimit?: number; speciesLimit?: number } = {},
): ObservationLocationSummary[] {
  const { locationLimit = 6, speciesLimit = 5 } = options
  const grouped = new Map<string, MutableLocationSummary>()

  for (const observation of observations) {
    const locationName = observation.locationName?.trim()
    const observedSpecies = speciesByEvent.get(observation.id) ?? []

    if (!locationName) continue

    const existing = grouped.get(locationName)
    const summary: MutableLocationSummary = existing ?? {
      locationName,
      observationCount: 0,
      latestObservedAt: observation.observedAt,
      latitude: observation.latitude ?? null,
      longitude: observation.longitude ?? null,
      speciesById: new Map<number, ObservationHotspotSpeciesSummary>(),
    }

    summary.observationCount += 1
    summary.latestObservedAt = latestDate(summary.latestObservedAt, observation.observedAt)
    summary.latitude = summary.latitude ?? observation.latitude ?? null
    summary.longitude = summary.longitude ?? observation.longitude ?? null

    const seenSpeciesIds = new Set<number>()
    for (const species of observedSpecies) {
      if (seenSpeciesIds.has(species.speciesId)) continue
      seenSpeciesIds.add(species.speciesId)

      const current = summary.speciesById.get(species.speciesId)
      if (!current) {
        summary.speciesById.set(species.speciesId, {
          speciesId: species.speciesId,
          speciesSlug: species.speciesSlug,
          commonName: species.commonName,
          scientificName: species.scientificName ?? null,
          observationCount: 1,
          totalCount: species.count ?? null,
          latestObservedAt: observation.observedAt,
        })
        continue
      }

      summary.speciesById.set(species.speciesId, {
        ...current,
        observationCount: current.observationCount + 1,
        totalCount: species.count != null ? (current.totalCount ?? 0) + species.count : current.totalCount,
        latestObservedAt: latestDate(current.latestObservedAt, observation.observedAt),
      })
    }

    grouped.set(locationName, summary)
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.observationCount !== left.observationCount) {
        return right.observationCount - left.observationCount
      }
      return getTime(right.latestObservedAt) - getTime(left.latestObservedAt)
    })
    .slice(0, Math.max(0, locationLimit))
    .map((summary) => ({
      locationName: summary.locationName,
      observationCount: summary.observationCount,
      latestObservedAt: summary.latestObservedAt,
      latitude: summary.latitude,
      longitude: summary.longitude,
      species: Array.from(summary.speciesById.values())
        .sort((left, right) => {
          const latestDifference = getTime(right.latestObservedAt) - getTime(left.latestObservedAt)
          if (latestDifference !== 0) return latestDifference
          return right.observationCount - left.observationCount
        })
        .slice(0, Math.max(0, speciesLimit)),
    }))
}
