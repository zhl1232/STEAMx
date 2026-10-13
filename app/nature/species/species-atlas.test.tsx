import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, within, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpeciesAtlasItem, SpeciesAtlasResponse } from '@/lib/nature-species-atlas'
import { SpeciesAtlas } from './species-atlas'
import { SpeciesAtlasTile } from './species-atlas-tile'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), save: vi.fn(), read: vi.fn(), clear: vi.fn(), image: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...props }: ComponentProps<'a'> & { prefetch?: boolean }) => <a {...props} href={href}>{children}</a>,
}))
vi.mock('next/image', () => ({
  default: ({ fill: _fill, priority: _priority, unoptimized: _unoptimized, ...props }: ComponentProps<'img'> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => {
    mocks.image(props.src)
    return <img {...props} />
  },
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
function renderAtlas(data = atlas(), topic: 'all' | 'birds' = 'birds') {
  return render(<SpeciesAtlas initialData={data} initialTopic={topic} initialStatus="all" requestedStatus="all" canonicalTopicPath={topic === 'birds' ? '/nature/birds' : undefined} heading={topic === 'birds' ? '鸟类图鉴与观察' : '物种图鉴'} introduction="原有专题介绍" />)
}
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  history.replaceState(null, '', '/nature/birds')
  mocks.read.mockReturnValue(null)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

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
  it('全部跨类别统一 A–Z，类内同字母仍按名称排序且不修改原数据', () => {
    const data = atlas()
    data.groups[0].items = [{ ...bird(1, 'B'), commonName: '白鹭' }, { ...bird(2, 'B'), commonName: '八哥' }]
    data.groups[1].items = [{ ...bird(3, 'A'), commonName: '阿蝉', topicKey: 'insects' }]
    data.groups[2].items = [{ ...bird(4, 'Z'), commonName: '紫苑', topicKey: 'plants' }, { ...bird(5, '其他'), commonName: '其他名称', topicKey: 'plants' }]
    for (const group of data.groups) group.total = group.items.length
    data.total = 5
    const original = JSON.stringify(data)
    const { container } = renderAtlas(data, 'all')
    expect(Array.from(container.querySelectorAll('.nature-atlas-letter-heading h2'), el => el.textContent)).toEqual(['A', 'B', 'Z', '其他'])
    expect(Array.from(container.querySelectorAll('.nature-atlas-tile-name'), el => el.textContent)).toEqual(['阿蝉', '八哥', '白鹭', '紫苑', '其他名称'])
    expect(screen.getByRole('link', { name: '跳转到A开头物种' })).toHaveAttribute('href', '#species-letter-all-a')
    expect(screen.getByRole('link', { name: '跳转到其他物种' })).toHaveAttribute('href', '#species-letter-all-other')
    expect(JSON.stringify(data)).toBe(original)
  })
  it('搜索支持别名，同专题搜索和状态只更新 URL，不重新请求整页', async () => {
    const { container } = renderAtlas()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.change(screen.getByLabelText('搜索物种'), { target: { value: '别名2' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索' }))
    await waitFor(() => expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(1))
    expect(location.pathname + location.search).toBe('/nature/birds?q=%E5%88%AB%E5%90%8D2')
    const toolbar = within(screen.getByRole('region', { name: '物种筛选' }))
    fireEvent.click(toolbar.getByRole('button', { name: /^已观察/ }))
    await waitFor(() => expect(location.search).toContain('status=observed'))
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    await waitFor(() => expect(location.pathname + location.search).toBe('/nature/birds?status=observed'))
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('未提交的搜索草稿也能清除', () => {
    renderAtlas()
    const input = screen.getByLabelText('搜索物种')
    fireEvent.change(input, { target: { value: '未提交' } })
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
    expect(input).toHaveValue('')
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it('分类导航只请求一次，等待时不先重建旧页面的结果', () => {
    const { container } = renderAtlas()
    const first = container.querySelector('[data-species-slug]')
    const imageCalls = mocks.image.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '昆虫' }))
    expect(mocks.replace).toHaveBeenCalledTimes(1)
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/insects', { scroll: false })
    expect(container.querySelector('[data-species-slug]')).toBe(first)
    expect(mocks.image).toHaveBeenCalledTimes(imageCalls)
  })
  it('空结果有清除入口', async () => {
    const { container } = renderAtlas()
    fireEvent.change(screen.getByLabelText('搜索物种'), { target: { value: '不存在的物种' } })
    fireEvent.click(screen.getByRole('button', { name: '搜索' }))
    await waitFor(() => expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(0))
    expect(screen.getByText('没有找到匹配的物种')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
    expect(mocks.replace).toHaveBeenLastCalledWith('/nature/species', { scroll: false })
  })
  it('浏览器后退同步同页筛选，且不触发新导航', async () => {
    const { container } = renderAtlas()
    history.replaceState(null, '', '/nature/birds?q=%E5%88%AB%E5%90%8D2&status=observed')
    fireEvent(window, new PopStateEvent('popstate'))
    await waitFor(() => expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(1))
    expect(screen.getByLabelText('搜索物种')).toHaveValue('别名2')
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it.each(['anonymous', 'unavailable'] as const)('%s 不伪造观察状态', state => {
    const { container } = renderAtlas(atlas(state))
    expect(screen.getByRole('button', { name: '已观察' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '待观察' })).toBeDisabled()
    expect(Array.from(container.querySelectorAll('[data-species-slug]')).every(card => card.getAttribute('aria-label')?.includes('观察状态未知'))).toBe(true)
    if (state === 'anonymous') expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login?next=%2Fnature%2Fbirds')
    else expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })
  it('图集/列表保留 DOM、记住选择；存储不可用也能切换', () => {
    const first = renderAtlas()
    const tile = first.container.querySelector('[data-species-slug]')
    fireEvent.click(screen.getByRole('button', { name: '列表' }))
    expect(first.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'list')
    expect(first.container.querySelector('[data-species-slug]')).toBe(tile)
    expect(sessionStorage.getItem('nature-atlas-layout-v1')).toBe('list')
    first.unmount()
    const second = renderAtlas()
    expect(second.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'list')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled') })
    fireEvent.click(screen.getByRole('button', { name: '图集' }))
    expect(second.container.querySelector('[data-layout]')).toHaveAttribute('data-layout', 'grid')
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it('500 个物种时输入草稿与反复切换布局，不再次渲染照片或修改图片 DOM', () => {
    const data = atlas()
    data.groups[0].items = Array.from({ length: 500 }, (_, i) => bird(i + 1, String.fromCharCode(65 + i % 26)))
    data.groups[0].total = 500
    data.total = 500
    const { container } = renderAtlas(data)
    expect(container.querySelectorAll('[data-species-slug]')).toHaveLength(500)
    const calls = mocks.image.mock.calls.length
    const images = Array.from(container.querySelectorAll('img'))
    for (let i = 0; i < 4; i++) {
      fireEvent.change(screen.getByLabelText('搜索物种'), { target: { value: `草稿${i}` } })
      fireEvent.click(screen.getByRole('button', { name: '列表' }))
      fireEvent.click(screen.getByRole('button', { name: '图集' }))
    }
    expect(mocks.image).toHaveBeenCalledTimes(calls)
    expect(Array.from(container.querySelectorAll('img'))).toEqual(images)
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})

describe('返回定位', () => {
  it('用户已滚动时，取消尚未执行的恢复，不抢回旧位置', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id })
    vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    mocks.read.mockReturnValue({ filtersKey: 'topic=birds', scrollY: 900, anchorSlug: null })
    const view = renderAtlas()
    fireEvent.wheel(window)
    act(() => { for (const [key, cb] of frames) { frames.delete(key); cb(0) } })
    expect(scroll).not.toHaveBeenCalled()
    view.unmount()
    expect(frames.size).toBe(0)
  })
})

describe('物种卡片', () => {
  it.each([true, false, null])('状态 %s 不改变照片颜色，展示真实分类', observed => {
    const { container } = render(<SpeciesAtlasTile item={{ ...bird(1), observedByCurrentUser: observed }} filtersKey="topic=birds" />)
    const image = container.querySelector('img')!
    for (const cls of ['grayscale', 'saturate-25', 'opacity-75', 'opacity-0']) expect(image).not.toHaveClass(cls)
    expect(image).toHaveAttribute('decoding', 'async')
    expect(screen.getByText('Species 1')).toBeInTheDocument()
    expect(screen.getByText('测试分类')).toBeInTheDocument()
    const status = observed === null ? '观察状态未知' : observed ? '已观察' : '待观察'
    expect(screen.getByRole('link')).toHaveAttribute('aria-label', `鸟类 1，鸟类，${status}`)
    expect(container.querySelector('[aria-hidden="true"]')!.textContent).toBe(observed === null ? '' : status)
  })
  it('图片失败显示占位，更换图片后恢复，不依赖 onLoad 设置透明度', () => {
    const item = bird(1)
    const { container, rerender } = render(<SpeciesAtlasTile item={item} filtersKey="" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    rerender(<SpeciesAtlasTile item={{ ...item, thumbnailUrl: '/replacement.webp' }} filtersKey="" />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/replacement.webp')
    expect(screen.queryByText('暂无图片')).not.toBeInTheDocument()
  })
  it('缺失字段不编造，一次点击只测量一次返回锚点', () => {
    const { container } = render(<SpeciesAtlasTile item={{ ...bird(1), scientificName: null, taxonGroup: null, thumbnailUrl: null }} filtersKey="topic=birds" />)
    expect(container.querySelector('i')).toBeNull()
    expect(screen.getByText('暂无图片')).toBeInTheDocument()
    const link = screen.getByRole('link')
    fireEvent.pointerDown(link)
    expect(mocks.save).not.toHaveBeenCalled()
    fireEvent.click(link)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ filtersKey: 'topic=birds', anchorSlug: 'bird-1' }))
  })
})
