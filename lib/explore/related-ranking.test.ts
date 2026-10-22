import { describe, expect, it } from 'vitest'
import { isTooYoungForCurrent, rankRelatedCandidates } from './related-ranking'

const current = { id: 1329, subCategoryId: 5, minAge: 12, difficultyStars: 2 }

describe('rankRelatedCandidates', () => {
  it('excludes candidates more than 3 years younger (1329 → doodle robot 7+)', () => {
    const ranked = rankRelatedCandidates(current, [
      { id: 1242, subCategoryId: 5, minAge: 7, difficultyStars: 2, popularity: 99 },
      { id: 1300, subCategoryId: 9, minAge: 10, difficultyStars: 3, popularity: 1 },
    ])
    expect(ranked.map((p) => p.id)).toEqual([1300])
  })

  it('keeps a candidate exactly 3 years younger', () => {
    expect(isTooYoungForCurrent(12, 9)).toBe(false)
    expect(isTooYoungForCurrent(12, 8)).toBe(true)
    expect(isTooYoungForCurrent(null, 3)).toBe(false)
    expect(isTooYoungForCurrent(12, null)).toBe(false)
  })

  it('orders by sub-category, age window, difficulty gap, popularity, then id', () => {
    const ranked = rankRelatedCandidates(current, [
      { id: 50, subCategoryId: 9, minAge: 12, difficultyStars: 2, popularity: 100 },
      { id: 40, subCategoryId: 5, minAge: 16, difficultyStars: 2, popularity: 100 },
      { id: 30, subCategoryId: 5, minAge: 11, difficultyStars: 4, popularity: 100 },
      { id: 20, subCategoryId: 5, minAge: 13, difficultyStars: 2, popularity: 1 },
      { id: 11, subCategoryId: 5, minAge: 13, difficultyStars: 2, popularity: 5 },
      { id: 10, subCategoryId: 5, minAge: 13, difficultyStars: 2, popularity: 5 },
    ])
    expect(ranked.map((p) => p.id)).toEqual([10, 11, 20, 30, 40, 50])
  })

  it('drops the current project and handles unknown metadata', () => {
    const ranked = rankRelatedCandidates({ id: 1 }, [{ id: 1 }, { id: 3 }, { id: 2 }])
    expect(ranked.map((p) => p.id)).toEqual([2, 3])
  })
})
