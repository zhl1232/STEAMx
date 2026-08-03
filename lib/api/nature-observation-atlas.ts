import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'

import { unstable_cache } from 'next/cache'

import { getNatureTopicLabel } from '@/lib/utils/nature-topic-classification'
import {
  sortSpeciesAtlasItems,
  normalizeSpeciesAtlasInitial,
  speciesAtlasTopicKeys,
  type SpeciesAtlasGroup,
  type SpeciesAtlasItem,
  type SpeciesAtlasProgressState,
  type SpeciesAtlasResponse,
  type SpeciesAtlasTopicKey,
} from '@/lib/nature-species-atlas'
import { logger } from '@/lib/logger'
import { createPublicClient } from '@/lib/supabase/server'
import { toSpeciesPinyinLabel } from '@/lib/utils/species-pinyin'
import type { SpeciesRow } from './nature-observation-internal-types'
import { getCurrentUserObservedSpeciesLookup } from './nature-observation-observed-species'

const SPECIES_ATLAS_SELECT = 'id,slug,common_name,scientific_name,aliases,taxon_group,nature_topic'
const SPECIES_ATLAS_MANIFEST_PATH = path.join(process.cwd(), 'public', 'manifests', 'species-atlas-thumbnails.json')

interface SpeciesAtlasThumbnailManifestItem {
  topicKey: SpeciesAtlasTopicKey
  thumbnailUrl: string
}

interface SpeciesAtlasThumbnailManifest {
  schemaVersion: 1
  items: Record<string, SpeciesAtlasThumbnailManifestItem>
}

type SpeciesAtlasCatalog = {
  groups: SpeciesAtlasGroup[]
  total: number
}

function loadThumbnailManifest(): SpeciesAtlasThumbnailManifest {
  if (!existsSync(SPECIES_ATLAS_MANIFEST_PATH)) {
    return { schemaVersion: 1, items: {} }
  }

  try {
    const parsed = JSON.parse(readFileSync(SPECIES_ATLAS_MANIFEST_PATH, 'utf8')) as Partial<SpeciesAtlasThumbnailManifest>
    if (parsed.schemaVersion !== 1 || !parsed.items || typeof parsed.items !== 'object') {
      return { schemaVersion: 1, items: {} }
    }

    const items = Object.fromEntries(
      Object.entries(parsed.items).filter(([, item]) => (
        item &&
        typeof item === 'object' &&
        typeof item.topicKey === 'string' &&
        typeof item.thumbnailUrl === 'string' &&
        item.thumbnailUrl.startsWith('/')
      )),
    ) as Record<string, SpeciesAtlasThumbnailManifestItem>

    return { schemaVersion: 1, items }
  } catch (error) {
    logger.error('Error reading species atlas thumbnail manifest', { error })
    return { schemaVersion: 1, items: {} }
  }
}

function mapCatalogRow(row: Pick<SpeciesRow, 'id' | 'slug' | 'common_name' | 'scientific_name' | 'aliases' | 'taxon_group' | 'nature_topic'>, manifest: SpeciesAtlasThumbnailManifest): SpeciesAtlasItem | null {
  if (!speciesAtlasTopicKeys.includes(row.nature_topic as SpeciesAtlasTopicKey)) {
    return null
  }

  const topicKey = row.nature_topic as SpeciesAtlasTopicKey
  const thumbnail = manifest.items[row.slug]
  const thumbnailUrl = thumbnail?.topicKey === topicKey ? thumbnail.thumbnailUrl : null
  const initial = normalizeSpeciesAtlasInitial(toSpeciesPinyinLabel(row.common_name))

  return {
    id: row.id,
    slug: row.slug,
    commonName: row.common_name,
    scientificName: row.scientific_name,
    taxonGroup: row.taxon_group,
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
    topicKey,
    initial,
    thumbnailUrl,
    observedByCurrentUser: null,
  }
}

async function fetchSpeciesAtlasCatalog(): Promise<SpeciesAtlasCatalog> {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('species')
    .select(SPECIES_ATLAS_SELECT)
    .eq('is_active', true)
    .in('nature_topic', [...speciesAtlasTopicKeys])

  if (error) {
    logger.error('Error fetching species atlas catalog', { error })
    throw error
  }

  const manifest = loadThumbnailManifest()
  const grouped = new Map<SpeciesAtlasTopicKey, SpeciesAtlasItem[]>()
  for (const key of speciesAtlasTopicKeys) grouped.set(key, [])

  for (const rawRow of (data || []) as unknown as Array<Pick<SpeciesRow, 'id' | 'slug' | 'common_name' | 'scientific_name' | 'aliases' | 'taxon_group' | 'nature_topic'>>) {
    const item = mapCatalogRow(rawRow, manifest)
    if (!item) continue
    grouped.get(item.topicKey)?.push(item)
  }

  const groups = speciesAtlasTopicKeys.map((key) => {
    const items = sortSpeciesAtlasItems(grouped.get(key) ?? [])
    return {
      key,
      label: getNatureTopicLabel(key),
      total: items.length,
      observedCount: null,
      items,
    }
  })

  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.total, 0),
  }
}

const getSpeciesAtlasCatalogCached = unstable_cache(
  fetchSpeciesAtlasCatalog,
  ['nature-species-atlas-catalog-v2'],
  { revalidate: 300, tags: ['nature-species'] },
)

function mergeAtlasProgress(catalog: SpeciesAtlasCatalog, lookup: Awaited<ReturnType<typeof getCurrentUserObservedSpeciesLookup>>): SpeciesAtlasResponse {
  const progressState: SpeciesAtlasProgressState = lookup.status
  const isReady = progressState === 'ready'
  const observedIds = lookup.speciesIds
  let observedCount = 0

  const groups = catalog.groups.map((group) => {
    let groupObservedCount = 0
    const items = group.items.map((item) => {
      const observed = isReady ? observedIds.has(item.id) : null
      if (observed) {
        observedCount += 1
        groupObservedCount += 1
      }
      return { ...item, observedByCurrentUser: observed }
    })

    return {
      ...group,
      observedCount: isReady ? groupObservedCount : null,
      items,
    }
  })

  return {
    schemaVersion: 1,
    viewer: {
      authenticated: lookup.status !== 'anonymous',
      progressState,
    },
    total: catalog.total,
    observedCount: isReady ? observedCount : null,
    groups,
  }
}

export async function getSpeciesAtlas(): Promise<SpeciesAtlasResponse> {
  const [catalog, lookup] = await Promise.all([
    getSpeciesAtlasCatalogCached(),
    getCurrentUserObservedSpeciesLookup(),
  ])

  return mergeAtlasProgress(catalog, lookup)
}

export async function getSpeciesAtlasProgress() {
  const atlas = await getSpeciesAtlas()
  return {
    viewer: atlas.viewer,
    total: atlas.total,
    observedCount: atlas.observedCount,
    groups: atlas.groups.map(({ key, label, total, observedCount }) => ({
      key,
      label,
      total,
      observedCount,
    })),
  }
}

export type { SpeciesAtlasGroup, SpeciesAtlasItem, SpeciesAtlasResponse }
