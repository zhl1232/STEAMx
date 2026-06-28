import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAssetDisplayUrl,
  isConfiguredAssetUrl,
  resolveAssetDisplayUrl,
  rewriteAssetUrl,
  shouldBypassAssetDisplayOptimization,
  shouldBypassAssetImageOptimization,
} from './asset-url'

const ENV_KEY = 'NEXT_PUBLIC_ASSETS_BASE_URL'
const NODE_ENV_KEY = 'NODE_ENV'
const DISPLAY_MODE_ENV_KEY = 'NEXT_PUBLIC_ASSETS_DISPLAY_MODE'

describe('rewriteAssetUrl', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_KEY, 'https://assets.example.com')
    vi.stubEnv(NODE_ENV_KEY, 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rewrites whitelisted prefixes to the configured base URL', () => {
    expect(rewriteAssetUrl('/birds/images/alcedo-atthis.jpg')).toBe(
      'https://assets.example.com/birds/images/alcedo-atthis.jpg',
    )
    expect(rewriteAssetUrl('/birds/audio/alcedo-atthis.ogg')).toBe(
      'https://assets.example.com/birds/audio/alcedo-atthis.ogg',
    )
    expect(rewriteAssetUrl('/projects/generated/project-0010.webp')).toBe(
      'https://assets.example.com/projects/generated/project-0010.webp',
    )
    expect(rewriteAssetUrl('/projects/tech_3dprint.webp')).toBe(
      'https://assets.example.com/projects/tech_3dprint.webp',
    )
    expect(rewriteAssetUrl('/fruits/images/morus-alba-1.jpg')).toBe(
      'https://assets.example.com/fruits/images/morus-alba-1.jpg',
    )
    expect(rewriteAssetUrl('/courses/3-bao-jian/slides/slide-01.png')).toBe(
      'https://assets.example.com/courses/3-bao-jian/slides/slide-01.png',
    )
  })

  it('preserves query strings during rewrite', () => {
    expect(rewriteAssetUrl('/projects/generated/project-0010.webp?v=1')).toBe(
      'https://assets.example.com/projects/generated/project-0010.webp?v=1',
    )
  })

  it('strips trailing slashes from the base URL', () => {
    vi.stubEnv(ENV_KEY, 'https://assets.example.com/')
    expect(rewriteAssetUrl('/birds/images/x.jpg')).toBe(
      'https://assets.example.com/birds/images/x.jpg',
    )
  })

  it('leaves remote URLs untouched', () => {
    const remote = 'https://supabase.co/storage/v1/object/public/x.png'
    expect(rewriteAssetUrl(remote)).toBe(remote)
  })

  it('leaves non-whitelisted local paths untouched', () => {
    expect(rewriteAssetUrl('/assets/community-hero-kids-robot.png')).toBe(
      '/assets/community-hero-kids-robot.png',
    )
    expect(rewriteAssetUrl('/scratch/assets/abc.svg')).toBe('/scratch/assets/abc.svg')
  })

  it('returns input unchanged when base URL is not configured', () => {
    vi.stubEnv(ENV_KEY, undefined)
    expect(rewriteAssetUrl('/birds/images/x.jpg')).toBe('/birds/images/x.jpg')
  })

  it('passes through nullish and empty values', () => {
    expect(rewriteAssetUrl(null)).toBeNull()
    expect(rewriteAssetUrl(undefined)).toBeUndefined()
    expect(rewriteAssetUrl('')).toBe('')
    expect(rewriteAssetUrl('   ')).toBe('   ')
  })

  it('recognizes configured static asset URLs only for whitelisted paths', () => {
    expect(isConfiguredAssetUrl('https://assets.example.com/birds/images/x.jpg')).toBe(true)
    expect(shouldBypassAssetImageOptimization('https://assets.example.com/birds/images/x.jpg')).toBe(true)
    expect(isConfiguredAssetUrl('https://assets.example.com/fruits/images/x.jpg')).toBe(true)
    expect(isConfiguredAssetUrl('https://assets.example.com/assets/hero.png')).toBe(false)
    expect(isConfiguredAssetUrl('https://cdn.example.com/birds/images/x.jpg')).toBe(false)
  })

  it('uses the local asset proxy for configured assets outside production by default', () => {
    vi.stubEnv(NODE_ENV_KEY, 'development')

    expect(getAssetDisplayUrl('https://assets.example.com/birds/images/x.jpg')).toBe(
      '/api/assets/birds/images/x.jpg',
    )
    expect(getAssetDisplayUrl('https://assets.example.com/birds/images/x.jpg?v=1')).toBe(
      '/api/assets/birds/images/x.jpg?v=1',
    )
  })

  it('can keep configured asset URLs direct outside production for raw CDN debugging', () => {
    vi.stubEnv(NODE_ENV_KEY, 'development')
    vi.stubEnv(DISPLAY_MODE_ENV_KEY, 'direct')

    expect(getAssetDisplayUrl('https://assets.example.com/birds/images/x.jpg')).toBe(
      'https://assets.example.com/birds/images/x.jpg',
    )
  })

  it('keeps configured asset URLs direct in production', () => {
    vi.stubEnv(NODE_ENV_KEY, 'production')
    vi.stubEnv(DISPLAY_MODE_ENV_KEY, 'direct')

    expect(getAssetDisplayUrl('https://assets.example.com/birds/images/x.jpg')).toBe(
      'https://assets.example.com/birds/images/x.jpg',
    )
  })
})

