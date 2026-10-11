import { afterEach, describe, expect, it } from 'vitest'

import nextConfig, { buildScratchAssetDestination } from './next.config.mjs'

const originalBaseUrl = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
const originalDisplayMode = process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  else process.env.NEXT_PUBLIC_ASSETS_BASE_URL = originalBaseUrl

  if (originalDisplayMode === undefined) delete process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE
  else process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE = originalDisplayMode
})

describe('buildScratchAssetDestination', () => {
  it('uses bundled Scratch assets when no asset host is configured', () => {
    delete process.env.NEXT_PUBLIC_ASSETS_BASE_URL
    delete process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE

    expect(buildScratchAssetDestination()).toBe('/scratch/assets/:md5ext')
  })

  it('uses the same-origin proxy by default when an asset host is configured', () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.com/'
    delete process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE

    expect(buildScratchAssetDestination()).toBe('/api/assets/scratch/assets/:md5ext')
  })

  it('only uses the CDN directly in explicit direct display mode', () => {
    process.env.NEXT_PUBLIC_ASSETS_BASE_URL = 'https://assets.example.com/'
    process.env.NEXT_PUBLIC_ASSETS_DISPLAY_MODE = 'direct'

    expect(buildScratchAssetDestination()).toBe(
      'https://assets.example.com/scratch/assets/:md5ext',
    )
  })
})

describe('canonical public redirects', () => {
  it('keeps legacy help and tree URLs on their indexable replacements', async () => {
    const redirects = await nextConfig.redirects()

    expect(redirects).toEqual(expect.arrayContaining([
      { source: '/settings/about', destination: '/about', permanent: true },
      { source: '/nature/trees', destination: '/nature/plants', permanent: true },
    ]))
  })
})

describe('sitemap routing', () => {
  it('serves only the primary /sitemap.xml without legacy sitemap aliases', async () => {
    const rewrites = await nextConfig.rewrites()
    const redirects = await nextConfig.redirects()
    const rules: Array<{ source: string; destination: string }> = [...rewrites, ...redirects]

    expect(rules.some((rule) => /sitemap/i.test(rule.source) || /sitemap/i.test(rule.destination))).toBe(false)
  })
})


describe('retired project redirects', () => {
  it('redirects the retired detail and nested paths with HTTP 301', async () => {
    expect(await nextConfig.redirects()).toEqual(expect.arrayContaining([
      { source: '/project/907', destination: '/project/1098', statusCode: 301 },
      { source: '/project/907/:path*', destination: '/project/1098/:path*', statusCode: 301 },
    ]))
  })
})
