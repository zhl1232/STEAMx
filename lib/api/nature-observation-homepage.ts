import { unstable_cache } from 'next/cache'

import { logger } from '@/lib/logger'
import { natureTopicKeys, type NatureTopicKey } from '@/lib/config/nature-topics'
import {
  mapDbObservationEvent,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLocationSummary,
  type ObservationLinkedItem,
  type ObservationSpeciesSummary,
  type Species,
} from '@/lib/mappers/types'
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { resolveSpeciesNatureTopicKey } from '@/lib/utils/nature-topic-classification'
import { applyHistoricalPublicLocationPrecision } from '@/lib/observations/public-location'

import {
  buildTopicCategoryStats,
  buildTopicHotspotSummaries,
  getTopicObservationIds,
  type TopicCategoryObservationInput,
  type TopicCategorySpeciesLinkInput,
  type TopicCategoryStats,
  type TopicHotspotObservationInput,
  type TopicHotspotSpeciesInput,
} from './nature-observation-hotspots'
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
  'nature_topic',
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
  'nature_topic',
  'identification_status',
  'observed_at_source',
  'location_source',
  'coordinate_system',
  'likes_count',
  'comments_count',
].join(',')

const OBSERVATION_DIMENSION_SELECT = [
  'id',
  'user_id',
  'observed_at',
  'location_name',
  'latitude',
  'longitude',
  'location_precision',
  'media_urls',
  'nature_topic',
].join(',')

const OBSERVATION_ROWS_PAGE_SIZE = 1000
const HOTSPOT_QUERY_BATCH_SIZE = 200
const TOPIC_HOTSPOT_SPECIES_LIMIT = 5

export type { NatureTopicKey } from '@/lib/config/nature-topics'

export interface NatureObservationStats {
  observationCount: number
  speciesCount: number
  observerCount: number
  weeklyObservationCount: number
  identifiedRecordCount: number
  hotspotLocationCount: number
}

export interface NatureTopicSummary {
  key: NatureTopicKey
  observationCount: number
  speciesCount: number
}

export interface ObservationHotspotSummary extends ObservationLocationSummary {
  imageUrl?: string | null
}

type ObservationDimensionRow = Pick<
  ObservationEventRow,
  'id' | 'user_id' | 'observed_at' | 'location_name' | 'latitude' | 'longitude' | 'location_precision' | 'media_urls' | 'nature_topic'
>

type SpeciesStatsRow = Pick<SpeciesRow, 'id' | 'slug' | 'common_name' | 'scientific_name' | 'taxon_group' | 'nature_topic' | 'is_active'>

type ObservationSpeciesLinkRow = Pick<ObservationEventSpeciesRow, 'observation_event_id' | 'species_id'>

type ObservationSpeciesTopicLinkRow = Pick<ObservationEventSpeciesRow, 'observation_event_id' | 'species_id' | 'count'>

type SpeciesTopicRow = Pick<
  SpeciesRow,
  'id' | 'slug' | 'common_name' | 'scientific_name' | 'taxon_group' | 'nature_topic' | 'is_active'
>

interface ProfileSummaryRow {
  id: string
  username?: string | null
  display_name?: string | null
}

export type BirdObservationCategoryStats = TopicCategoryStats
export type TopicObservationCategoryStats = TopicCategoryStats
export type TreeObservationCategoryStats = TopicCategoryStats

