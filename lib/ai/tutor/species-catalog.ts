import type { SupabaseClient } from '@supabase/supabase-js'

import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'
import { BoundedTtlMap } from '@/lib/utils/bounded-ttl-map'

export type TutorSpeciesCatalogRow = {
  id: number
  slug: string
  common_name: string
  aliases: string[] | null
  habitat_notes: string | null
  audio_url: string | null
  nature_topic: string | null
}

const CATALOG_CACHE_KEY = 'active'
const catalogCache = new BoundedTtlMap<string, TutorSpeciesCatalogRow[]>(1)
const CATALOG_TTL_MS = 10 * 60 * 1000
const CATALOG_PAGE_SIZE = 500
const CATALOG_MAX_ROWS = 10_000
let catalogInflight: Promise<TutorSpeciesCatalogRow[]> | null = null

export function clearTutorSpeciesCatalogCache() {
  catalogCache.clear()
  catalogInflight = null
}

export function matchSpeciesCatalogInText<T extends { common_name: string; aliases: string[] | null }>(
  rows: T[],
  text: string,
): T[] {
  return rows.filter((row) => {
    const names = [row.common_name, ...(Array.isArray(row.aliases) ? row.aliases : [])]
      .map((name) => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean)
    return names.some((name) => text.includes(name))
  })
}

async function fetchTutorSpeciesCatalog(supabase: SupabaseClient<Database>) {
  const rows: TutorSpeciesCatalogRow[] = []

  for (let from = 0; from < CATALOG_MAX_ROWS; from += CATALOG_PAGE_SIZE) {
    const to = from + CATALOG_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('species')
      .select('id, slug, common_name, aliases, habitat_notes, audio_url, nature_topic')
      .eq('is_active', true)
      .order('id', { ascending: true })
      .range(from, to)

    if (error) {
      logger.warn('Failed to load tutor species catalog page.', {
        from,
        to,
        loaded: rows.length,
        error: error.message,
      })
      return rows
    }

    const batch = (data || []) as TutorSpeciesCatalogRow[]
    rows.push(...batch)
    if (batch.length < CATALOG_PAGE_SIZE) break
  }

  if (rows.length === 0) return []

  catalogCache.set(CATALOG_CACHE_KEY, rows, Date.now() + CATALOG_TTL_MS)
  return rows
}

export async function loadTutorSpeciesCatalog(supabase: SupabaseClient<Database>) {
  const cached = catalogCache.get(CATALOG_CACHE_KEY)
  if (cached) return cached

  if (!catalogInflight) {
    catalogInflight = fetchTutorSpeciesCatalog(supabase).finally(() => {
      catalogInflight = null
    })
  }

  return catalogInflight
}
