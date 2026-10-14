import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { parse, type AtRule } from 'postcss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpeciesAtlasResponse } from '@/lib/nature-species-atlas'
import { SpeciesAtlas } from './species-atlas'

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} />,
}))
vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => <img {...props} />,
}))
vi.mock('@/components/ui/mobile-page-header', () => ({ MobilePageHeader: () => null }))
vi.mock('@/lib/nature-species-scroll-restore', () => ({
  readNatureSpeciesScrollRestore: () => null,
  clearNatureSpeciesScrollRestore: vi.fn(),
  saveNatureSpeciesScrollRestore: vi.fn(),
  buildNatureSpeciesFiltersKey: (params: URLSearchParams) => params.toString(),
}))
vi.mock('@/lib/utils/asset-url', () => ({
  resolveAssetDisplayUrl: (src: string | null) => src,
  shouldBypassAssetDisplayOptimization: () => false,
}))

const data: SpeciesAtlasResponse = {
  schemaVersion: 1,
  viewer: { authenticated: true, progressState: 'ready' },
  total: 5,
  observedCount: 0,
  groups: [{
    key: 'birds', label: '鸟类', total: 5, observedCount: 0,
    items: Array.from({ length: 5 }, (_, index) => ({
      id: index + 1, slug: `bird-${index}`, commonName: `白鸟${index}`,
      scientificName: null, taxonGroup: null, aliases: [], topicKey: 'birds',
      initial: 'B', thumbnailUrl: '/assets/nature-topic-birds.webp', observedByCurrentUser: false,
    })),
  }],
}

function setViewport(width: number) {
  const resultsWidth = width - 66 // 左右留白与字母索引；不是手机屏幕宽度本身。
  vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
    matches: width >= Number(media.match(/min-width:\s*(\d+)px/)?.[1] ?? Infinity),
    media, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
  })))
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return DOMRect.fromRect({ width: this.classList.contains('nature-atlas-results-main') ? resultsWidth : 0 })
  })
  return resultsWidth
}

beforeEach(() => sessionStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('手机图鉴双列约定', () => {
  it.each([320, 360, 375, 379, 380, 390, 414, 430, 600, 767])('%dpx 的图集按双列计算占位，切回图集不重建图片', width => {
    const resultsWidth = setViewport(width)
    const { container } = render(<SpeciesAtlas initialData={data} initialTopic="birds" initialStatus="all" requestedStatus="all" />)
    const results = container.querySelector<HTMLElement>('[data-atlas-measured]')!
    const grid = container.querySelector<HTMLElement>('[data-atlas-count="5"]')!
    expect(grid.style.getPropertyValue('--atlas-rows-grid')).toBe('3') // ceil(5 / 2)，不是 ceil(5 / 3)
    expect(grid.style.getPropertyValue('--atlas-rows-list')).toBe('5')
    expect(parseFloat(results.style.getPropertyValue('--atlas-grid-media-size'))).toBeCloseTo(((resultsWidth - 10) / 2 - 2) * 0.75)
    const images = Array.from(grid.querySelectorAll('img'))
    expect(images).toHaveLength(5)
    for (const image of images) expect(image).toHaveAttribute('sizes', '(max-width: 767px) 45vw, (max-width: 1279px) 25vw, 240px')
    fireEvent.click(screen.getByRole('button', { name: '列表' }))
    fireEvent.click(screen.getByRole('button', { name: '图集' }))
    expect(container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'grid')
    expect(grid.style.getPropertyValue('--atlas-rows-grid')).toBe('3')
    Array.from(grid.querySelectorAll('img')).forEach((image, index) => expect(image).toBe(images[index]))
  })

  it.each([768, 1024, 1280, 1840])('%dpx 保持桌面自适应列数与行高', width => {
    const resultsWidth = setViewport(width)
    const { container } = render(<SpeciesAtlas initialData={data} initialTopic="birds" initialStatus="all" requestedStatus="all" />)
    const columns = Math.max(1, Math.floor((resultsWidth + 14) / ((width >= 1280 ? 190 : 170) + 14)))
    const listColumns = Math.max(1, Math.floor((resultsWidth + 14) / ((width >= 1280 ? 340 : 300) + 14)))
    const grid = container.querySelector<HTMLElement>('[data-atlas-count="5"]')!
    expect(grid.style.getPropertyValue('--atlas-rows-grid')).toBe(String(Math.ceil(5 / columns)))
    expect(grid.style.getPropertyValue('--atlas-rows-list')).toBe(String(Math.ceil(5 / listColumns)))
  })

  it('CSS 的图集列数只在桌面断点改变，不能重新引入手机三列覆盖', () => {
    const css = parse(readFileSync(path.join(process.cwd(), 'app/nature/species/species-atlas.module.css'), 'utf8'))
    const definitions: Array<{ value: string; breakpoint: string | null }> = []
    css.walkRules('.atlas :global(.nature-atlas-grid)', rule => {
      const breakpoint = rule.parent?.type === 'atrule' ? (rule.parent as AtRule).params : null
      rule.walkDecls('grid-template-columns', decl => { definitions.push({ value: decl.value, breakpoint }) })
    })
    expect(definitions).toEqual([
      { value: 'repeat(2, minmax(0, 1fr))', breakpoint: null },
      { value: 'repeat(auto-fill, minmax(170px, 1fr))', breakpoint: '(min-width: 768px)' },
      { value: 'repeat(auto-fill, minmax(190px, 1fr))', breakpoint: '(min-width: 1280px)' },
    ])
  })
})