const emptyStats: NatureObservationStats = {
  observationCount: 0,
  speciesCount: 0,
  observerCount: 0,
  weeklyObservationCount: 0,
  identifiedRecordCount: 0,
  hotspotLocationCount: 0,
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function buildEmptyTopicSummaries(): NatureTopicSummary[] {
  return natureTopicKeys.map((key) => ({
    key,
    observationCount: 0,
    speciesCount: 0,
  }))
}

async function countPublicObservations() {
  const supabase = createPublicClient()
  const { count, error } = await supabase
    .from('observation_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('is_public', true)

  if (error) {
    logger.error('Error counting public observations', { error })
    return 0
  }

  return count || 0
}

async function countWeeklyPublicObservations() {
  const supabase = createPublicClient()
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count, error } = await supabase
    .from('observation_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('is_public', true)
    .gte('observed_at', since)

  if (error) {
    logger.error('Error counting weekly public observations', { error })
    return 0
  }

  return count || 0
}

async function countActiveSpecies() {
  const supabase = createPublicClient()
  const { count, error } = await supabase
    .from('species')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) {
    logger.error('Error counting active species', { error })
    return 0
  }

  return count || 0
}

async function countIdentifiedObservationRecords() {
  const supabase = createPublicClient()
  const { count, error } = await supabase
    .from('observation_event_species')
    .select('id, observation_events!inner(status,is_public)', { count: 'exact', head: true })
    .eq('observation_events.status', 'approved')
    .eq('observation_events.is_public', true)

  if (error) {
    logger.error('Error counting identified observation records', { error })
    return 0
  }

  return count || 0
}

async function fetchAllPublicObservationDimensionRowsUncached(): Promise<ObservationDimensionRow[]> {
  const supabase = createPublicClient()
  const rows: ObservationDimensionRow[] = []

  for (let from = 0; ; from += OBSERVATION_ROWS_PAGE_SIZE) {
    const to = from + OBSERVATION_ROWS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('observation_events')
      .select(OBSERVATION_DIMENSION_SELECT)
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('observed_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('Error fetching public observation dimensions', { error, from, to })
      break
    }

    const batch = (data || []) as unknown as ObservationDimensionRow[]
    rows.push(...batch.map((row) => applyHistoricalPublicLocationPrecision(row)))

    if (batch.length < OBSERVATION_ROWS_PAGE_SIZE) break
  }

  return rows
}

const fetchAllPublicObservationDimensionRowsCached = unstable_cache(
  async () => fetchAllPublicObservationDimensionRowsUncached(),
  ['nature-public-observation-dimensions-v1'],
  { revalidate: 300, tags: ['nature-homepage', 'nature-observations'] },
)

async function fetchAllPublicObservationDimensionRows(): Promise<ObservationDimensionRow[]> {
  return fetchAllPublicObservationDimensionRowsCached()
}

async function fetchAllActiveSpeciesForStatsUncached(): Promise<SpeciesStatsRow[]> {
  const supabase = createPublicClient()
  const rows: SpeciesStatsRow[] = []

  for (let from = 0; ; from += OBSERVATION_ROWS_PAGE_SIZE) {
    const to = from + OBSERVATION_ROWS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('species')
      .select('id,slug,common_name,scientific_name,taxon_group,nature_topic,is_active')
      .eq('is_active', true)
      .order('common_name', { ascending: true })
      .range(from, to)

    if (error) {
      logger.error('Error fetching active species for stats', { error, from, to })
      break
    }

    const batch = (data || []) as unknown as SpeciesStatsRow[]
    rows.push(...batch)

    if (batch.length < OBSERVATION_ROWS_PAGE_SIZE) break
  }

  return rows
}

const fetchAllActiveSpeciesForStatsCached = unstable_cache(
  async () => fetchAllActiveSpeciesForStatsUncached(),
  ['nature-active-species-stats-v1'],
  { revalidate: 300, tags: ['nature-homepage', 'nature-species'] },
)

async function fetchAllActiveSpeciesForStats(): Promise<SpeciesStatsRow[]> {
  return fetchAllActiveSpeciesForStatsCached()
}

async function fetchAllPublicObservationSpeciesLinksUncached(): Promise<ObservationSpeciesLinkRow[]> {
  const supabase = createPublicClient()
  const rows: ObservationSpeciesLinkRow[] = []

  for (let from = 0; ; from += OBSERVATION_ROWS_PAGE_SIZE) {
    const to = from + OBSERVATION_ROWS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('observation_event_species')
      .select('observation_event_id,species_id, observation_events!inner(status,is_public)')
      .eq('observation_events.status', 'approved')
      .eq('observation_events.is_public', true)
      .range(from, to)

    if (error) {
      logger.error('Error fetching public observation species links for stats', { error, from, to })
      break
    }

    const batch = (data || []) as unknown as ObservationSpeciesLinkRow[]
    rows.push(...batch)

    if (batch.length < OBSERVATION_ROWS_PAGE_SIZE) break
  }

  return rows
}

const fetchAllPublicObservationSpeciesLinksCached = unstable_cache(
  async () => fetchAllPublicObservationSpeciesLinksUncached(),
  ['nature-public-observation-species-links-v1'],
  { revalidate: 300, tags: ['nature-homepage', 'nature-observations'] },
)

async function fetchAllPublicObservationSpeciesLinks(): Promise<ObservationSpeciesLinkRow[]> {
  return fetchAllPublicObservationSpeciesLinksCached()
}

async function loadProfileSummaries(userIds: string[]) {
  const supabase = createPublicClient()
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))

  if (uniqueUserIds.length === 0) {
    return new Map<string, ProfileSummaryRow>()
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .in('id', uniqueUserIds)

  if (error) {
    logger.error('Error fetching observation author profiles', { error, userIds: uniqueUserIds })
    return new Map<string, ProfileSummaryRow>()
  }

  return new Map(((data || []) as unknown as ProfileSummaryRow[]).map((profile) => [profile.id, profile]))
}