describe('resolveAssetDisplayUrl', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_KEY, 'https://assets.example.com')
    vi.stubEnv(NODE_ENV_KEY, 'development')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('rewrites courseware assets and proxies them in development', () => {
    expect(resolveAssetDisplayUrl('/courses/3-bao-jian/slides/slide-01.png')).toBe(
      '/api/assets/courses/3-bao-jian/slides/slide-01.png',
    )
    expect(resolveAssetDisplayUrl('https://assets.example.com/courses/3-bao-jian/animation.mp4')).toBe(
      '/api/assets/courses/3-bao-jian/animation.mp4',
    )
  })

  it('rewrites relative bird assets and proxies them in development', () => {
    expect(resolveAssetDisplayUrl('/birds/audio/lanius-cristatus.ogg')).toBe(
      '/api/assets/birds/audio/lanius-cristatus.ogg',
    )
    expect(resolveAssetDisplayUrl('/birds/images/lanius-cristatus.jpg')).toBe(
      '/api/assets/birds/images/lanius-cristatus.jpg',
    )
  })

  it('keeps direct CDN URLs in production', () => {
    vi.stubEnv(NODE_ENV_KEY, 'production')

    expect(resolveAssetDisplayUrl('/birds/audio/lanius-cristatus.ogg')).toBe(
      'https://assets.example.com/birds/audio/lanius-cristatus.ogg',
    )
  })

  it('always proxies LDraw library files in production (CDN Referer hotlink)', () => {
    vi.stubEnv(NODE_ENV_KEY, 'production')

    expect(resolveAssetDisplayUrl('/courses/ldraw/eiffel-tower.mpd')).toBe(
      '/api/assets/courses/ldraw/eiffel-tower.mpd',
    )
    expect(resolveAssetDisplayUrl('https://assets.example.com/courses/ldraw/LDConfig.ldr')).toBe(
      '/api/assets/courses/ldraw/LDConfig.ldr',
    )
  })
})

describe('shouldBypassAssetDisplayOptimization', () => {
  beforeEach(() => {
    vi.stubEnv(ENV_KEY, 'https://assets.example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('treats relative bird image paths as static assets', () => {
    expect(shouldBypassAssetDisplayOptimization('/birds/images/lanius-cristatus.jpg')).toBe(true)
    expect(shouldBypassAssetDisplayOptimization('/assets/local.png')).toBe(false)
  })
})
