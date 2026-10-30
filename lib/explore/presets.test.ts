import { describe, expect, it } from 'vitest'
import { EXPLORE_PRESETS, EXPLORE_TOPICS, normalizeExploreThemeTags, buildPresetSearchParams, detectActivePreset, parseExploreSortBy, serializeExploreFilterParams, toggleExploreTopicTag } from './presets'

describe('content browsing after retiring supplier groupings', () => {
  it('offers household materials independently of the kit directory', () => {
    expect(EXPLORE_PRESETS.map(p => p.id)).toEqual(['browse', 'everyday-materials', 'life-health', 'ecology', 'earth', 'aerospace', 'emerging-industry', 'artificial-intelligence'])
    expect(EXPLORE_TOPICS.map(p => p.label)).toEqual(['日常材料', '生命健康', '生态环境', '地球奥秘', '航空航天', '新兴产业', '人工智能'])
    expect(buildPresetSearchParams(EXPLORE_TOPICS[0]).get('tags')).toBe('日常材料')
  })
  it('drops retired source filters while preserving household materials', () => {
    expect(normalizeExploreThemeTags('趣味实验,日常材料,科教版,日常材料,初中')).toEqual(['日常材料'])
    expect(normalizeExploreThemeTags('科教版,趣味实验')).toEqual([])
    const original = new URLSearchParams({ tags: '科教版', category: '科学', q: '电池', age: '8', sortBy: 'latest' })
    const normalized = new URLSearchParams(serializeExploreFilterParams(original))
    expect(normalized.has('tags')).toBe(false)
    expect(normalized.get('category')).toBe('科学')
    expect(normalized.get('q')).toBe('电池')
    expect(normalized.get('age')).toBe('8')
    expect(original.get('tags')).toBe('科教版')
  })
  it('retains material toggles and independent ordering', () => {
    expect(toggleExploreTopicTag(['日常材料'], '日常材料')).toEqual([])
    expect(parseExploreSortBy('latest')).toBe('latest')
    expect(parseExploreSortBy('unknown')).toBe('popular')
    expect(detectActivePreset({ category: '全部', subCategory: '', difficulty: 'all', age: null, tags: ['日常材料'], searchQuery: '', sortBy: 'popular' })).toBe('everyday-materials')
  })
})

it('preserves supported themes in shared URLs and toggles only the chosen theme', () => {
  expect(normalizeExploreThemeTags('航空航天,日常材料,人工智能,航空航天,科教版')).toEqual(['航空航天', '日常材料', '人工智能'])
  expect(toggleExploreTopicTag(['日常材料'], '航空航天')).toEqual(['日常材料', '航空航天'])
  expect(toggleExploreTopicTag(['日常材料', '航空航天'], '航空航天')).toEqual(['日常材料'])
  const params = new URLSearchParams(serializeExploreFilterParams(new URLSearchParams({ tags: '航空航天,日常材料', sortBy: 'latest', age: '8' })))
  expect(params.get('tags')).toBe('航空航天,日常材料')
  expect(params.get('sortBy')).toBe('latest')
  expect(params.get('age')).toBe('8')
})