function buildObservationHotspots(rows: ObservationDimensionRow[], limit: number): ObservationHotspotSummary[] {
  const grouped = new Map<string, ObservationHotspotSummary>()

  for (const row of rows) {
    const locationName = row.location_name?.trim()
    if (!locationName) continue

    const existing = grouped.get(locationName)
    if (!existing) {
      grouped.set(locationName, {
        locationName,
        observationCount: 1,
        latestObservedAt: row.observed_at,
        latitude: row.latitude,
        longitude: row.longitude,
        imageUrl: row.media_urls?.[0] || null,
      })
      continue
    }

    const isNewer = new Date(row.observed_at).getTime() > new Date(existing.latestObservedAt).getTime()
    grouped.set(locationName, {
      ...existing,
      observationCount: existing.observationCount + 1,
      latestObservedAt: isNewer ? row.observed_at : existing.latestObservedAt,
      latitude: existing.latitude ?? row.latitude,
      longitude: existing.longitude ?? row.longitude,
      imageUrl: existing.imageUrl || row.media_urls?.[0] || null,
    })
  }

  return Array.from(grouped.values())
    .sort((left, right) => {
      if (right.observationCount !== left.observationCount) {
        return right.observationCount - left.observationCount
      }
      return new Date(right.latestObservedAt).getTime() - new Date(left.latestObservedAt).getTime()
    })
    .slice(0, limit)
}

function buildTopicSummaries(speciesRows: SpeciesStatsRow[], linkedRows: ObservationSpeciesLinkRow[], observationRows: ObservationDimensionRow[]): NatureTopicSummary[] {
  const speciesIdsByTopic = new Map<NatureTopicKey, Set<number>>()
  const observationIdsByTopic = new Map<NatureTopicKey, Set<number>>()
  const topicBySpeciesId = new Map<number, NatureTopicKey>()

  for (const key of natureTopicKeys) {
    speciesIdsByTopic.set(key, new Set<number>())
    observationIdsByTopic.set(key, new Set<number>())
  }

  for (const row of speciesRows) {
    const topicKey = resolveSpeciesNatureTopicKey(row)
    if (!topicKey) continue
    topicBySpeciesId.set(row.id, topicKey)
    speciesIdsByTopic.get(topicKey)?.add(row.id)
  }

  for (const row of linkedRows) {
    const topicKey = topicBySpeciesId.get(row.species_id)
    if (!topicKey) continue
    observationIdsByTopic.get(topicKey)?.add(row.observation_event_id)
  }

  for (const row of observationRows) {
    const topicKey = row.nature_topic as NatureTopicKey | null
    if (topicKey && observationIdsByTopic.has(topicKey)) {
      observationIdsByTopic.get(topicKey)?.add(row.id)
    }
  }

  return natureTopicKeys.map((key) => ({
    key,
    speciesCount: speciesIdsByTopic.get(key)?.size || 0,
    observationCount: observationIdsByTopic.get(key)?.size || 0,
  }))
}

