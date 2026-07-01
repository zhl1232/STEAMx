// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { countEmbeddedLdrawFiles, loadPackedLdrawModel } from './ldraw-mpd'

describe('loadPackedLdrawModel integration', () => {
  it('loads 3-bao-jian.mpd without external part fetches', async () => {
    const mpdText = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/3-bao-jian.mpd'), 'utf8')
    const ldConfig = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/LDConfig.ldr'), 'utf8')
    const fetches: string[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      fetches.push(url)
      if (url.includes('3-bao-jian.mpd')) {
        return new Response(mpdText, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      if (url.includes('LDConfig.ldr')) {
        return new Response(ldConfig, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    try {
      const { LDrawLoader } = await import('three/examples/jsm/loaders/LDrawLoader.js')
      const { LDrawConditionalLineMaterial } = await import(
        'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
      )

      const loader = new LDrawLoader()
      loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)

      const group = await loadPackedLdrawModel(
        loader,
        'http://test.local/api/assets/courses/ldraw/3-bao-jian.mpd',
        'http://test.local/api/assets/courses/ldraw/LDConfig.ldr',
      )
      expect(group.userData.numBuildingSteps).toBeGreaterThan(0)

      const bad = fetches.filter((u) => /\.dat(\?|$|")/i.test(u) && !u.includes('LDConfig.ldr'))
      expect(bad).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 30_000)

  it('loads eiffel-tower.mpd with full embedded parts', async () => {
    const mpdText = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/eiffel-tower.mpd'), 'utf8')
    const ldConfig = readFileSync(resolve(process.cwd(), 'public/courses/ldraw/LDConfig.ldr'), 'utf8')
    expect(countEmbeddedLdrawFiles(mpdText)).toBeGreaterThan(20)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('eiffel-tower.mpd')) {
        return new Response(mpdText, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      if (url.includes('LDConfig.ldr')) {
        return new Response(ldConfig, { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    try {
      const { LDrawLoader } = await import('three/examples/jsm/loaders/LDrawLoader.js')
      const { LDrawConditionalLineMaterial } = await import(
        'three/examples/jsm/materials/LDrawConditionalLineMaterial.js'
      )

      const loader = new LDrawLoader()
      loader.setConditionalLineMaterial(LDrawConditionalLineMaterial)

      const group = await loadPackedLdrawModel(
        loader,
        'http://test.local/api/assets/courses/ldraw/eiffel-tower.mpd',
        'http://test.local/api/assets/courses/ldraw/LDConfig.ldr',
      )
      expect(group.userData.numBuildingSteps).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  }, 180_000)
})
