import { logger } from '@/lib/logger'
import {
  mapDbObservationEvent,
  mapDbObservationEventSpecies,
  type ObservationEvent,
} from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'
import { applyHistoricalPublicLocationPrecision } from '@/lib/observations/public-location'
import { loadObservationIdentifications } from './nature-observation-identifications'

import type { ObservationEventRow, ObservationEventSpeciesRow, SpeciesRow } from './nature-observation-internal-types'

export interface ObservationListOptions {
  page?: number
  pageSize?: number
}

/** 公开观察列表的可见性口径，计数与取数必须保持一致 */
const PUBLIC_OBSERVATION_FILTERS = {
  status: 'approved',
  is_public: true,
  moderation_state: 'approved',
}

/** PostgREST 对起点超出末行的 range 返回 416 */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

/** 按观察事件 ID 批量加载物种摘要，供公开列表、「我的」列表等复用 */
export async function loadObservationSpeciesForEvents(eventIds: number[]) {
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

export async function getObservations(
  options: ObservationListOptions = {},
): Promise<{ observations: ObservationEvent[]; total: number; hasMore: boolean }> {
  const supabase = await createClient()
  const { page = 0, pageSize = 12 } = options
  const from = page * pageSize
  const to = from + pageSize - 1

  const countQuery = supabase
    .from('observation_events')
    .select('id', { count: 'exact', head: true })
    .match(PUBLIC_OBSERVATION_FILTERS)

  const dataQuery = supabase
    .from('observation_events')
    .select('*')
    .match(PUBLIC_OBSERVATION_FILTERS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)

  const [{ count, error: countError }, { data, error }] = await Promise.all([countQuery, dataQuery])

  if (countError) {
    logger.error('Error counting observations', { error: countError })
    return { observations: [], total: 0, hasMore: false }
  }

  const total = count || 0

  if (error) {
    // Deep links and stale pagination controls can legitimately ask for a page
    // past the last row; report an empty page with the real total instead.
    if (from >= total || error.code === RANGE_NOT_SATISFIABLE) {
      return { observations: [], total, hasMore: false }
    }

    logger.error('Error fetching observations', { error })
    return { observations: [], total, hasMore: false }
  }

  const rows = (data || []) as ObservationEventRow[]
  const speciesByEvent = await loadObservationSpeciesForEvents(rows.map((row) => row.id))

  return {
    observations: rows.map((row) =>
      mapDbObservationEvent(applyHistoricalPublicLocationPrecision(row) as never, speciesByEvent.get(row.id) || []),
    ),
    total,
    hasMore: total > from + rows.length,
  }
}

export async function getObservationById(id: string | number): Promise<ObservationEvent | null> {
  const supabase = await createClient()
  const observationId = Number(id)

  if (!Number.isInteger(observationId) || observationId <= 0) {
    return null
  }

  const { data: authData } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('observation_events')
    .select('*')
    .eq('id', observationId)
    .maybeSingle()

  if (error) {
    logger.error('Error fetching observation by id', { error, id })
    return null
  }

  if (!data) return null

  const isOwner = authData.user?.id === data.user_id
  if (!isOwner && data.moderation_state !== 'approved') return null
  if (data.status !== 'approved') {
    if (!isOwner) return null
  } else if (!data.is_public && !isOwner) {
    return null
  }

  const [speciesByEvent, identificationsByEvent] = await Promise.all([
    loadObservationSpeciesForEvents([data.id]),
    loadObservationIdentifications([data.id]),
  ])
  const visibleData = data.is_public
    ? applyHistoricalPublicLocationPrecision(data as ObservationEventRow, authData.user?.id)
    : data
  const observation = mapDbObservationEvent(visibleData as never, speciesByEvent.get(data.id) || [])
  observation.identifications = identificationsByEvent.get(data.id) || []
  return observation
}
