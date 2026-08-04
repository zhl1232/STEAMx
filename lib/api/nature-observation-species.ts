import { cache } from 'react'

import { fetchObservedSpeciesIdsForApprovedEvents } from '@/lib/api/nature-observation-observed-species'
import { sanitizeSearch } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLocationSummary,
  type ObservationLifecycleStage,
  type ObservationSex,
  type Species,
  type SpeciesLifecycleAggregate,
  type SpeciesMonthlyAggregate,
  type SpeciesSexAggregate,
  type SpeciesStats,
  type SpeciesYearlyAggregate,
} from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import { applyHistoricalPublicLocationPrecision } from '@/lib/observations/public-location'
import {
  calculateProgressPercent,
  normalizeSpeciesObservationStatusFilter,
  type SpeciesObservationStatusFilter,
} from '@/lib/observations/progress'
import {
  getNatureTopicLabel,
  normalizeSpeciesTopicFilter,
  resolveSpeciesNatureTopicKey,
  visibleSpeciesTopicKeys,
  type SpeciesTopicCount,
  type SpeciesTopicFilter,
} from '@/lib/utils/nature-topic-classification'

import type {
  ObservationEventRow,
  ObservationEventSpeciesRow,
  SpeciesRow,
} from './nature-observation-internal-types'
import { mapSpeciesRowWithCoverImages } from './nature-observation-cover-image'

export interface SpeciesListOptions {
  query?: string
  topic?: SpeciesTopicFilter | string | null
  status?: SpeciesObservationStatusFilter | string | null
  page?: number
  pageSize?: number
}

const SPECIES_LIST_SELECT = [
  'id',
  'slug',
  'common_name',
  'scientific_name',
  'aliases',
  'taxon_group',
  'nature_topic',
  'life_form',
  'cultivation_status',
  'plant_uses',
  'identification_notes',
  'habitat_notes',
  'seasonality_notes',
  'cover_image_url',
  'audio_url',
  'is_active',
  'created_at',
  'updated_at',
].join(',')

function buildSpeciesSearchFilter(sanitizedQuery: string) {
  return `common_name.ilike.%${sanitizedQuery}%,scientific_name.ilike.%${sanitizedQuery}%,taxon_group.ilike.%${sanitizedQuery}%`
}

function mapSpeciesWithDerivedFields(row: SpeciesRow): Species {
  const { normalizedRow, imageUrls } = mapSpeciesRowWithCoverImages(row)
  const topicKey = resolveSpeciesNatureTopicKey(row)

  return {
    ...mapDbSpecies(normalizedRow as never),
    imageUrls,
    topicKey,
    topicLabel: getNatureTopicLabel(topicKey),
  }
}

async function fetchObservedSpeciesIdsForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Set<number>> {
  const { data: eventRows, error: eventError } = await supabase
    .from('observation_events')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .eq('moderation_state', 'approved')

  if (eventError) {
    logger.error('Error fetching user observation events for species list', { error: eventError, userId })
    return new Set<number>()
  }

  const eventIds = ((eventRows || []) as Array<{ id: number }>).map((row) => row.id)
  if (eventIds.length === 0) {
    return new Set<number>()
  }

  try {
    return await fetchObservedSpeciesIdsForApprovedEvents(supabase, eventIds, {
      userId,
      logLabel: 'species list observed filter',
    })
  } catch {
    return new Set<number>()
  }
}

async function getSpeciesTopicCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sanitizedQuery: string,
): Promise<SpeciesTopicCount[]> {
  const counts = await Promise.all(
    visibleSpeciesTopicKeys.map(async (topicKey) => {
      let request = supabase
        .from('species')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('nature_topic', topicKey)

      if (sanitizedQuery) {
        request = request.or(buildSpeciesSearchFilter(sanitizedQuery))
      }

      const { count, error } = await request
      if (error) {
        logger.error('Error counting species topic', { error, topicKey })
        return { key: topicKey, label: getNatureTopicLabel(topicKey), count: 0 }
      }

      return { key: topicKey, label: getNatureTopicLabel(topicKey), count: count || 0 }
    }),
  )

  return [
    { key: 'all', label: '全部', count: counts.reduce((sum, item) => sum + item.count, 0) },
    ...counts,
  ]
}