function getSpeciesIdsForTopic(speciesRows: SpeciesStatsRow[], topicKey: NatureTopicKey): Set<number> {
  const speciesIds = new Set<number>()

  for (const row of speciesRows) {
    if (resolveSpeciesNatureTopicKey(row) === topicKey) {
      speciesIds.add(row.id)
    }
  }

  return speciesIds
}

function toTopicCategorySpeciesLinks(rows: ObservationSpeciesLinkRow[]): TopicCategorySpeciesLinkInput[] {
  return rows.map((row) => ({
    observationEventId: row.observation_event_id,
    speciesId: row.species_id,
  }))
}

function toTopicCategoryObservations(rows: Pick<ObservationDimensionRow, 'id' | 'location_name'>[]): TopicCategoryObservationInput[] {
  return rows.map((row) => ({
    id: row.id,
    locationName: row.location_name,
  }))
}

function mapTopicSpeciesToObservationSpecies(species: TopicHotspotSpeciesInput): ObservationSpeciesSummary {
  return {
    speciesId: species.speciesId,
    speciesSlug: species.speciesSlug,
    commonName: species.commonName,
    scientificName: species.scientificName,
    count: species.count,
    behaviorTags: [],
    confidence: null,
    notes: null,
  }
}

function buildTopicObservationCategoryStatsFromRows({
  speciesRows,
  observationRows,
  linkedRows,
  topicKey,
}: {
  speciesRows: SpeciesStatsRow[]
  observationRows: Pick<ObservationDimensionRow, 'id' | 'location_name' | 'nature_topic'>[]
  linkedRows: ObservationSpeciesLinkRow[]
  topicKey: NatureTopicKey
}): TopicObservationCategoryStats {
  const base = buildTopicCategoryStats(
    getSpeciesIdsForTopic(speciesRows, topicKey),
    toTopicCategoryObservations(observationRows),
    toTopicCategorySpeciesLinks(linkedRows),
  )
  const linkedIds = getTopicObservationIds(
    getSpeciesIdsForTopic(speciesRows, topicKey),
    toTopicCategorySpeciesLinks(linkedRows),
  )
  const matchedRows = observationRows.filter((row) =>
    row.nature_topic === topicKey || linkedIds.has(row.id),
  )
  return {
    ...base,
    observationCount: matchedRows.length,
    locationCount: new Set(matchedRows.map((row) => row.location_name?.trim()).filter(Boolean)).size,
  }
}

function collectObservationGalleryImages(observations: ObservationEvent[], limit = 6) {
  const images: string[] = []

  for (const observation of observations) {
    for (const imageUrl of observation.mediaUrls) {
      if (!imageUrl || images.includes(imageUrl)) continue
      images.push(imageUrl)
      if (images.length >= limit) return images
    }
  }

  return images
}

async function getSpeciesIdsForNatureTopic(topicKey: NatureTopicKey): Promise<number[]> {
  const speciesRows = await fetchAllActiveSpeciesForStats()

  return speciesRows
    .filter((row) => resolveSpeciesNatureTopicKey(row) === topicKey)
    .map((row) => row.id)
}

