import { createClient } from '@/lib/supabase/server'
import { sanitizeSearch } from '@/lib/api/validation'
import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  mapDbSpecies,
  type ObservationEvent,
  type ObservationLinkedItem,
  type ObservationLocationSummary,
  type Species,
} from '@/lib/mappers/types'

type SpeciesRow = {
  id: number
  slug: string
  common_name: string
  scientific_name: string | null
  aliases: string[]
  taxon_group: string | null
  identification_notes: string | null
  habitat_notes: string | null
  seasonality_notes: string | null
  cover_image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type ObservationEventRow = {
  id: number
  user_id: string
  project_id: number | null
  challenge_id: number | null
  observed_at: string
  location_name: string
  latitude: number | null
  longitude: number | null
  location_precision: string | null
  habitat: string | null
  weather: string | null
  notes: string | null
  media_urls: string[]
  is_public: boolean
  status: string
  created_at: string
  updated_at: string
}

type ObservationEventSpeciesRow = {
  id: number
  observation_event_id: number
  species_id: number
  count: number | null
  behavior_tags: string[]
  confidence: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

type ProjectSpeciesRow = {
  project_id: number
  species_id: number
  sort_order: number
  relation_role: string
}

type ChallengeSpeciesRow = {
  challenge_id: number
  species_id: number
  sort_order: number
  relation_role: string
}

interface BirdHomepageSectionStep {
  title: string
  description: string
}

interface BirdHomepageData {
  topic: {
    channelTitle: string
    topicTitle: string
    summary: string
  }
  starterSteps: BirdHomepageSectionStep[]
  featuredChallenge: ObservationLinkedItem | null
  featuredProjects: ObservationLinkedItem[]
  featuredSpecies: Species[]
  recentObservations: ObservationEvent[]
}

interface SpeciesListOptions {
  query?: string
  page?: number
  pageSize?: number
}

interface ObservationListOptions {
  page?: number
  pageSize?: number
}

async function loadSpeciesForEvents(eventIds: number[]) {
  const supabase = await createClient()

  if (eventIds.length === 0) {
    return new Map<number, ObservationEvent['species']>()
  }

  const { data: rows, error } = await supabase
    .from('observation_event_species')
    .select('*')
    .in('observation_event_id', eventIds)

  if (error) {
    logger.error('Error fetching observation_event_species', { error, eventIds })
    return new Map<number, ObservationEvent['species']>()
  }

  const typedRows = (rows || []) as ObservationEventSpeciesRow[]
  const speciesIds = Array.from(new Set(typedRows.map((row) => row.species_id)))

  const { data: speciesRows, error: speciesError } = await supabase
    .from('species')
    .select('*')
    .in('id', speciesIds)

  if (speciesError) {
    logger.error('Error fetching species for observations', { error: speciesError, speciesIds })
    return new Map<number, ObservationEvent['species']>()
  }

  const speciesById = new Map<number, SpeciesRow>(
    ((speciesRows || []) as SpeciesRow[]).map((row) => [row.id, row]),
  )

  const grouped = new Map<number, ObservationEvent['species']>()
  for (const row of typedRows) {
    const species = speciesById.get(row.species_id)
    if (!species) continue
    const current = grouped.get(row.observation_event_id) || []
    current.push(mapDbObservationEventSpecies(row as never, species as never))
    grouped.set(row.observation_event_id, current)
  }

  return grouped
}

function uniqueLinkedItems(items: ObservationLinkedItem[]): ObservationLinkedItem[] {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

async function loadProjectAndChallengeLinksForEvents(rows: ObservationEventRow[]) {
  const supabase = await createClient()
  const projectIds = Array.from(
    new Set(rows.map((row) => row.project_id).filter((id): id is number => typeof id === 'number')),
  )
  const challengeIds = Array.from(
    new Set(rows.map((row) => row.challenge_id).filter((id): id is number => typeof id === 'number')),
  )

  const [projectResult, challengeResult] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, title').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    challengeIds.length > 0
      ? supabase.from('challenges').select('id, title').in('id', challengeIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (projectResult.error) {
    logger.error('Error fetching project links for observations', { error: projectResult.error })
  }
  if (challengeResult.error) {
    logger.error('Error fetching challenge links for observations', { error: challengeResult.error })
  }

  const projectMap = new Map<number, ObservationLinkedItem>(
    ((projectResult.data || []) as { id: number; title: string }[]).map((row) => [
      row.id,
      { id: row.id, title: row.title },
    ]),
  )
  const challengeMap = new Map<number, ObservationLinkedItem>(
    ((challengeResult.data || []) as { id: number; title: string }[]).map((row) => [
      row.id,
      { id: row.id, title: row.title },
    ]),
  )

  return { projectMap, challengeMap }
}

export async function getCuratedProjectSpecies(projectId: number): Promise<Species[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_species')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })

  if (error) {
    logger.error('Error fetching curated project species rows', { error, projectId })
    return []
  }

  const relationRows = (data || []) as ProjectSpeciesRow[]
  if (relationRows.length === 0) return []

  const speciesIds = relationRows.map((row) => row.species_id)
  const { data: speciesRows, error: speciesError } = await supabase
    .from('species')
    .select('*')
    .in('id', speciesIds)
    .eq('is_active', true)

  if (speciesError) {
    logger.error('Error fetching curated project species', { error: speciesError, projectId })
    return []
  }

  const speciesMap = new Map<number, SpeciesRow>(((speciesRows || []) as SpeciesRow[]).map((row) => [row.id, row]))
  return relationRows
    .map((row) => speciesMap.get(row.species_id))
    .filter((row): row is SpeciesRow => Boolean(row))
    .map((row) => mapDbSpecies(row as never))
}

export async function getCuratedChallengeSpecies(challengeId: number): Promise<Species[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('challenge_species')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('sort_order', { ascending: true })

  if (error) {
    logger.error('Error fetching curated challenge species rows', { error, challengeId })
    return []
  }

  const relationRows = (data || []) as ChallengeSpeciesRow[]
  if (relationRows.length === 0) return []

  const speciesIds = relationRows.map((row) => row.species_id)
  const { data: speciesRows, error: speciesError } = await supabase
    .from('species')
    .select('*')
    .in('id', speciesIds)
    .eq('is_active', true)

  if (speciesError) {
    logger.error('Error fetching curated challenge species', { error: speciesError, challengeId })
    return []
  }

  const speciesMap = new Map<number, SpeciesRow>(((speciesRows || []) as SpeciesRow[]).map((row) => [row.id, row]))
  return relationRows
    .map((row) => speciesMap.get(row.species_id))
    .filter((row): row is SpeciesRow => Boolean(row))
    .map((row) => mapDbSpecies(row as never))
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

export async function getBirdObservationHomepageData(): Promise<BirdHomepageData> {
  const supabase = await createClient()

  const [challengeResult, projectResult, speciesResult, observationsResult] = await Promise.all([
    supabase
      .from('challenges')
      .select('id, title')
      .contains('tags', ['鸟类'])
      .in('status', ['active', 'ended'])
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('projects')
      .select('id, title')
      .contains('tags', ['鸟类'])
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(3),
    supabase
      .from('species')
      .select('*')
      .eq('is_active', true)
      .order('common_name', { ascending: true })
      .limit(8),
    supabase
      .from('observation_events')
      .select('*')
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('observed_at', { ascending: false })
      .limit(6),
  ])

  if (challengeResult.error) logger.error('Error fetching homepage challenge', { error: challengeResult.error })
  if (projectResult.error) logger.error('Error fetching homepage projects', { error: projectResult.error })
  if (speciesResult.error) logger.error('Error fetching homepage species', { error: speciesResult.error })
  if (observationsResult.error) logger.error('Error fetching homepage observations', { error: observationsResult.error })

  const observationRows = (observationsResult.data || []) as ObservationEventRow[]
  const speciesByEvent = await loadSpeciesForEvents(observationRows.map((row) => row.id))
  const { projectMap, challengeMap } = await loadProjectAndChallengeLinksForEvents(observationRows)

  return {
    topic: {
      channelTitle: '自然观察',
      topicTitle: '北京春季观鸟',
      summary: '从校园、公园和社区开始认识常见鸟，学习观察方法，并提交你的第一条真实观察记录。',
    },
    starterSteps: [
      { title: '先学会观察', description: '先理解基础装备、观察顺序和记录方法。' },
      { title: '再选一个地点', description: '从最容易重复到达的公园、校园或社区绿地开始。' },
      { title: '提交一条记录', description: '记录时间、地点、物种、数量与行为，形成第一条观察沉淀。' },
    ],
    featuredChallenge: challengeResult.data
      ? { id: challengeResult.data.id, title: challengeResult.data.title }
      : null,
    featuredProjects: ((projectResult.data || []) as { id: number; title: string }[]).map((row) => ({
      id: row.id,
      title: row.title,
    })),
    featuredSpecies: ((speciesResult.data || []) as SpeciesRow[]).map((row) => mapDbSpecies(row as never)),
    recentObservations: observationRows.map((row) =>
      mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || [], {
        project: row.project_id ? projectMap.get(row.project_id) || null : null,
        challenge: row.challenge_id ? challengeMap.get(row.challenge_id) || null : null,
      }),
    ),
  }
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
    species: rows.map((row) => mapDbSpecies(row as never)),
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

  const baseSpecies = mapDbSpecies(data as never)
  const [curatedProjectRowsResult, curatedChallengeRowsResult] = await Promise.all([
    supabase
      .from('project_species')
      .select('*')
      .eq('species_id', data.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('challenge_species')
      .select('*')
      .eq('species_id', data.id)
      .order('sort_order', { ascending: true }),
  ])

  if (curatedProjectRowsResult.error) {
    logger.error('Error fetching curated project rows for species', { error: curatedProjectRowsResult.error, slug })
  }
  if (curatedChallengeRowsResult.error) {
    logger.error('Error fetching curated challenge rows for species', { error: curatedChallengeRowsResult.error, slug })
  }

  const curatedProjectRows = (curatedProjectRowsResult.data || []) as ProjectSpeciesRow[]
  const curatedChallengeRows = (curatedChallengeRowsResult.data || []) as ChallengeSpeciesRow[]

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

  const projectIds = Array.from(new Set([
    ...typedEventRows.map((row) => row.project_id).filter((id): id is number => typeof id === 'number'),
    ...curatedProjectRows.map((row) => row.project_id),
  ]))
  const challengeIds = Array.from(new Set([
    ...typedEventRows.map((row) => row.challenge_id).filter((id): id is number => typeof id === 'number'),
    ...curatedChallengeRows.map((row) => row.challenge_id),
  ]))

  const [projectResult, challengeResult] = await Promise.all([
    projectIds.length > 0
      ? supabase.from('projects').select('id, title').in('id', projectIds)
      : Promise.resolve({ data: [], error: null }),
    challengeIds.length > 0
      ? supabase.from('challenges').select('id, title').in('id', challengeIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (projectResult.error) {
    logger.error('Error fetching related projects for species', { error: projectResult.error, slug })
  }
  if (challengeResult.error) {
    logger.error('Error fetching related challenges for species', { error: challengeResult.error, slug })
  }

  const projectById = new Map<number, { id: number; title: string }>(
    ((projectResult.data || []) as { id: number; title: string }[]).map((row) => [row.id, row]),
  )
  const challengeById = new Map<number, { id: number; title: string }>(
    ((challengeResult.data || []) as { id: number; title: string }[]).map((row) => [row.id, row]),
  )

  const curatedProjects: ObservationLinkedItem[] = curatedProjectRows.flatMap((row) => {
    const project = projectById.get(row.project_id)
    return project ? [{ id: project.id, title: project.title, relationRole: row.relation_role }] : []
  })
  const observedProjects: ObservationLinkedItem[] = typedEventRows.flatMap((row) => {
    const project = row.project_id ? projectById.get(row.project_id) : null
    return project ? [{ id: project.id, title: project.title }] : []
  })

  const curatedChallenges: ObservationLinkedItem[] = curatedChallengeRows.flatMap((row) => {
    const challenge = challengeById.get(row.challenge_id)
    return challenge ? [{ id: challenge.id, title: challenge.title, relationRole: row.relation_role }] : []
  })
  const observedChallenges: ObservationLinkedItem[] = typedEventRows.flatMap((row) => {
    const challenge = row.challenge_id ? challengeById.get(row.challenge_id) : null
    return challenge ? [{ id: challenge.id, title: challenge.title }] : []
  })

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
      latestObservedAt: new Date(existing.latestObservedAt) > new Date(row.observed_at)
        ? existing.latestObservedAt
        : row.observed_at,
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
      mapDbObservationEvent(row as never, speciesSummariesByEvent.get(row.id) || [], {
        project: row.project_id ? (projectById.get(row.project_id) ? { id: row.project_id, title: projectById.get(row.project_id)!.title } : null) : null,
        challenge: row.challenge_id ? (challengeById.get(row.challenge_id) ? { id: row.challenge_id, title: challengeById.get(row.challenge_id)!.title } : null) : null,
      }),
    ),
    relatedProjects: uniqueLinkedItems([...curatedProjects, ...observedProjects]),
    relatedChallenges: uniqueLinkedItems([...curatedChallenges, ...observedChallenges]),
    topLocations,
  }
}

export async function getObservations(
  options: ObservationListOptions = {},
): Promise<{ observations: ObservationEvent[]; total: number; hasMore: boolean }> {
  const supabase = await createClient()
  const { page = 0, pageSize = 12 } = options
  const from = page * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('observation_events')
    .select('*', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('observed_at', { ascending: false })
    .range(from, to)

  if (error) {
    logger.error('Error fetching observations', { error })
    return { observations: [], total: 0, hasMore: false }
  }

  const rows = (data || []) as ObservationEventRow[]
  const speciesByEvent = await loadSpeciesForEvents(rows.map((row) => row.id))
  const { projectMap, challengeMap } = await loadProjectAndChallengeLinksForEvents(rows)

  return {
    observations: rows.map((row) =>
      mapDbObservationEvent(row as never, speciesByEvent.get(row.id) || [], {
        project: row.project_id ? projectMap.get(row.project_id) || null : null,
        challenge: row.challenge_id ? challengeMap.get(row.challenge_id) || null : null,
      }),
    ),
    total: count || 0,
    hasMore: (count || 0) > to + 1,
  }
}

export async function getObservationById(id: string | number): Promise<ObservationEvent | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('observation_events')
    .select('*')
    .eq('id', Number(id))
    .eq('status', 'approved')
    .eq('is_public', true)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching observation by id', { error, id })
    return null
  }

  if (!data) return null

  const speciesByEvent = await loadSpeciesForEvents([data.id])
  const { projectMap, challengeMap } = await loadProjectAndChallengeLinksForEvents([data as ObservationEventRow])
  return mapDbObservationEvent(data as never, speciesByEvent.get(data.id) || [], {
    project: data.project_id ? projectMap.get(data.project_id) || null : null,
    challenge: data.challenge_id ? challengeMap.get(data.challenge_id) || null : null,
  })
}
