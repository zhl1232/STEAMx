import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertValidLdrawMpd,
  buildEmbeddedLookup,
  countEmbeddedLdrawFiles,
  createPackedLdrawStep,
  createPackedLdrawStepMpd,
  getPackedLdrawStepCount,
  patchParseCacheForEmbedded,
  splitPackedMpd,
} from './ldraw-mpd'

type ParseCache = {
  setData: (fileName: string, text: string) => void
  fetchData: (fileName: string) => Promise<string>
}

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
    const parseCache: ParseCache = {
      setData: () => {},
      fetchData: async (_fileName: string) => {
        throw new Error('network')
      },
    }
    patchParseCacheForEmbedded(parseCache, embedded)
    await expect(parseCache.fetchData('3001s01.dat')).resolves.toBe('subpart')
    await expect(parseCache.fetchData('parts/s/3001s01.dat')).resolves.toBe('subpart')
  })

  it('throws when part is missing from embedded map', async () => {
    const parseCache: ParseCache = {
      setData: () => {},
      fetchData: async (_fileName: string) => {
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

describe('createPackedLdrawStepMpd', () => {
  const packed = [
    '0 FILE model.ldr',
    '0 Name: model.ldr',
    '0 BFC CERTIFY CCW',
    '1 16 0 0 0 1 0 0 0 1 0 0 0 1 first.dat',
    '0 STEP',
    '1 4 20 0 0 1 0 0 0 1 0 0 0 1 second.dat',
    '0 FILE first.dat',
    '1 16 0 0 0 1 0 0 0 1 0 0 0 1 shared.dat',
    '0 FILE second.dat',
    '2 24 0 0 0 10 0 0',
    '0 FILE shared.dat',
    '2 24 0 0 0 0 10 0',
  ].join('\n')

  it('returns only the selected step and recursive dependencies', () => {
    const firstStep = createPackedLdrawStepMpd(packed, 0)
    expect(firstStep).toContain('first.dat')
    expect(firstStep).toContain('shared.dat')
    expect(firstStep).not.toContain('second.dat')

    const secondStep = createPackedLdrawStepMpd(packed, 1)
    expect(secondStep).toContain('second.dat')
    expect(secondStep).not.toContain('first.dat')
    expect(secondStep).not.toContain('shared.dat')
    expect(secondStep).toContain('0 BFC CERTIFY CCW')
  })

  it('reports step count and rejects out-of-range requests', () => {
    expect(getPackedLdrawStepCount(packed)).toBe(2)
    expect(createPackedLdrawStep(packed, 0).stepCount).toBe(2)
    expect(() => createPackedLdrawStepMpd(packed, 2)).toThrow(RangeError)
    expect(() => createPackedLdrawStepMpd(packed, -1)).toThrow(RangeError)
  })
})
