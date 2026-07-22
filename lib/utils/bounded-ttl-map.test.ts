import { describe, expect, it } from 'vitest'

import { BoundedTtlMap } from './bounded-ttl-map'

describe('BoundedTtlMap', () => {
  it('removes expired entries during reads and writes', () => {
    const cache = new BoundedTtlMap<string, string>(3, 10)
    cache.set('expired', 'old', 10, 0)

    expect(cache.get('expired', 10)).toBeUndefined()
    expect(cache.size).toBe(0)

    cache.set('stale', 'old', 20, 10)
    cache.set('fresh', 'new', 40, 20)

    expect(cache.size).toBe(1)
    expect(cache.get('fresh', 20)).toBe('new')
  })

  it('evicts the least recently used entry at the capacity limit', () => {
    const cache = new BoundedTtlMap<string, string>(2)
    cache.set('first', '1', 100, 0)
    cache.set('second', '2', 100, 0)
    expect(cache.get('first', 1)).toBe('1')

    cache.set('third', '3', 100, 1)

    expect(cache.get('second', 1)).toBeUndefined()
    expect(cache.get('first', 1)).toBe('1')
    expect(cache.get('third', 1)).toBe('3')
    expect(cache.size).toBe(2)
  })

  it('rejects invalid capacity values', () => {
    expect(() => new BoundedTtlMap(0)).toThrow(RangeError)
    expect(() => new BoundedTtlMap(1, -1)).toThrow(RangeError)
  })
})
