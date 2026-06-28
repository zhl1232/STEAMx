import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertValidLdrawMpd,
  buildEmbeddedLookup,
  countEmbeddedLdrawFiles,
  patchParseCacheForEmbedded,
  splitPackedMpd,
} from './ldraw-mpd'

describe('assertValidLdrawMpd', () => {
  it('rejects CDN 403 HTML', () => {
    expect(() => assertValidLdrawMpd('<!DOCTYPE html><html>403</html>')).toThrow(/HTML/)
  })

  it('accepts valid ldraw header', () => {
    expect(() => assertValidLdrawMpd('0 FILE model.ldr\n1 16 0 0 0')).not.toThrow()
  })
})

describe('buildEmbeddedLookup', () => {
  it('indexes basename and parts/ prefix aliases', () => {
    const embedded = new Map([['3001.dat', 'part text']])
    const lookup = buildEmbeddedLookup(embedded)
    expect(lookup.get('3001.dat')).toBe('part text')
    expect(lookup.get('parts/3001.dat')).toBe('part text')
  })
})

describe('patchParseCacheForEmbedded', () => {
  it('returns embedded text without calling original fetchData', async () => {
    const embedded = new Map([['parts/s/3001s01.dat', 'subpart']])
    const parseCache = {
      setData: () => {},
      fetchData: async () => {
        throw new Error('network')
      },
    }
    patchParseCacheForEmbedded(parseCache, embedded)
    await expect(parseCache.fetchData('3001s01.dat')).resolves.toBe('subpart')
    await expect(parseCache.fetchData('parts/s/3001s01.dat')).resolves.toBe('subpart')
  })

  it('throws when part is missing from embedded map', async () => {
    const parseCache = {
      setData: () => {},
      fetchData: async () => {
        throw new Error('network')
      },
    }
    patchParseCacheForEmbedded(parseCache, new Map())
    await expect(parseCache.fetchData('9999.dat')).rejects.toThrow(/缺少内联零件/)
  })
})

describe('countEmbeddedLdrawFiles', () => {
  it('counts 0 FILE blocks in packed mpd', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/eiffel-tower.mpd'), 'utf8')
    expect(countEmbeddedLdrawFiles(text)).toBeGreaterThan(20)
  })
})

describe('splitPackedMpd', () => {
  it('splits eiffel-tower.mpd into main model and embedded parts', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/eiffel-tower.mpd'), 'utf8')
    const { mainName, mainText, embedded } = splitPackedMpd(text)

    expect(mainName).toBe('eiffel-tower.ldr')
    expect(mainText).toContain('0 STEP')
    expect(mainText).not.toMatch(/^0 FILE /m)
    expect(embedded.size).toBeGreaterThan(20)
    expect(embedded.has('3001.dat')).toBe(true)
    expect(embedded.has('parts/s/3811s01.dat')).toBe(true)
  })
})
