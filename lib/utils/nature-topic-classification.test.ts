import { describe, expect, it } from 'vitest'

import {
  buildSpeciesTopicCounts,
  getNatureTopicLabel,
  normalizeSpeciesTopicFilter,
  resolveSpeciesNatureTopicKey,
} from './nature-topic-classification'

describe('nature topic classification', () => {
  it('classifies common species topics from names and taxon groups', () => {
    expect(resolveSpeciesNatureTopicKey({ common_name: '大山雀', taxon_group: '山雀科 山雀属' })).toBe('birds')
    expect(resolveSpeciesNatureTopicKey({ common_name: '七星瓢虫', taxon_group: '瓢虫科' })).toBe('insects')
    expect(resolveSpeciesNatureTopicKey({ common_name: '荷花', taxon_group: '莲科 莲属' })).toBe('plants')
    expect(resolveSpeciesNatureTopicKey({ common_name: '木耳', taxon_group: '木耳科' })).toBe('fungi')
    expect(resolveSpeciesNatureTopicKey({ common_name: '未知生物', taxon_group: '未定类群' })).toBeNull()
  })

  it('normalizes filters and labels invalid topics safely', () => {
    expect(normalizeSpeciesTopicFilter('birds')).toBe('birds')
    expect(normalizeSpeciesTopicFilter('bad-topic')).toBe('all')
    expect(normalizeSpeciesTopicFilter(null)).toBe('all')
    expect(getNatureTopicLabel('plants')).toBe('植物')
    expect(getNatureTopicLabel(null)).toBe('未分类')
  })

  it('builds counts for all visible topic filters', () => {
    expect(
      buildSpeciesTopicCounts([
        { topicKey: 'birds' },
        { topicKey: 'birds' },
        { topicKey: 'plants' },
        { topicKey: null },
      ]),
    ).toEqual([
      { key: 'all', label: '全部', count: 4 },
      { key: 'birds', label: '鸟类', count: 2 },
      { key: 'insects', label: '昆虫', count: 0 },
      { key: 'plants', label: '植物', count: 1 },
      { key: 'fungi', label: '真菌', count: 0 },
    ])
  })
})