export async function getSpeciesList(
  options: SpeciesListOptions = {},
): Promise<{
  species: Species[]
  total: number
  hasMore: boolean
  topicCounts: SpeciesTopicCount[]
  observedCount: number
  unobservedCount: number
  progressPercent: number
  isProgressAvailable: boolean
}> {
  const supabase = await createClient()
  const { query, page = 0, pageSize = 12 } = options
  const topic = normalizeSpeciesTopicFilter(options.topic)
  const status = normalizeSpeciesObservationStatusFilter(options.status)
  const sanitizedQuery = sanitizeSearch(query ?? '')
  const from = Math.max(0, page) * pageSize
  const to = from + pageSize - 1

  const topicCountsPromise = getSpeciesTopicCounts(supabase, sanitizedQuery)
  let totalRequest = supabase
    .from('species')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (topic === 'all') {
    totalRequest = totalRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
  } else {
    totalRequest = totalRequest.eq('nature_topic', topic)
  }

  if (sanitizedQuery) {
    totalRequest = totalRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
  }

  const [
    { data: { user } },
    topicCounts,
    totalResult,
  ] = await Promise.all([
    supabase.auth.getUser(),
    topicCountsPromise,
    totalRequest,
  ])

  if (totalResult.error) {
    logger.error('Error counting species list', { error: totalResult.error })
    return {
      species: [],
      total: 0,
      hasMore: false,
      topicCounts,
      observedCount: 0,
      unobservedCount: 0,
      progressPercent: 0,
      isProgressAvailable: false,
    }
  }

  const total = totalResult.count || 0
  const observedSpeciesIds = user?.id
    ? await fetchObservedSpeciesIdsForUser(supabase, user.id)
    : new Set<number>()
  const isProgressAvailable = Boolean(user?.id)
  const effectiveStatus = isProgressAvailable ? status : 'all'
  const observedSpeciesIdList = Array.from(observedSpeciesIds)

  const countSpeciesByObservationStatus = async (observed: boolean) => {
    if (!isProgressAvailable) return observed ? 0 : total
    if (observedSpeciesIdList.length === 0) return observed ? 0 : total

    let request = supabase
      .from('species')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    if (observed) {
      request = request.in('id', observedSpeciesIdList)
    } else {
      request = request.not('id', 'in', `(${observedSpeciesIdList.join(',')})`)
    }

    if (topic === 'all') {
      request = request.in('nature_topic', [...visibleSpeciesTopicKeys])
    } else {
      request = request.eq('nature_topic', topic)
    }

    if (sanitizedQuery) {
      request = request.or(buildSpeciesSearchFilter(sanitizedQuery))
    }

    const { count, error } = await request
    if (error) {
      logger.error('Error counting species observation progress', { error, observed, topic })
      return 0
    }

    return count || 0
  }

  const [observedCount, unobservedCount] = await Promise.all([
    countSpeciesByObservationStatus(true),
    countSpeciesByObservationStatus(false),
  ])

  let rows: SpeciesRow[] = []

  if (effectiveStatus === 'observed') {
    if (isProgressAvailable && observedSpeciesIdList.length > 0) {
      let rowsRequest = supabase
        .from('species')
        .select(SPECIES_LIST_SELECT)
        .eq('is_active', true)
        .in('id', observedSpeciesIdList)

      if (topic === 'all') {
        rowsRequest = rowsRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
      } else {
        rowsRequest = rowsRequest.eq('nature_topic', topic)
      }

      if (sanitizedQuery) {
        rowsRequest = rowsRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
      }

      const { data, error } = await rowsRequest
        .order('common_name', { ascending: true })
        .range(from, to)

      if (error) {
        logger.error('Error fetching observed-only species list', { error })
        return {
          species: [],
          total: 0,
          hasMore: false,
          topicCounts,
          observedCount,
          unobservedCount,
          progressPercent: calculateProgressPercent(observedCount, total),
          isProgressAvailable,
        }
      }

      rows = ((data || []) as unknown) as SpeciesRow[]
    }
  } else if (effectiveStatus === 'unobserved') {
    if (isProgressAvailable) {
      let rowsRequest = supabase
        .from('species')
        .select(SPECIES_LIST_SELECT)
        .eq('is_active', true)

      if (observedSpeciesIdList.length > 0) {
        rowsRequest = rowsRequest.not('id', 'in', `(${observedSpeciesIdList.join(',')})`)
      }

      if (topic === 'all') {
        rowsRequest = rowsRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
      } else {
        rowsRequest = rowsRequest.eq('nature_topic', topic)
      }

      if (sanitizedQuery) {
        rowsRequest = rowsRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
      }

      const { data, error } = await rowsRequest
        .order('common_name', { ascending: true })
        .range(from, to)

      if (error) {
        logger.error('Error fetching unobserved-only species list', { error })
        return {
          species: [],
          total: 0,
          hasMore: false,
          topicCounts,
          observedCount,
          unobservedCount,
          progressPercent: calculateProgressPercent(observedCount, total),
          isProgressAvailable,
        }
      }

      rows = ((data || []) as unknown) as SpeciesRow[]
    }
  } else if (observedSpeciesIdList.length === 0) {
    let rowsRequest = supabase
      .from('species')
      .select(SPECIES_LIST_SELECT)
      .eq('is_active', true)

    if (topic === 'all') {
      rowsRequest = rowsRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
    } else {
      rowsRequest = rowsRequest.eq('nature_topic', topic)
    }

    if (sanitizedQuery) {
      rowsRequest = rowsRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
    }

    const { data, error } = await rowsRequest
      .order('common_name', { ascending: true })
      .range(from, to)

    if (error) {
      logger.error('Error fetching species list', { error })
      return {
        species: [],
        total: 0,
        hasMore: false,
        topicCounts,
        observedCount,
        unobservedCount,
        progressPercent: calculateProgressPercent(observedCount, total),
        isProgressAvailable,
      }
    }

    rows = ((data || []) as unknown) as SpeciesRow[]
  } else {
    let unobservedCountRequest = supabase
      .from('species')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .not('id', 'in', `(${observedSpeciesIdList.join(',')})`)

    if (topic === 'all') {
      unobservedCountRequest = unobservedCountRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
    } else {
      unobservedCountRequest = unobservedCountRequest.eq('nature_topic', topic)
    }

    if (sanitizedQuery) {
      unobservedCountRequest = unobservedCountRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
    }

    const { count: mixedUnobservedCount, error: unobservedCountError } = await unobservedCountRequest
    if (unobservedCountError) {
      logger.error('Error counting unobserved species list', { error: unobservedCountError })
      return {
        species: [],
        total: 0,
        hasMore: false,
        topicCounts,
        observedCount,
        unobservedCount,
        progressPercent: calculateProgressPercent(observedCount, total),
        isProgressAvailable,
      }
    }

    const unobservedTotal = mixedUnobservedCount || 0
    const unobservedRowsNeeded = Math.max(0, Math.min(pageSize, unobservedTotal - from))

    if (unobservedRowsNeeded > 0) {
      let unobservedRowsRequest = supabase
        .from('species')
        .select(SPECIES_LIST_SELECT)
        .eq('is_active', true)
        .not('id', 'in', `(${observedSpeciesIdList.join(',')})`)

      if (topic === 'all') {
        unobservedRowsRequest = unobservedRowsRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
      } else {
        unobservedRowsRequest = unobservedRowsRequest.eq('nature_topic', topic)
      }

      if (sanitizedQuery) {
        unobservedRowsRequest = unobservedRowsRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
      }

      const { data, error } = await unobservedRowsRequest
        .order('common_name', { ascending: true })
        .range(from, from + unobservedRowsNeeded - 1)

      if (error) {
        logger.error('Error fetching unobserved species list', { error })
        return {
          species: [],
          total: 0,
          hasMore: false,
          topicCounts,
          observedCount,
          unobservedCount,
          progressPercent: calculateProgressPercent(observedCount, total),
          isProgressAvailable,
        }
      }

      rows.push(...(((data || []) as unknown) as SpeciesRow[]))
    }

    const observedRowsNeeded = pageSize - rows.length
    if (observedRowsNeeded > 0) {
      const observedOffset = Math.max(0, from - unobservedTotal)
      let observedRowsRequest = supabase
        .from('species')
        .select(SPECIES_LIST_SELECT)
        .eq('is_active', true)
        .in('id', observedSpeciesIdList)

      if (topic === 'all') {
        observedRowsRequest = observedRowsRequest.in('nature_topic', [...visibleSpeciesTopicKeys])
      } else {
        observedRowsRequest = observedRowsRequest.eq('nature_topic', topic)
      }

      if (sanitizedQuery) {
        observedRowsRequest = observedRowsRequest.or(buildSpeciesSearchFilter(sanitizedQuery))
      }

      const { data, error } = await observedRowsRequest
        .order('common_name', { ascending: true })
        .range(observedOffset, observedOffset + observedRowsNeeded - 1)

      if (error) {
        logger.error('Error fetching observed species list', { error })
        return {
          species: [],
          total: 0,
          hasMore: false,
          topicCounts,
          observedCount,
          unobservedCount,
          progressPercent: calculateProgressPercent(observedCount, total),
          isProgressAvailable,
        }
      }

      rows.push(...(((data || []) as unknown) as SpeciesRow[]))
    }
  }

  return {
    species: rows.map((row) => ({
      ...mapSpeciesWithDerivedFields(row),
      observedByCurrentUser: observedSpeciesIds.has(row.id),
    })),
    total: effectiveStatus === 'observed'
      ? observedCount
      : effectiveStatus === 'unobserved'
        ? unobservedCount
        : total,
    hasMore: (effectiveStatus === 'observed'
      ? observedCount
      : effectiveStatus === 'unobserved'
        ? unobservedCount
        : total) > to + 1,
    topicCounts,
    observedCount,
    unobservedCount,
    progressPercent: calculateProgressPercent(observedCount, total),
    isProgressAvailable,
  }
}

