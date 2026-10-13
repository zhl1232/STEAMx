import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpeciesAtlasItem, SpeciesAtlasResponse } from '@/lib/nature-species-atlas'
import { SpeciesAtlas } from './species-atlas'
import { SpeciesAtlasTile } from './species-atlas-tile'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), save: vi.fn(), read: vi.fn(), clear: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} href={href}>{children}</a>,
}))
vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => <img {...props} />,
}))
vi.mock('@/components/ui/mobile-page-header', () => ({ MobilePageHeader: () => <div>自然观察</div> }))
vi.mock('@/lib/nature-species-scroll-restore', () => ({
  saveNatureSpeciesScrollRestore: mocks.save,
  readNatureSpeciesScrollRestore: mocks.read,
  clearNatureSpeciesScrollRestore: mocks.clear,
  buildNatureSpeciesFiltersKey: (params: URLSearchParams) => params.toString(),
}))
vi.mock('@/lib/utils/asset-url', () => ({
  resolveAssetDisplayUrl: (src: string | null) => src,
  shouldBypassAssetDisplayOptimization: () => false,
}))

function bird(id: number, initial = 'B'): SpeciesAtlasItem {
  return {
    id, slug: `bird-${id}`, commonName: `鸟类 ${id}`, scientificName: `Species ${id}`,
    taxonGroup: '测试分类', aliases: [`别名${id}`], topicKey: 'birds', initial,
    thumbnailUrl: '/assets/nature-topic-birds.webp', observedByCurrentUser: id === 2,
  }
}
function atlas(state: SpeciesAtlasResponse['viewer']['progressState'] = 'ready'): SpeciesAtlasResponse {
  const birds = [bird(1, 'A'), bird(2), bird(3), bird(4)].map(item => ({ ...item, observedByCurrentUser: state === 'ready' ? item.observedByCurrentUser : null }))
  return {
    schemaVersion: 1, viewer: { authenticated: state !== 'anonymous', progressState: state },
    total: 4, observedCount: state === 'ready' ? 1 : null,
    groups: [
      { key: 'birds', label: '鸟类', total: 4, observedCount: state === 'ready' ? 1 : null, items: birds },
      { key: 'insects', label: '昆虫', total: 0, observedCount: state === 'ready' ? 0 : null, items: [] },
      { key: 'plants', label: '植物', total: 0, observedCount: state === 'ready' ? 0 : null, items: [] },
    ],
  }
}
function renderAtlas(data = atlas()) {
  return render(<SpeciesAtlas initialData={data} initialTopic="birds" initialStatus="all" requestedStatus="all" canonicalTopicPath="/nature/birds" heading="鸟类图鉴与观察" introduction="原有专题介绍" />)
}

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.read.mockReturnValue(null) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('物种图鉴的内容与筛选', () => {
  it('保留单一 H1、真实总数、物种详情与字母锚点', () => {
    const { container } = renderAtlas()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('鸟类图鉴与观察')
    expect(screen.getByRole('link', { name: '查看公开观察记录' })).toHaveAttribute('href', '/nature/observations')
    expect(container.querySelector('[data-topic="birds"]')).toHaveTextContent('4')
    expect(container.querySelector('[data-topic="insects"]')).toHaveTextContent('0')
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent('4 种')
    expect(container.querySelector('#species-letter-birds-a ul')).toHaveAttribute('data-singleton', 'true')
    expect(screen.getByRole('link', { name: '跳转到A开头物种' })).toHaveAttribute('href', '#species-letter-birds-a')
    expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(4)
    expect(container.querySelector('[data-species-slug="bird-2"]')).toHaveAttribute('href', '/nature/species/bird-2')
  })

  it('搜索仍支持别名，状态筛选和 URL 同步不变', () => {
    const { container } = renderAtlas()
    fireEvent.change(screen.getByLabelText('搜索物种'), { target: { value: '别名2' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索' }))
    expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(1)
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/birds?q=%E5%88%AB%E5%90%8D2', { scroll: false })
    const toolbar = within(screen.getByRole('region', { name: '物种筛选' }))
    fireEvent.click(toolbar.getByRole('button', { name: /^已观察/ }))
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/birds?q=%E5%88%AB%E5%90%8D2&status=observed', { scroll: false })
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/birds?status=observed', { scroll: false })
  })

  it('空结果有清除入口，切换专题时保留原路由规则', () => {
    const { container } = renderAtlas()
    fireEvent.change(screen.getByLabelText('搜索物种'), { target: { value: '不存在的物种' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索' }))
    expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(0)
    expect(screen.getByText('没有找到匹配的物种')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/species', { scroll: false })
    fireEvent.click(screen.getByRole('button', { name: '昆虫' }))
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/insects', { scroll: false })
  })

  it.each(['anonymous', 'unavailable'] as const)('%s 状态不伪造待观察数或状态角标', state => {
    const { container } = renderAtlas(atlas(state))
    expect(screen.getByRole('button', { name: '已观察' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '待观察' })).toBeDisabled()
    const cards = Array.from(container.querySelectorAll('[data-species-slug]'))
    expect(cards.every(card => card.getAttribute('aria-label')?.includes('观察状态未知'))).toBe(true)
    if (state === 'anonymous') expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login?next=%2Fnature%2Fbirds')
    else expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('图集／列表有实际切换，返回后恢复选择，存储失败也可切换', () => {
    const first = renderAtlas()
    fireEvent.click(screen.getByRole('button', { name: '列表' }))
    expect(first.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'list')
    expect(sessionStorage.getItem('nature-atlas-layout-v1')).toBe('list')
    expect(screen.getByRole('button', { name: '列表' })).toHaveAttribute('aria-pressed', 'true')
    expect(mocks.replace).not.toHaveBeenCalled()
    first.unmount()
    const second = renderAtlas()
    expect(second.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'list')
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
    fireEvent.click(screen.getByRole('button', { name: '图集' }))
    expect(second.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'grid')
    storage.mockRestore()
  })
})

describe('物种卡片', () => {
  it.each([true, false, null])('状态 %s 不改变照片颜色，并展示真实学名与分类', observed => {
    const { container } = render(<SpeciesAtlasTile item={{ ...bird(1), observedByCurrentUser: observed }} filtersKey="topic=birds" />)
    const image = container.querySelector('img')!
    for (const className of ['grayscale', 'saturate-25', 'opacity-75', 'opacity-0']) expect(image).not.toHaveClass(className)
    expect(screen.getByText('Species 1')).toBeInTheDocument()
    expect(screen.getByText('测试分类')).toBeInTheDocument()
    const status = observed === null ? '观察状态未知' : observed ? '已观察' : '待观察'
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', `鸟类 1，鸟类，${status}`)
    const visualMedia = container.querySelector('[aria-hidden="true"]')!
    expect(visualMedia.textContent).toBe(observed === null ? '' : status)
  })

  it('图片失败时显示明确占位，并能在更换图片后恢复', () => {
    const item = bird(1)
    const { container, rerender } = render(<SpeciesAtlasTile item={item} filtersKey="" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    rerender(<SpeciesAtlasTile item={{ ...item, thumbnailUrl: '/replacement.webp' }} filtersKey="" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/replacement.webp')
    expect(screen.queryByText('暂无图片')).not.toBeInTheDocument()
  })

  it('缺失学名和分类时不编造内容，键盘触发点击也记录返回位置', () => {
    const { container } = render(<SpeciesAtlasTile item={{ ...bird(1), scientificName: null, taxonGroup: null, thumbnailUrl: null }} filtersKey="topic=birds" />)
    expect(container.querySelector('i')).toBeNull()
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link'))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ filtersKey: 'topic=birds', anchorSlug: 'bird-1' }))
  })
})