async function loadTopicObservationSpeciesForEventsPublic(
  eventIds: number[],
  topicKey: NatureTopicKey,
): Promise<Map<number, TopicHotspotSpeciesInput[]>> {
  const supabase = createPublicClient()
  const uniqueEventIds = Array.from(new Set(eventIds))

  if (uniqueEventIds.length === 0) {
    return new Map<number, TopicHotspotSpeciesInput[]>()
  }

  const typedRows: ObservationSpeciesTopicLinkRow[] = []
  for (const eventIdBatch of chunkItems(uniqueEventIds, HOTSPOT_QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('observation_event_species')
      .select('observation_event_id,species_id,count')
      .in('observation_event_id', eventIdBatch)

    if (error) {
      logger.error('Error fetching topic hotspot observation species', { error, eventIds: eventIdBatch, topicKey })
      return new Map<number, TopicHotspotSpeciesInput[]>()
    }

    typedRows.push(...((data || []) as unknown as ObservationSpeciesTopicLinkRow[]))
  }

  const speciesIds = Array.from(new Set(typedRows.map((row) => row.species_id)))

  if (speciesIds.length === 0) {
    return new Map<number, TopicHotspotSpeciesInput[]>()
  }

  const speciesRows: SpeciesTopicRow[] = []
  for (const speciesIdBatch of chunkItems(speciesIds, HOTSPOT_QUERY_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('species')
      .select('id,slug,common_name,scientific_name,taxon_group,nature_topic,is_active')
      .in('id', speciesIdBatch)
      .eq('is_active', true)

    if (error) {
      logger.error('Error fetching topic hotspot species', { error, speciesIds: speciesIdBatch, topicKey })
      return new Map<number, TopicHotspotSpeciesInput[]>()
    }

    speciesRows.push(...((data || []) as unknown as SpeciesTopicRow[]))
  }

  const topicSpeciesById = new Map<number, SpeciesTopicRow>(
    speciesRows
      .filter((row) => resolveSpeciesNatureTopicKey(row) === topicKey)
      .map((row) => [row.id, row]),
  )

  const grouped = new Map<number, TopicHotspotSpeciesInput[]>()
  for (const row of typedRows) {
    const species = topicSpeciesById.get(row.species_id)
    if (!species) continue

    const current = grouped.get(row.observation_event_id) || []
    current.push({
      speciesId: species.id,
      speciesSlug: species.slug,
      commonName: species.common_name,
      scientificName: species.scientific_name,
      count: row.count,
    })
    grouped.set(row.observation_event_id, current)
  }

  return grouped
}

export interface BirdHomepageData {
  featuredSpecies: Species[]
  recentObservations: ObservationEvent[]
  mapObservations: ObservationEvent[]
  stats: NatureObservationStats
  topicSummaries: NatureTopicSummary[]
  hotspots: ObservationHotspotSummary[]
  galleryImages: string[]
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
  return getTopicObservationFeaturedSpecies('birds', limit)
}

export async function getTopicObservationFeaturedSpecies(topicKey: NatureTopicKey, limit = 8): Promise<Species[]> {
  if (limit <= 0) {
    return []
  }

  const supabase = createPublicClient()
  const speciesIds = (await getSpeciesIdsForNatureTopic(topicKey)).slice(0, limit)

  if (speciesIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('species')
    .select(HOMEPAGE_SPECIES_SELECT)
    .in('id', speciesIds)
    .eq('is_active', true)
    .order('common_name', { ascending: true })
    .limit(limit)

  if (error) {
    logger.error('Error fetching topic homepage species', { error, topicKey })
    return []
  }

  const speciesRows = (data || []) as unknown as SpeciesRow[]

  const linkedRows = await fetchAllPublicObservationSpeciesLinks()
  const observationCountBySpecies = new Map<number, number>()
  for (const row of linkedRows) {
    if (!speciesIds.includes(row.species_id)) continue
    observationCountBySpecies.set(row.species_id, (observationCountBySpecies.get(row.species_id) ?? 0) + 1)
  }

  let observedSpeciesIds = new Set<number>()
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (user?.id) {
      const { data: userEventRows } = await authClient
        .from('observation_events')
        .select('id')
        .eq('user_id', user.id)
      const userEventIds = ((userEventRows || []) as Array<{ id: number }>).map((row) => row.id)
      if (userEventIds.length > 0) {
        const { data: userLinkRows } = await authClient
          .from('observation_event_species')
          .select('species_id')
          .in('observation_event_id', userEventIds)
        for (const row of ((userLinkRows || []) as Array<{ species_id: number | null }>)) {
          if (typeof row.species_id === 'number') {
            observedSpeciesIds.add(row.species_id)
          }
        }
      }
    }
  } catch (authError) {
    logger.error('Error resolving observed species for featured list', { error: authError, topicKey })
  }

  return speciesRows.map((row) => ({
    ...mapDbSpecies(normalizeSpeciesRow(row) as never),
    observationCount: observationCountBySpecies.get(row.id) ?? 0,
    observedByCurrentUser: observedSpeciesIds.has(row.id),
  }))
}

export async function getTreeObservationFeaturedSpecies(limit = 8): Promise<Species[]> {
  return getTopicObservationFeaturedSpecies('plants', limit)
}

export async function getBirdObservationRecentObservations(limit = 6): Promise<ObservationEvent[]> {
  return getTopicObservationRecentObservations('birds', limit)
}

export async function getTopicObservationRecentObservations(topicKey: NatureTopicKey, limit = 6): Promise<ObservationEvent[]> {
  if (limit <= 0) {
    return []
  }

  const supabase = createPublicClient()
  const [observationDimensionRows, speciesRows, linkedRows] = await Promise.all([
    fetchAllPublicObservationDimensionRows(),
    fetchAllActiveSpeciesForStats(),
    fetchAllPublicObservationSpeciesLinks(),
  ])
  const topicObservationIds = getTopicObservationIds(
    getSpeciesIdsForTopic(speciesRows, topicKey),
    toTopicCategorySpeciesLinks(linkedRows),
  )
  const candidateEventIds = observationDimensionRows
    .filter((row) => row.nature_topic === topicKey || topicObservationIds.has(row.id))
    .slice(0, limit)
    .map((row) => row.id)

  if (candidateEventIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('observation_events')
    .select(HOMEPAGE_OBSERVATION_SELECT)
    .in('id', candidateEventIds)
    .order('observed_at', { ascending: false })

  if (error) {
    logger.error('Error fetching topic homepage observations', { error, topicKey })
    return []
  }

  const observationRows = (data || []) as unknown as ObservationEventRow[]
  const topicSpeciesByEvent = await loadTopicObservationSpeciesForEventsPublic(
    observationRows.map((row) => row.id),
    topicKey,
  )
  const profilesById = await loadProfileSummaries(observationRows.map((row) => row.user_id))

  return observationRows.map((rawRow) => {
    const row = applyHistoricalPublicLocationPrecision(rawRow)
    const profile = profilesById.get(row.user_id)
    return {
      ...mapDbObservationEvent(
        row as never,
        (topicSpeciesByEvent.get(row.id) || []).map(mapTopicSpeciesToObservationSpecies),
      ),
      authorDisplayName: profile?.display_name || profile?.username || null,
    }
  })
}

export async function getTreeObservationRecentObservations(limit = 6): Promise<ObservationEvent[]> {
  return getTopicObservationRecentObservations('plants', limit)
}

export async function getRecentNatureObservationsForMap(limit = 24): Promise<ObservationEvent[]> {
  if (limit <= 0) {
    return []
  }

  const supabase = createPublicClient()
  const observationDimensionRows = await fetchAllPublicObservationDimensionRows()
  const candidateEventIds = observationDimensionRows
    .filter((row) => row.latitude != null && row.longitude != null)
    .slice(0, limit)
    .map((row) => row.id)

  if (candidateEventIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('observation_events')
    .select(HOMEPAGE_OBSERVATION_SELECT)
    .in('id', candidateEventIds)
    .order('observed_at', { ascending: false })

  if (error) {
    logger.error('Error fetching recent observations for nature homepage map', { error })
    return []
  }

  const observationRows = (data || []) as unknown as ObservationEventRow[]

  const [linkedRows, profilesById] = await Promise.all([
    (async () => {
      const links: ObservationSpeciesTopicLinkRow[] = []
      for (const idBatch of chunkItems(observationRows.map((row) => row.id), HOTSPOT_QUERY_BATCH_SIZE)) {
        const { data: linkData, error: linkError } = await supabase
          .from('observation_event_species')
          .select('observation_event_id,species_id,count')
          .in('observation_event_id', idBatch)
        if (linkError) {
          logger.error('Error fetching links for homepage map observations', { error: linkError })
          continue
        }
        links.push(...((linkData || []) as unknown as ObservationSpeciesTopicLinkRow[]))
      }
      return links
    })(),
    loadProfileSummaries(observationRows.map((row) => row.user_id)),
  ])

  const speciesIds = Array.from(new Set(linkedRows.map((row) => row.species_id)))
  const speciesById = new Map<number, SpeciesTopicRow>()
  if (speciesIds.length > 0) {
    for (const idBatch of chunkItems(speciesIds, HOTSPOT_QUERY_BATCH_SIZE)) {
      const { data: speciesData, error: speciesError } = await supabase
        .from('species')
        .select('id,slug,common_name,scientific_name,taxon_group,nature_topic,is_active')
        .in('id', idBatch)
        .eq('is_active', true)
      if (speciesError) {
        logger.error('Error fetching species for homepage map observations', { error: speciesError })
        continue
      }
      for (const row of ((speciesData || []) as unknown as SpeciesTopicRow[])) {
        speciesById.set(row.id, row)
      }
    }
  }

  const speciesByEvent = new Map<number, ObservationSpeciesSummary[]>()
  for (const link of linkedRows) {
    const species = speciesById.get(link.species_id)
    if (!species) continue
    const current = speciesByEvent.get(link.observation_event_id) || []
    current.push({
      speciesId: species.id,
      speciesSlug: species.slug,
      commonName: species.common_name,
      scientificName: species.scientific_name,
      count: link.count,
      behaviorTags: [],
      confidence: null,
      notes: null,
    })
    speciesByEvent.set(link.observation_event_id, current)
  }

  return observationRows.map((rawRow) => {
    const row = applyHistoricalPublicLocationPrecision(rawRow)
    const profile = profilesById.get(row.user_id)
    return {
      ...mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || []),
      authorDisplayName: profile?.display_name || profile?.username || null,
    }
  })
}

export async function getBirdObservationCategoryStats(): Promise<BirdObservationCategoryStats> {
  return getTopicObservationCategoryStats('birds')
}

export async function getTopicObservationCategoryStats(
  topicKey: NatureTopicKey,
): Promise<TopicObservationCategoryStats> {
  const [speciesRows, observationDimensionRows, linkedRows] = await Promise.all([
    fetchAllActiveSpeciesForStats(),
    fetchAllPublicObservationDimensionRows(),
    fetchAllPublicObservationSpeciesLinks(),
  ])

  return buildTopicObservationCategoryStatsFromRows({
    speciesRows,
    observationRows: observationDimensionRows,
    linkedRows,
    topicKey,
  })
}

export async function getTreeObservationCategoryStats(): Promise<TreeObservationCategoryStats> {
  return getTopicObservationCategoryStats('plants')
}

export async function getNatureObservationHotspots(limit = 30): Promise<ObservationHotspotSummary[]> {
  const observationDimensionRows = await fetchAllPublicObservationDimensionRows()
  return buildObservationHotspots(observationDimensionRows, limit)
}

export async function getBirdObservationTopicHotspots(limit = 6): Promise<ObservationLocationSummary[]> {
  return getTopicObservationHotspots('birds', limit)
}

export async function getTopicObservationHotspots(
  topicKey: NatureTopicKey,
  limit = 6,
): Promise<ObservationLocationSummary[]> {
  if (limit <= 0) {
    return []
  }

  const observationDimensionRows = await fetchAllPublicObservationDimensionRows()
  const speciesByEvent = await loadTopicObservationSpeciesForEventsPublic(
    observationDimensionRows.map((row) => row.id),
    topicKey,
  )
  const observations: TopicHotspotObservationInput[] = observationDimensionRows
    .filter((row) => row.nature_topic === topicKey || speciesByEvent.has(row.id))
    .map((row) => ({
      id: row.id,
      observedAt: row.observed_at,
      locationName: row.location_name,
      latitude: row.latitude,
      longitude: row.longitude,
    }))

  return buildTopicHotspotSummaries(observations, speciesByEvent, {
    locationLimit: limit,
    speciesLimit: TOPIC_HOTSPOT_SPECIES_LIMIT,
  })
}

export async function getTreeObservationHotspots(limit = 6): Promise<ObservationLocationSummary[]> {
  return getTopicObservationHotspots('plants', limit)
}

async function getHomepageStatsAndSummaries() {
  const [
    observationCount,
    speciesCount,
    weeklyObservationCount,
    identifiedRecordCount,
    observationDimensionRows,
    speciesRows,
    linkedRows,
  ] = await Promise.all([
    countPublicObservations(),
    countActiveSpecies(),
    countWeeklyPublicObservations(),
    countIdentifiedObservationRecords(),
    fetchAllPublicObservationDimensionRows(),
    fetchAllActiveSpeciesForStats(),
    fetchAllPublicObservationSpeciesLinks(),
  ])

  const observerIds = new Set(observationDimensionRows.map((row) => row.user_id).filter(Boolean))
  const locationNames = new Set(
    observationDimensionRows
      .map((row) => row.location_name?.trim())
      .filter((locationName): locationName is string => Boolean(locationName)),
  )

  return {
    stats: {
      observationCount,
      speciesCount,
      observerCount: observerIds.size,
      weeklyObservationCount,
      identifiedRecordCount,
      hotspotLocationCount: locationNames.size,
    },
    topicSummaries: buildTopicSummaries(speciesRows, linkedRows, observationDimensionRows),
    hotspots: buildObservationHotspots(observationDimensionRows, 8),
  }
}

const getBirdObservationHomepageDataCached = unstable_cache(
  async (): Promise<BirdHomepageData> => {
    const [featuredSpecies, recentObservations, mapObservations, statsAndSummaries] = await Promise.all([
      getBirdObservationFeaturedSpecies(),
      getBirdObservationRecentObservations(12),
      getRecentNatureObservationsForMap(24),
      getHomepageStatsAndSummaries(),
    ])

    return {
      featuredSpecies,
      recentObservations,
      mapObservations,
      stats: statsAndSummaries.stats,
      topicSummaries: statsAndSummaries.topicSummaries,
      hotspots: statsAndSummaries.hotspots,
      galleryImages: collectObservationGalleryImages(recentObservations),
    }
  },
  ['nature-homepage-v4-map-pair'],
  { revalidate: 300, tags: ['nature-homepage'] },
)

export async function getBirdObservationHomepageData(): Promise<BirdHomepageData> {
  try {
    return await getBirdObservationHomepageDataCached()
  } catch (error) {
    logger.error('Error fetching nature homepage data', { error })
    return {
      featuredSpecies: [],
      recentObservations: [],
      mapObservations: [],
      stats: emptyStats,
      topicSummaries: buildEmptyTopicSummaries(),
      hotspots: [],
      galleryImages: [],
    }
  }
}