export async function getSpeciesById(id: number): Promise<Species | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('species')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching species by id', { error, id })
    return null
  }

  if (!data) return null

  return mapSpeciesWithDerivedFields(data as SpeciesRow)
}

interface SpeciesObservationAuthorProfileRow {
  id: string
  username: string | null
  display_name: string | null
}

async function loadSpeciesObservationAuthorNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name')
    .in('id', uniqueUserIds)

  if (error) {
    logger.error('Error fetching species observation authors', { error, userIds: uniqueUserIds })
    return new Map()
  }

  return new Map(
    ((data || []) as SpeciesObservationAuthorProfileRow[]).map((profile) => [
      profile.id,
      profile.display_name || profile.username || null,
    ]),
  )
}

export const getSpeciesBySlug = cache(async function getSpeciesBySlug(slug: string): Promise<Species | null> {
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

  const baseSpecies = mapSpeciesWithDerivedFields(data as SpeciesRow)

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
    return {
      ...baseSpecies,
      stats: await computeSpeciesStats(supabase, data.id, [], []),
    }
  }

  const { data: eventRows, error: eventError } = await supabase
    .from('observation_events')
    .select('*')
    .in('id', eventIds)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(12)

  if (eventError) {
    logger.error('Error fetching recent observations for species', { error: eventError, slug })
    return baseSpecies
  }

  const typedEventRows = ((eventRows || []) as ObservationEventRow[]).map((row) =>
    applyHistoricalPublicLocationPrecision(row),
  )
  const authorNamesPromise = loadSpeciesObservationAuthorNames(
    supabase,
    typedEventRows.map((row) => row.user_id),
  )
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

  const [authorNamesByUserId, stats] = await Promise.all([
    authorNamesPromise,
    computeSpeciesStats(supabase, data.id, eventIds, typedLinkedRows),
  ])

  return {
    ...baseSpecies,
    recentObservations: typedEventRows.map((row) => ({
      ...mapDbObservationEvent(row as never, speciesSummariesByEvent.get(row.id) || []),
      authorDisplayName: authorNamesByUserId.get(row.user_id) || null,
    })),
    topLocations,
    stats,
  }
})

