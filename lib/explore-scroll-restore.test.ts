import { beforeEach, describe, expect, it } from 'vitest'

import {
  buildExploreFiltersKey,
  clearExploreScrollRestore,
  readExploreScrollRestore,
  saveExploreScrollRestore,
} from './explore-scroll-restore'

describe('explore-scroll-restore', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('builds a stable filters key without pagination params', () => {
    const params = new URLSearchParams('q=水&category=科学&page=3&from=explore&sourceIndex=2')
    expect(buildExploreFiltersKey(params)).toBe('q=%E6%B0%B4&category=%E7%A7%91%E5%AD%A6')
  })

  it('round-trips scroll restore state', () => {
    saveExploreScrollRestore({
      filtersKey: 'category=%E7%A7%91%E5%AD%A6',
      scrollY: 1280,
      nextPage: 3,
    })

    expect(readExploreScrollRestore()).toEqual({
      filtersKey: 'category=%E7%A7%91%E5%AD%A6',
      scrollY: 1280,
      nextPage: 3,
    })

    clearExploreScrollRestore()
    expect(readExploreScrollRestore()).toBeNull()
  })
})
