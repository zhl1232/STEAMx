import { unstable_cache } from 'next/cache'

import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLocationSummary,
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

const OBSERVATION_DIMENSION_SELECT = [
  'id',
  'user_id',
  'observed_at',
  'location_name',
  'latitude',
  'longitude',
  'media_urls',
].join(',')

const OBSERVATION_ROWS_PAGE_SIZE = 1000

const natureTopicKeys = ['birds', 'insects', 'plants', 'fungi'] as const
export type NatureTopicKey = (typeof natureTopicKeys)[number]

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
  'id' | 'user_id' | 'observed_at' | 'location_name' | 'latitude' | 'longitude' | 'media_urls'
>

type SpeciesStatsRow = Pick<SpeciesRow, 'id' | 'common_name' | 'scientific_name' | 'taxon_group' | 'is_active'>

type ObservationSpeciesLinkRow = Pick<ObservationEventSpeciesRow, 'observation_event_id' | 'species_id'>

interface ProfileSummaryRow {
  id: string
  username?: string | null
  display_name?: string | null
}

const emptyStats: NatureObservationStats = {
  observationCount: 0,
  speciesCount: 0,
  observerCount: 0,
  weeklyObservationCount: 0,
  identifiedRecordCount: 0,
  hotspotLocationCount: 0,
}

const birdKeywords = [
  '鸟',
  '禽',
  '鹭',
  '鸭',
  '雁',
  '鹅',
  '鹳',
  '鹤',
  '鸥',
  '鸻',
  '鹬',
  '鸠',
  '鸽',
  '鹃',
  '鸮',
  '隼',
  '鹰',
  '鹗',
  '雕',
  '鹫',
  '鹞',
  '鸢',
  '鸨',
  '雉',
  '鹌',
  '鹑',
  '鸬鹚',
  '䴙',
  '秧鸡',
  '水鸡',
  '骨顶',
  '翠鸟',
  '啄木',
  '百灵',
  '燕',
  '鹨',
  '鹡鸰',
  '鹎',
  '伯劳',
  '鸦',
  '椋鸟',
  '雀',
  '莺',
  '鸫',
  '鸲',
  '鹟',
  '鹀',
  '山雀',
  '戴菊',
  '鹪鹩',
]

const insectKeywords = [
  '昆虫',
  '虫',
  '蝶',
  '蛾',
  '蜂',
  '蚁',
  '甲虫',
  '瓢虫',
  '蜻蜓',
  '螳螂',
  '蟋蟀',
  '蝉',
  '蝽',
  '蚊',
  '蝇',
  '螽斯',
  '蝗',
  '蚱',
]

const plantKeywords = [
  '植物',
  '花',
  '草',
  '树',
  '灌木',
  '乔木',
  '藤',
  '莲',
  '荷',
  '兰',
  '菊',
  '蔷薇',
  '松',
  '柏',
  '蕨',
  '苔藓',
  '藻',
]

const fungiKeywords = ['真菌', '菌物', '蘑菇', '菇', '木耳', '灵芝', '马勃', '伞菌']

function matchAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function resolveNatureTopicKey(row: SpeciesStatsRow): NatureTopicKey | null {
  const text = `${row.common_name} ${row.scientific_name || ''} ${row.taxon_group || ''}`

  if (matchAnyKeyword(text, birdKeywords)) return 'birds'
  if (matchAnyKeyword(text, fungiKeywords)) return 'fungi'
  if (matchAnyKeyword(text, insectKeywords)) return 'insects'
  if (matchAnyKeyword(text, plantKeywords)) return 'plants'

  return null
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
    .select('id', { count: 'exact', head: true })

  if (error) {
    logger.error('Error counting identified observation records', { error })
    return 0
  }

  return count || 0
}

async function fetchAllPublicObservationDimensionRows(): Promise<ObservationDimensionRow[]> {
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
    rows.push(...batch)

    if (batch.length < OBSERVATION_ROWS_PAGE_SIZE) break
  }

  return rows
}

async function fetchAllActiveSpeciesForStats(): Promise<SpeciesStatsRow[]> {
  const supabase = createPublicClient()
  const rows: SpeciesStatsRow[] = []

  for (let from = 0; ; from += OBSERVATION_ROWS_PAGE_SIZE) {
    const to = from + OBSERVATION_ROWS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('species')
      .select('id,common_name,scientific_name,taxon_group,is_active')
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

async function fetchAllPublicObservationSpeciesLinks(): Promise<ObservationSpeciesLinkRow[]> {
  const supabase = createPublicClient()
  const rows: ObservationSpeciesLinkRow[] = []

  for (let from = 0; ; from += OBSERVATION_ROWS_PAGE_SIZE) {
    const to = from + OBSERVATION_ROWS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('observation_event_species')
      .select('observation_event_id,species_id')
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

function buildTopicSummaries(speciesRows: SpeciesStatsRow[], linkedRows: ObservationSpeciesLinkRow[]): NatureTopicSummary[] {
  const speciesIdsByTopic = new Map<NatureTopicKey, Set<number>>()
  const observationIdsByTopic = new Map<NatureTopicKey, Set<number>>()
  const topicBySpeciesId = new Map<number, NatureTopicKey>()

  for (const key of natureTopicKeys) {
    speciesIdsByTopic.set(key, new Set<number>())
    observationIdsByTopic.set(key, new Set<number>())
  }

  for (const row of speciesRows) {
    const topicKey = resolveNatureTopicKey(row)
    if (!topicKey) continue
    topicBySpeciesId.set(row.id, topicKey)
    speciesIdsByTopic.get(topicKey)?.add(row.id)
  }

  for (const row of linkedRows) {
    const topicKey = topicBySpeciesId.get(row.species_id)
    if (!topicKey) continue
    observationIdsByTopic.get(topicKey)?.add(row.observation_event_id)
  }

  return natureTopicKeys.map((key) => ({
    key,
    speciesCount: speciesIdsByTopic.get(key)?.size || 0,
    observationCount: observationIdsByTopic.get(key)?.size || 0,
  }))
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
  const profilesById = await loadProfileSummaries(observationRows.map((row) => row.user_id))

  return observationRows.map((row) => {
    const profile = profilesById.get(row.user_id)
    return {
      ...mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || []),
      authorDisplayName: profile?.display_name || profile?.username || null,
    }
  })
}

export async function getNatureObservationHotspots(limit = 30): Promise<ObservationHotspotSummary[]> {
  const observationDimensionRows = await fetchAllPublicObservationDimensionRows()
  return buildObservationHotspots(observationDimensionRows, limit)
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
    topicSummaries: buildTopicSummaries(speciesRows, linkedRows),
    hotspots: buildObservationHotspots(observationDimensionRows, 8),
  }
}

const getBirdObservationHomepageDataCached = unstable_cache(
  async (): Promise<BirdHomepageData> => {
    const [featuredSpecies, recentObservations, statsAndSummaries] = await Promise.all([
      getBirdObservationFeaturedSpecies(),
      getBirdObservationRecentObservations(12),
      getHomepageStatsAndSummaries(),
    ])

    return {
      featuredSpecies,
      recentObservations,
      stats: statsAndSummaries.stats,
      topicSummaries: statsAndSummaries.topicSummaries,
      hotspots: statsAndSummaries.hotspots,
      galleryImages: collectObservationGalleryImages(recentObservations),
    }
  },
  ['nature-homepage-v3-real-data'],
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
      stats: emptyStats,
      topicSummaries: buildEmptyTopicSummaries(),
      hotspots: [],
      galleryImages: [],
    }
  }
}