interface SpeciesStatsEventRow {
  id: number
  user_id: string
  observed_at: string
}

interface IdentificationRow {
  identifier_user_id: string | null
}

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

async function computeSpeciesStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  speciesId: number,
  allLinkedEventIds: number[],
  linkedRows: ObservationEventSpeciesRow[],
): Promise<SpeciesStats> {
  const emptyStats: SpeciesStats = {
    totalObservationCount: 0,
    latestObservedAt: null,
    topObservers: [],
    topIdentifiers: [],
    monthlyAggregates: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 })),
    yearlyAggregates: [],
    lifecycleAggregates: [],
    sexAggregates: [],
  }

  let statsEventRows: SpeciesStatsEventRow[] = []
  if (allLinkedEventIds.length > 0) {
    const { data, error } = await supabase
      .from('observation_events')
      .select('id,user_id,observed_at')
      .in('id', allLinkedEventIds)
      .eq('status', 'approved')
      .eq('is_public', true)
      .eq('moderation_state', 'approved')

    if (error) {
      logger.error('Error fetching species stats events', { error, speciesId })
    } else {
      statsEventRows = (data || []) as unknown as SpeciesStatsEventRow[]
    }
  }

  const totalObservationCount = statsEventRows.length
  const latestObservedAt = statsEventRows.reduce<string | null>((latest, row) => {
    if (!latest) return row.observed_at
    return new Date(row.observed_at) > new Date(latest) ? row.observed_at : latest
  }, null)

  const observerCounts = new Map<string, number>()
  for (const row of statsEventRows) {
    observerCounts.set(row.user_id, (observerCounts.get(row.user_id) ?? 0) + 1)
  }
  const topObserverEntries = Array.from(observerCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)

  const { data: identData, error: identError } = await supabase
    .from('observation_identifications')
    .select('identifier_user_id')
    .eq('species_id', speciesId)
    .eq('source', 'human')
    .eq('is_active', true)

  if (identError) {
    logger.error('Error fetching species identifications', { error: identError, speciesId })
  }

  const identifierCounts = new Map<string, number>()
  for (const row of ((identData || []) as IdentificationRow[])) {
    if (!row.identifier_user_id) continue
    identifierCounts.set(row.identifier_user_id, (identifierCounts.get(row.identifier_user_id) ?? 0) + 1)
  }
  const topIdentifierEntries = Array.from(identifierCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)

  const profileIds = Array.from(new Set([
    ...topObserverEntries.map(([id]) => id),
    ...topIdentifierEntries.map(([id]) => id),
  ]))
  const profileById = new Map<string, ProfileRow>()
  if (profileIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id,username,display_name,avatar_url')
      .in('id', profileIds)
    if (profileError) {
      logger.error('Error fetching species stats profiles', { error: profileError, speciesId })
    } else {
      for (const row of ((profileData || []) as unknown as ProfileRow[])) {
        profileById.set(row.id, row)
      }
    }
  }

  const monthCounts = new Map<number, number>()
  const yearCounts = new Map<number, number>()
  for (const row of statsEventRows) {
    const date = new Date(row.observed_at)
    if (Number.isNaN(date.getTime())) continue
    const month = date.getMonth() + 1
    const year = date.getFullYear()
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
  }
  const monthlyAggregates: SpeciesMonthlyAggregate[] = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    count: monthCounts.get(index + 1) ?? 0,
  }))
  const yearlyAggregates: SpeciesYearlyAggregate[] = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((left, right) => left.year - right.year)

  const statsEventIdSet = new Set(statsEventRows.map((row) => row.id))
  const statsLinkedRows = linkedRows.filter((row) => statsEventIdSet.has(row.observation_event_id))

  const lifecycleCounts = new Map<ObservationLifecycleStage, number>()
  const sexCounts = new Map<ObservationSex, number>()
  for (const row of statsLinkedRows) {
    if (row.lifecycle_stage) {
      lifecycleCounts.set(row.lifecycle_stage, (lifecycleCounts.get(row.lifecycle_stage) ?? 0) + 1)
    }
    if (row.sex) {
      sexCounts.set(row.sex, (sexCounts.get(row.sex) ?? 0) + 1)
    }
  }
  const lifecycleAggregates: SpeciesLifecycleAggregate[] = Array.from(lifecycleCounts.entries())
    .map(([stage, count]) => ({ stage, count }))
    .sort((left, right) => right.count - left.count)
  const sexAggregates: SpeciesSexAggregate[] = Array.from(sexCounts.entries())
    .map(([sex, count]) => ({ sex, count }))
    .sort((left, right) => right.count - left.count)

  const topObservers = topObserverEntries.map(([userId, count]) => {
    const profile = profileById.get(userId)
    return {
      userId,
      displayName: profile?.display_name || profile?.username || '匿名观察者',
      avatarUrl: profile?.avatar_url ?? null,
      observationCount: count,
    }
  })

  const topIdentifiers = topIdentifierEntries.map(([userId, count]) => {
    const profile = profileById.get(userId)
    return {
      userId,
      displayName: profile?.display_name || profile?.username || '匿名鉴定者',
      avatarUrl: profile?.avatar_url ?? null,
      identificationCount: count,
    }
  })

  if (totalObservationCount === 0
    && topIdentifiers.length === 0
    && lifecycleAggregates.length === 0
    && sexAggregates.length === 0) {
    return emptyStats
  }

  return {
    totalObservationCount,
    latestObservedAt,
    topObservers,
    topIdentifiers,
    monthlyAggregates,
    yearlyAggregates,
    lifecycleAggregates,
    sexAggregates,
  }
}
