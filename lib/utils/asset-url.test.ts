import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { rewriteAssetUrl } from './asset-url'

const ENV_KEY = 'NEXT_PUBLIC_ASSETS_BASE_URL'

describe('rewriteAssetUrl', () => {
  const originalValue = process.env[ENV_KEY]

  beforeEach(() => {
    process.env[ENV_KEY] = 'https://assets.example.com'
  })

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = originalValue
    }
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
  })

  it('preserves query strings during rewrite', () => {
    expect(rewriteAssetUrl('/projects/generated/project-0010.webp?v=1')).toBe(
      'https://assets.example.com/projects/generated/project-0010.webp?v=1',
    )
  })

  it('strips trailing slashes from the base URL', () => {
    process.env[ENV_KEY] = 'https://assets.example.com/'
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
    delete process.env[ENV_KEY]
    expect(rewriteAssetUrl('/birds/images/x.jpg')).toBe('/birds/images/x.jpg')
  })

  it('passes through nullish and empty values', () => {
    expect(rewriteAssetUrl(null)).toBeNull()
    expect(rewriteAssetUrl(undefined)).toBeUndefined()
    expect(rewriteAssetUrl('')).toBe('')
    expect(rewriteAssetUrl('   ')).toBe('   ')
  })
})
