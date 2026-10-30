import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  OptimizedImage,
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

describe('project guide image presentation', () => {
  function renderedClasses(src: string) {
    const markup = renderToStaticMarkup(createElement(OptimizedImage, {
      src, alt: '项目图片', width: 640, height: 360, unoptimized: true,
      className: 'object-cover object-top transition-transform group-hover:scale-105 hover:scale-110',
    }))
    return markup.match(/class="([^"]*)"/)?.[1].split(' ') ?? []
  }

  it.each([
    '/project-guides/overviews/project-13.svg',
    '/project-guides/demos/project-307-garden-v1.png',
    '/project-guides/demos/project-13-v1.webp?v=1',
    '/project-guides/sources/project-210/image-1-v1.webp',
    '/api/assets/project-guides/sources/project-210/image-1-v1.webp?v=1',
    'https://assets.example.com/project-guides/sources/project-210/image-1-v1.webp',
    'https://steam.bj.cn/project-guides/demos/project-13-v1.webp?v=2',
    '/project-guides/rubber-band-fan-principle.svg?v=2#diagram',
    'https://steam.bj.cn/project-guides/overviews/project-13.svg?v=2',
    'http://localhost:3000/project-guides/overviews/project-13.svg#diagram',
    '/projects/corrections/20260915-project-378-kaprekar-four-digit.png',
    '/api/assets/projects/corrections/20260915-project-378-kaprekar-four-digit.png',
  ])('keeps the entire authored guide visible without hover zoom: %s', src => {
    const classes = renderedClasses(src)
    expect(classes).toEqual(expect.arrayContaining(['object-contain', 'object-center', 'group-hover:scale-100', 'hover:scale-100', 'transition-transform']))
    expect(classes).not.toEqual(expect.arrayContaining(['object-cover']))
    expect(classes).not.toEqual(expect.arrayContaining(['object-top']))
    expect(classes).not.toEqual(expect.arrayContaining(['group-hover:scale-105']))
    expect(classes).not.toEqual(expect.arrayContaining(['hover:scale-110']))
  })

  it.each([
    '/uploads/photo.jpg',
    '/assets/other-diagram.svg',
    '/project-guides/photo.png',
    'https://example.com/uploads/diagram.svg',
  ])('preserves caller crop and hover styles for other images: %s', src => {
    expect(renderedClasses(src)).toEqual(['object-cover', 'object-top', 'transition-transform', 'group-hover:scale-105', 'hover:scale-110'])
  })
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

  it('uses Supabase render transforms for cover images too', () => {
    const src =
      'https://example.supabase.co/storage/v1/object/public/project-completions/user/file.png'

    expect(getOptimizedImageSrc(src, 'cover')).toBe(
      'https://example.supabase.co/storage/v1/render/image/public/project-completions/user/file.png?width=1280&quality=72',
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

  it('bypasses Next image caching for Supabase hosts without render transforms', () => {
    expect(
      shouldUseUnoptimizedImage(
        'https://spb-l3q6k3bebzxrok83.supabase.opentrust.net/storage/v1/object/public/project-completions/user/file.webp',
      ),
    ).toBe(true)
  })

  it('bypasses Next image caching for an existing Supabase render URL', () => {
    expect(
      shouldUseUnoptimizedImage(
        'https://example.supabase.co/storage/v1/render/image/public/project-completions/user/file.webp?width=1280&quality=72',
      ),
    ).toBe(true)
  })

  it('bypasses Next image caching for other remote image URLs', () => {
    expect(shouldUseUnoptimizedImage('https://cdn.example.com/uploads/photo.webp')).toBe(true)
  })
})
