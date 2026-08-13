import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearTutorSpeciesCatalogCache,
  loadTutorSpeciesCatalog,
  matchSpeciesCatalogInText,
  type TutorSpeciesCatalogRow,
} from '@/lib/ai/tutor/species-catalog'
import { logger } from '@/lib/logger'

const catalogRows = [
  {
    id: 1,
    slug: 'lanius-cristatus',
    common_name: '红尾伯劳',
    aliases: ['伯劳'],
    habitat_notes: '林缘',
    audio_url: '/birds/audio/lanius-cristatus.ogg',
    nature_topic: 'birds',
  },
  {
    id: 2,
    slug: 'papilio-xuthus',
    common_name: '柑橘凤蝶',
    aliases: null,
    habitat_notes: null,
    audio_url: null,
    nature_topic: 'insects',
  },
]

function createSpeciesClient(
  rangeImpl: (from: number, to: number) => Promise<{ data: TutorSpeciesCatalogRow[]; error: { message: string } | null }>,
) {
  const range = vi.fn(rangeImpl)
  const order = vi.fn(() => ({ range }))
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ order })),
    })),
  }))
  return { from, range, order }
}

afterEach(() => {
  clearTutorSpeciesCatalogCache()
  vi.restoreAllMocks()
})

describe('matchSpeciesCatalogInText', () => {
  it('narrows candidates by common name or alias', () => {
    expect(matchSpeciesCatalogInText(catalogRows, '今天看到红尾伯劳了').map((row) => row.slug)).toEqual([
      'lanius-cristatus',
    ])
    expect(matchSpeciesCatalogInText(catalogRows, '这只伯劳叫什么').map((row) => row.slug)).toEqual([
      'lanius-cristatus',
    ])
    expect(matchSpeciesCatalogInText(catalogRows, '没有提到物种')).toEqual([])
  })
})

describe('loadTutorSpeciesCatalog', () => {
  it('caches the active species catalog across calls', async () => {
    const client = createSpeciesClient(async () => ({ data: catalogRows, error: null }))

    await expect(loadTutorSpeciesCatalog(client as never)).resolves.toEqual(catalogRows)
    await expect(loadTutorSpeciesCatalog(client as never)).resolves.toEqual(catalogRows)
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.order).toHaveBeenCalledWith('id', { ascending: true })
  })

  it('dedupes in-flight catalog fetches', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const client = createSpeciesClient(async () => {
      await gate
      return { data: catalogRows, error: null }
    })

    const first = loadTutorSpeciesCatalog(client as never)
    const second = loadTutorSpeciesCatalog(client as never)
    release?.()

    await expect(Promise.all([first, second])).resolves.toEqual([catalogRows, catalogRows])
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it('keeps paging until a short page so later species stay matchable', async () => {
    const firstPageSize = 500
    const firstPage = Array.from({ length: firstPageSize }, (_, index) => ({
      ...catalogRows[0],
      id: index + 1,
      slug: `bird-${index + 1}`,
    }))
    const client = createSpeciesClient(async (from) => {
      if (from === 0) return { data: firstPage, error: null }
      return { data: [catalogRows[1]], error: null }
    })

    await expect(loadTutorSpeciesCatalog(client as never)).resolves.toEqual([...firstPage, catalogRows[1]])
    expect(client.range).toHaveBeenCalledTimes(2)
    expect(matchSpeciesCatalogInText([...firstPage, catalogRows[1]], '柑橘凤蝶').map((row) => row.slug)).toEqual([
      'papilio-xuthus',
    ])
  })

  it('returns a fetched prefix without caching when a later page fails', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      ...catalogRows[0],
      id: index + 1,
      slug: `bird-${index + 1}`,
    }))
    const client = createSpeciesClient(async (from) => {
      if (from === 0) return { data: firstPage, error: null }
      return { data: [], error: { message: 'page failed' } }
    })

    await expect(loadTutorSpeciesCatalog(client as never)).resolves.toEqual(firstPage)
    const callsAfterFirstLoad = client.from.mock.calls.length
    await expect(loadTutorSpeciesCatalog(client as never)).resolves.toEqual(firstPage)
    expect(client.from.mock.calls.length).toBeGreaterThan(callsAfterFirstLoad)
  })
})
