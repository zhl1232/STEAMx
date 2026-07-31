import { describe, expect, it } from 'vitest'

import {
  filterSpeciesAtlasGroups,
  sortSpeciesAtlasItems,
  type SpeciesAtlasGroup,
  type SpeciesAtlasItem,
} from './nature-species-atlas'

function item(overrides: Partial<SpeciesAtlasItem>): SpeciesAtlasItem {
  return {
    id: 1,
    slug: 'default-species',
    commonName: '默认物种',
    scientificName: 'Default species',
    taxonGroup: '默认科 默认属',
    aliases: [],
    topicKey: 'birds',
    thumbnailUrl: null,
    observedByCurrentUser: false,
    ...overrides,
  }
}

function groups(items: SpeciesAtlasItem[]): SpeciesAtlasGroup[] {
  return [{ key: 'birds', label: '鸟类', total: items.length, observedCount: 1, items }]
}

describe('nature-species-atlas', () => {
  it('sorts by Chinese name and uses id as the stable tie breaker', () => {
    const sorted = sortSpeciesAtlasItems([
      item({ id: 3, commonName: '大山雀' }),
      item({ id: 2, commonName: '白鹭' }),
      item({ id: 1, commonName: '大山雀' }),
    ])

    expect(sorted.map((species) => species.id)).toEqual([2, 1, 3])
  })

  it('searches common name, scientific name, taxon group and aliases', () => {
    const result = filterSpeciesAtlasGroups(
      groups([
        item({ slug: 'egret', commonName: '白鹭', scientificName: 'Egretta garzetta' }),
        item({ slug: 'sparrow', commonName: '麻雀', aliases: ['瓦雀'] }),
        item({ slug: 'swift', commonName: '雨燕', taxonGroup: '燕科 雨燕属' }),
      ]),
      { query: '瓦雀', topic: 'all', status: 'all' },
    )

    expect(result[0].items.map((species) => species.slug)).toEqual(['sparrow'])
  })

  it('filters topic and observation status without changing source order', () => {
    const source = [
      item({ id: 1, slug: 'first', commonName: '甲', observedByCurrentUser: false }),
      item({ id: 2, slug: 'second', commonName: '乙', observedByCurrentUser: true }),
      item({ id: 3, slug: 'third', commonName: '丙', observedByCurrentUser: false }),
    ]
    const result = filterSpeciesAtlasGroups(groups(source), { topic: 'birds', status: 'unobserved' })

    expect(result[0].items.map((species) => species.slug)).toEqual(['first', 'third'])
  })
})
