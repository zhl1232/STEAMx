import { logger } from '@/lib/logger'
import type { ObservationIdentification } from '@/lib/mappers/types'
import { createClient } from '@/lib/supabase/server'

import type { ObservationIdentificationRow, SpeciesRow } from './nature-observation-internal-types'

export async function loadObservationIdentifications(
  eventIds: number[],
): Promise<Map<number, ObservationIdentification[]>> {
  if (eventIds.length === 0) return new Map()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('observation_identifications')
    .select('*')
    .in('observation_event_id', eventIds)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('Error fetching observation identifications', { error, eventIds })
    return new Map()
  }

  const rows = (data || []) as ObservationIdentificationRow[]
  const speciesIds = Array.from(new Set(rows.map((row) => row.species_id)))
  const humanUserIds = Array.from(
    new Set(rows.flatMap((row) => row.identifier_user_id ? [row.identifier_user_id] : [])),
  )

  const [{ data: speciesData, error: speciesError }, { data: profileData, error: profileError }] =
    await Promise.all([
      supabase.from('species').select('*').in('id', speciesIds),
      humanUserIds.length > 0
        ? supabase
            .from('profiles')
            .select('id, display_name, avatar_url, equipped_avatar_frame_id')
            .in('id', humanUserIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (speciesError || profileError) {
    logger.error('Error fetching identification labels', { speciesError, profileError, eventIds })
    return new Map()
  }

  const speciesById = new Map<number, SpeciesRow>(
    ((speciesData || []) as SpeciesRow[]).map((row) => [row.id, row]),
  )
  type ProfileRow = {
    id: string
    display_name: string | null
    avatar_url: string | null
    equipped_avatar_frame_id?: string | null
  }
  const profileById = new Map<string, ProfileRow>(
    ((profileData || []) as ProfileRow[]).map((row) => [row.id, row]),
  )
  const grouped = new Map<number, ObservationIdentification[]>()

  for (const row of rows) {
    const species = speciesById.get(row.species_id)
    if (!species) continue
    const identification: ObservationIdentification = {
      id: row.id,
      speciesId: species.id,
      speciesSlug: species.slug,
      commonName: species.common_name,
      scientificName: species.scientific_name,
      lifecycleStage: row.lifecycle_stage,
      sex: row.sex,
      source: row.source,
      identifierUserId: row.identifier_user_id,
      identifierDisplayName: row.identifier_user_id ? profileById.get(row.identifier_user_id)?.display_name ?? null : null,
      identifierAvatarUrl: row.identifier_user_id ? profileById.get(row.identifier_user_id)?.avatar_url ?? null : null,
      identifierAvatarFrameId: row.identifier_user_id
        ? profileById.get(row.identifier_user_id)?.equipped_avatar_frame_id ?? null
        : null,
      confidence: row.confidence,
      modelName: row.model_name,
      createdAt: row.created_at,
    }
    const current = grouped.get(row.observation_event_id) || []
    current.push(identification)
    grouped.set(row.observation_event_id, current)
  }

  return grouped
}
