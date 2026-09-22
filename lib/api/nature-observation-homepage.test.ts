import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPublicClient } from '@/lib/supabase/server'
import { getCurrentUserObservedSpeciesLookup } from './nature-observation-observed-species'
import { getBirdObservationHomepageData } from './nature-observation-homepage'

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createPublicClient: vi.fn(),
}))
vi.mock('./nature-observation-observed-species', () => ({
  getCurrentUserObservedSpeciesLookup: vi.fn(),
}))

type QueryRecord = {
  table: string
  select?: string
  filters: Record<string, unknown>
}

const speciesRows = [
  {
    id: 1,
    slug: 'sparrow',
    common_name: '麻雀',
    scientific_name: 'Passer montanus',
    aliases: [],
    taxon_group: '鸟类',
    nature_topic: 'birds',
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    is_active: true,
  },
  {
    id: 2,
    slug: 'plant',
    common_name: '蒲公英',
    scientific_name: 'Taraxacum',
    aliases: [],
    taxon_group: '植物',
    nature_topic: 'plants',
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    is_active: true,
  },
  {
    id: 3,
    slug: 'fungus',
    common_name: '木耳',
    scientific_name: 'Auricularia',
    aliases: [],
    taxon_group: '真菌',
    nature_topic: 'fungi',
    identification_notes: null,
    habitat_notes: null,
    seasonality_notes: null,
    cover_image_url: null,
    audio_url: null,
    is_active: true,
  },
]

const observationRows = [
  {
    id: 1,
    user_id: 'user-1',
    observed_at: '2026-09-01T09:00:00.000Z',
    location_name: '公园',
    latitude: 39.9,
    longitude: 116.4,
    location_precision: null,
    habitat: null,
    weather: null,
    notes: null,
    media_urls: [],
    is_public: true,
    status: 'approved',
    moderation_state: 'approved',
    nature_topic: 'birds',
    identification_status: 'identified',
    observed_at_source: null,
    location_source: null,
    coordinate_system: null,
    created_at: '2026-09-20T09:00:00.000Z',
    likes_count: 0,
    comments_count: 0,
  },
  {
    id: 2,
    user_id: 'user-2',
    observed_at: '2020-01-01T09:00:00.000Z',
    location_name: '校园',
    latitude: null,
    longitude: null,
    location_precision: null,
    habitat: null,
    weather: null,
    notes: null,
    media_urls: [],
    is_public: true,
    status: 'approved',
    moderation_state: 'approved',
    nature_topic: 'plants',
    identification_status: 'identified',
    observed_at_source: null,
    location_source: null,
    coordinate_system: null,
    created_at: '2026-09-21T09:00:00.000Z',
    likes_count: 0,
    comments_count: 0,
  },
  {
    id: 3,
    user_id: 'user-3',
    observed_at: '2020-01-01T09:00:00.000Z',
    location_name: '花园',
    latitude: 39.8,
    longitude: 116.3,
    location_precision: null,
    habitat: null,
    weather: null,
    notes: null,
    media_urls: [],
    is_public: true,
    status: 'approved',
    moderation_state: 'approved',
    nature_topic: null,
    identification_status: 'unidentified',
    observed_at_source: null,
    location_source: null,
    coordinate_system: null,
    created_at: '2026-09-22T09:00:00.000Z',
    likes_count: 0,
    comments_count: 0,
  },
]

function createFluentClient(records: QueryRecord[]) {
  const responseFor = (table: string, select = '', filters: Record<string, unknown> = {}) => {
    if (table === 'observation_events') {
      if (select === 'id' && filters.head) {
        return { data: null, count: filters.weekly ? 1 : 3, error: null }
      }
      let rows = [...observationRows]
      if (Array.isArray(filters.id)) {
        const ids = filters.id as number[]
        rows = rows.filter((row) => ids.includes(row.id))
      }
      return {
        data: rows
          .sort((left, right) => right.created_at.localeCompare(left.created_at))
          .slice(0, typeof filters.limit === 'number' ? filters.limit : undefined),
        error: null,
      }
    }
    if (table === 'species') {
      if (select === 'id') return { data: null, count: 2, error: null }
      return { data: speciesRows, error: null }
    }
    if (table === 'observation_event_species') {
      if (select.includes('observation_events!inner')) return { data: null, count: 1, error: null }
      return { data: [], error: null }
    }
    if (table === 'profiles') return { data: [], error: null }
    return { data: [], error: null }
  }

  return {
    from(table: string) {
      let select = ''
      const filters: Record<string, unknown> = {}
      const query: Record<string, unknown> = {
        select(value: string, options?: { head?: boolean }) {
          select = value
          if (options?.head) filters.head = true
          return query
        },
        eq(key: string, value: unknown) {
          filters[key] = value
          return query
        },
        in(key: string, value: unknown) {
          filters[key] = value
          return query
        },
        gte(key: string, value: unknown) {
          filters[key] = value
          if (key === 'created_at') filters.weekly = true
          return query
        },
        order: () => query,
        range: () => query,
        limit(value: number) {
          filters.limit = value
          return query
        },
        then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
          records.push({ table, select, filters: { ...filters } })
          return Promise.resolve(responseFor(table, select, filters)).then(resolve, reject)
        },
      }
      return query
    },
  }
}

describe('getBirdObservationHomepageData', () => {
  let records: QueryRecord[]

  beforeEach(() => {
    records = []
    vi.clearAllMocks()
    vi.mocked(getCurrentUserObservedSpeciesLookup).mockResolvedValue({
      status: 'ready',
      userId: 'current-user',
      speciesIds: new Set(),
    })
    vi.mocked(createPublicClient).mockReturnValue(createFluentClient(records) as never)
  })

  it('keeps newer plant and unidentified records in recent observations while map keeps coordinates only', async () => {
    const result = await getBirdObservationHomepageData()

    expect(result.recentObservations.map((item) => item.id)).toEqual([3, 2, 1])
    expect(result.mapObservations.map((item) => item.id)).toEqual([3, 1])
  })

  it('counts the weekly window by created_at and active species only in visible topics', async () => {
    const result = await getBirdObservationHomepageData()

    expect(result.stats.weeklyObservationCount).toBe(1)
    expect(result.stats.speciesCount).toBe(2)

    const weekly = records.find(
      (record) => record.table === 'observation_events' && record.filters.weekly,
    )
    expect(weekly?.filters.created_at).toEqual(expect.any(String))

    const speciesCount = records.find(
      (record) => record.table === 'species' && record.select === 'id' && record.filters.head,
    )
    expect(speciesCount?.filters.nature_topic).toEqual(['birds', 'insects', 'plants'])
  })
})
