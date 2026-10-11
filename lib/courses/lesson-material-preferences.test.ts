import { describe, expect, it } from 'vitest'
import { getDefaultKitCounts, hasKitComparison, kitCountsToSelections } from './course-kit-config'
import {
  kitCountsStorageKey,
  readStoredKitCounts,
  sanitizeKitCounts,
  writeStoredKitCounts,
} from './lesson-material-preferences'

function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  }
}

describe('kit defaults', () => {
  it('follows course level', () => {
    expect(getDefaultKitCounts(5)).toEqual({ '9090-2': 1, '9076-1': 1, '45002-1': 0, '9656-1': 0 })
    expect(getDefaultKitCounts(6)).toEqual({ '9090-2': 1, '9076-1': 1, '45002-1': 1, '9656-1': 0 })
    expect(getDefaultKitCounts(7)).toEqual({ '9090-2': 1, '9076-1': 1, '45002-1': 0, '9656-1': 1 })
    expect(getDefaultKitCounts(8)).toEqual({ '9090-2': 0, '9076-1': 0, '45002-1': 0, '9656-1': 0 })
    expect(hasKitComparison(5) && hasKitComparison(6) && hasKitComparison(7)).toBe(true)
    expect(hasKitComparison(8)).toBe(false)
  })

  it('drops zero-copy kits from selections', () => {
    expect(kitCountsToSelections({ '9090-2': 2, '9076-1': 0, '45002-1': 1, '9656-1': 0 })).toEqual([
      { setNum: '9090-2', copies: 2 },
      { setNum: '45002-1', copies: 1 },
    ])
  })
})

describe('local storage', () => {
  it('reads defaults when empty or corrupt and clamps values', () => {
    expect(readStoredKitCounts(memoryStorage(), 5)).toEqual(getDefaultKitCounts(5))
    expect(readStoredKitCounts(memoryStorage({ [kitCountsStorageKey(5)]: '{bad' }), 5)).toEqual(getDefaultKitCounts(5))
    expect(readStoredKitCounts(null, 6)).toEqual(getDefaultKitCounts(6))
    expect(sanitizeKitCounts({ '9090-2': -3, '9076-1': 99, '45002-1': 1.6, '9656-1': 'x' }, getDefaultKitCounts(7))).toEqual({
      '9090-2': 0,
      '9076-1': 20,
      '45002-1': 2,
      '9656-1': 1,
    })
  })

  it('round-trips per course, including all-zero', () => {
    const storage = memoryStorage()
    const zero = { '9090-2': 0, '9076-1': 0, '45002-1': 0, '9656-1': 0 }
    writeStoredKitCounts(storage, 5, zero)
    expect(readStoredKitCounts(storage, 5)).toEqual(zero)
    expect(readStoredKitCounts(storage, 6)).toEqual(getDefaultKitCounts(6))
  })
})
