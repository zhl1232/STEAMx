export const speciesAtlasTopicKeys = ['birds', 'insects', 'plants'] as const

export type SpeciesAtlasTopicKey = (typeof speciesAtlasTopicKeys)[number]
export type SpeciesAtlasTopicFilter = SpeciesAtlasTopicKey | 'all'
export type SpeciesAtlasStatusFilter = 'all' | 'observed' | 'unobserved'
export type SpeciesAtlasProgressState = 'ready' | 'anonymous' | 'unavailable'

export interface SpeciesAtlasItem {
  id: number
  slug: string
  commonName: string
  scientificName: string | null
  taxonGroup: string | null
  aliases: string[]
  topicKey: SpeciesAtlasTopicKey
  thumbnailUrl: string | null
  observedByCurrentUser: boolean | null
}

export interface SpeciesAtlasGroup {
  key: SpeciesAtlasTopicKey
  label: string
  total: number
  observedCount: number | null
  items: SpeciesAtlasItem[]
}

export interface SpeciesAtlasResponse {
  schemaVersion: 1
  viewer: {
    authenticated: boolean
    progressState: SpeciesAtlasProgressState
  }
  total: number
  observedCount: number | null
  groups: SpeciesAtlasGroup[]
}

export interface SpeciesAtlasFilterState {
  query?: string
  topic?: SpeciesAtlasTopicFilter
  status?: SpeciesAtlasStatusFilter
}

const atlasCollator = new Intl.Collator('zh-CN-u-co-pinyin')

export function sortSpeciesAtlasItems(items: SpeciesAtlasItem[]): SpeciesAtlasItem[] {
  return [...items].sort((left, right) => {
    const nameOrder = atlasCollator.compare(left.commonName, right.commonName)
    return nameOrder || left.id - right.id
  })
}

export function normalizeSpeciesAtlasSearchValue(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase('zh-CN') ?? ''
}

export function getSpeciesAtlasSearchText(item: Pick<SpeciesAtlasItem, 'commonName' | 'scientificName' | 'taxonGroup' | 'aliases'>): string {
  return [item.commonName, item.scientificName, item.taxonGroup, ...item.aliases]
    .map(normalizeSpeciesAtlasSearchValue)
    .filter(Boolean)
    .join(' ')
}

export function filterSpeciesAtlasGroups(
  groups: SpeciesAtlasGroup[],
  filters: SpeciesAtlasFilterState,
): SpeciesAtlasGroup[] {
  const query = normalizeSpeciesAtlasSearchValue(filters.query)
  const topic = filters.topic ?? 'all'
  const status = filters.status ?? 'all'

  return groups
    .filter((group) => topic === 'all' || group.key === topic)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (query && !getSpeciesAtlasSearchText(item).includes(query)) return false
        if (status === 'observed' && item.observedByCurrentUser !== true) return false
        if (status === 'unobserved' && item.observedByCurrentUser !== false) return false
        return true
      }),
    }))
}

export function buildSpeciesAtlasFiltersKey(filters: SpeciesAtlasFilterState): string {
  const params = new URLSearchParams()
  const query = filters.query?.trim()
  if (query) params.set('q', query)
  if (filters.topic && filters.topic !== 'all') params.set('topic', filters.topic)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  return params.toString()
}

export function isSpeciesAtlasTopicKey(value: string | null | undefined): value is SpeciesAtlasTopicKey {
  return Boolean(value && speciesAtlasTopicKeys.includes(value as SpeciesAtlasTopicKey))
}

export function toSpeciesAtlasTopicKey(value: string | null | undefined): SpeciesAtlasTopicKey | null {
  return isSpeciesAtlasTopicKey(value) ? value : null
}
