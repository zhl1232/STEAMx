import { afterEach, describe, expect, it } from 'vitest'
import {
  getOptimizedImageSrc,
  shouldUseUnoptimizedImage,
  withGeneratedProjectImageCacheVersion,
} from './optimized-image'

const ASSETS_BASE_ENV_KEY = 'NEXT_PUBLIC_ASSETS_BASE_URL'
const originalAssetsBaseUrl = process.env[ASSETS_BASE_ENV_KEY]

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

afterEach(() => {
  restoreEnv(ASSETS_BASE_ENV_KEY, originalAssetsBaseUrl)
})

describe('getOptimizedImageSrc', () => {
  it('keeps opentrust storage URLs on the original object endpoint', () => {
    const src =
      'https://spb-l3q6k3bebzxrok83.supabase.opentrust.net/storage/v1/object/public/project-completions/a1111111-0000-0000-0000-000000000000/1775618536559-cfh4a9j.png'

    expect(getOptimizedImageSrc(src, 'grid')).toBe(src)
  })

  it('uses Supabase render transforms on supabase.co public storage URLs', () => {
    const src =
      'https://example.supabase.co/storage/v1/object/public/project-completions/user/file.png'

    expect(getOptimizedImageSrc(src, 'grid')).toBe(
      'https://example.supabase.co/storage/v1/render/image/public/project-completions/user/file.png?width=320&quality=60',
    )
  })

  it('adds a cache version for local generated project images', () => {
    delete process.env[ASSETS_BASE_ENV_KEY]

    expect(getOptimizedImageSrc('/projects/generated/project-0142.webp', 'card')).toBe(
      '/projects/generated/project-0142.webp?v=20260522-tech-images',
    )
  })

  it('rewrites generated project images when an assets base URL is configured', () => {
    process.env[ASSETS_BASE_ENV_KEY] = 'https://assets.example.com'

    expect(getOptimizedImageSrc('/projects/generated/project-0142.webp', 'card')).toBe(
      'https://assets.example.com/projects/generated/project-0142.webp?v=20260522-tech-images',
    )
  })

  it('rewrites legacy root project cover images when an assets base URL is configured', () => {
    process.env[ASSETS_BASE_ENV_KEY] = 'https://assets.example.com'

    expect(getOptimizedImageSrc('/projects/tech_3dprint.webp', 'card')).toBe(
      'https://assets.example.com/projects/tech_3dprint.webp',
    )
  })

  it('preserves explicit generated project image cache versions', () => {
    expect(withGeneratedProjectImageCacheVersion('/projects/generated/project-0142.webp?v=manual')).toBe(
      '/projects/generated/project-0142.webp?v=manual',
    )
  })
})

describe('shouldUseUnoptimizedImage', () => {
  it('bypasses Sharp for pre-compressed static assets and their proxy URLs', () => {
    expect(shouldUseUnoptimizedImage('/projects/generated/project-0142.webp')).toBe(true)
    expect(shouldUseUnoptimizedImage('/api/assets/projects/generated/project-0142.webp')).toBe(true)
    expect(shouldUseUnoptimizedImage('/assets/local-hero.png')).toBe(false)
  })

  it('bypasses Sharp when Supabase already rendered the requested size', () => {
    expect(shouldUseUnoptimizedImage('https://example.supabase.co/render.png', true)).toBe(true)
  })
})
