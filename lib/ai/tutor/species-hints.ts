import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'

import { mapSpeciesRowToAudioRef, type TutorAudioRef } from './audio-tags'
import { loadTutorSpeciesCatalog, matchSpeciesCatalogInText } from './species-catalog'

export type TutorSpeciesHint = {
  slug: string
  label: string
  habitatNotes: string | null
  observationLocations: Array<{ locationName: string; observationCount: number }>
  audioRef: TutorAudioRef | null
}

function compact(value: string | null | undefined, max = 300) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

async function fetchObservationLocations(
  supabase: SupabaseClient<Database>,
  speciesId: number,
) {
  const { data: linkedRows, error: linkedError } = await supabase
    .from('observation_event_species')
    .select('observation_event_id')
    .eq('species_id', speciesId)
    .limit(200)

  if (linkedError || !linkedRows?.length) return []

  const eventIds = [...new Set(linkedRows.map((row) => row.observation_event_id))]
  const { data: eventRows, error: eventError } = await supabase
    .from('observation_events')
    .select('location_name')
    .in('id', eventIds)
    .eq('status', 'approved')
    .eq('is_public', true)
    .eq('moderation_state', 'approved')
    .not('location_name', 'is', null)
    .limit(200)

  if (eventError || !eventRows?.length) return []

  const counts = new Map<string, number>()
  for (const row of eventRows) {
    const locationName = row.location_name?.trim()
    if (!locationName) continue
    counts.set(locationName, (counts.get(locationName) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([locationName, observationCount]) => ({ locationName, observationCount }))
    .sort((left, right) => right.observationCount - left.observationCount)
    .slice(0, 5)
}

export async function findSpeciesHintsForText(
  supabase: SupabaseClient<Database>,
  text: string,
  limit = 2,
): Promise<TutorSpeciesHint[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  const catalog = await loadTutorSpeciesCatalog(supabase)
  if (!catalog.length) return []

  const matched = matchSpeciesCatalogInText(catalog, trimmed).slice(0, limit)
  return Promise.all(
    matched.map(async (row) => ({
      slug: row.slug,
      label: row.common_name,
      habitatNotes: row.habitat_notes,
      observationLocations: await fetchObservationLocations(supabase, row.id),
      audioRef: mapSpeciesRowToAudioRef(row),
    })),
  )
}

export function buildSpeciesHintsSummary(hints: TutorSpeciesHint[]) {
  if (!hints.length) return ''

  const blocks = hints.map((hint) => {
    const lines = [`物种：${hint.label}`]
    if (hint.habitatNotes) {
      lines.push(`常见环境：${compact(hint.habitatNotes)}`)
    }
    if (hint.observationLocations.length) {
      const locations = hint.observationLocations
        .map((item) => `${item.locationName}（${item.observationCount}次）`)
        .join('、')
      lines.push(`本站公开观察记录：${locations}`)
    }
    return lines.join('\n')
  })

  return [
    '【提及物种的补充资料】',
    ...blocks,
    '说明：描述栖息地时只能照抄上面的「常见环境」；具体地名只能说「站内有人在XX观察到」。只有学生主动问自己的观察记录或地点时，才结合学生画像说明；不要把观察地点说成「常见于XX」。',
  ].join('\n\n')
}

export function speciesHintsToAudioRefs(hints: TutorSpeciesHint[]): TutorAudioRef[] {
  return hints
    .map((hint) => hint.audioRef)
    .filter((item): item is TutorAudioRef => item !== null)
}
