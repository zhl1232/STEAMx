'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Bird, Bug, ListFilter, Search, Sprout, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import {
  buildSpeciesAtlasFiltersKey,
  filterSpeciesAtlasGroups,
  normalizeSpeciesAtlasInitial,
  sortSpeciesAtlasItems,
  speciesAtlasOtherInitial,
  type SpeciesAtlasItem,
  type SpeciesAtlasResponse,
  type SpeciesAtlasStatusFilter,
  type SpeciesAtlasTopicFilter,
} from '@/lib/nature-species-atlas'
import {
  buildNatureSpeciesFiltersKey,
  clearNatureSpeciesScrollRestore,
  readNatureSpeciesScrollRestore,
} from '@/lib/nature-species-scroll-restore'
import { cn } from '@/lib/utils'
import { SpeciesAtlasTile } from './species-atlas-tile'
import { SpeciesAtlasHero } from './species-atlas-hero'
import styles from './species-atlas.module.css'
import performanceStyles from './species-atlas-performance.module.css'

const AtlasHero = memo(SpeciesAtlasHero)

interface SpeciesAtlasProps {
  initialData: SpeciesAtlasResponse
  initialQuery?: string
  initialTopic: SpeciesAtlasTopicFilter
  initialStatus: SpeciesAtlasStatusFilter
  requestedStatus: SpeciesAtlasStatusFilter
  canonicalTopicPath?: string
  heading?: string
  introduction?: string
}

const TOPIC_ICONS: Record<SpeciesAtlasTopicFilter, LucideIcon> = {
  all: ListFilter, birds: Bird, insects: Bug, plants: Sprout,
}
const STATUS_OPTIONS: Array<{ key: SpeciesAtlasStatusFilter; label: string }> = [
  { key: 'all', label: '全部' }, { key: 'observed', label: '已观察' }, { key: 'unobserved', label: '待观察' },
]
const TOPIC_PATHS: Partial<Record<SpeciesAtlasTopicFilter, string>> = {
  birds: '/nature/birds', insects: '/nature/insects', plants: '/nature/plants',
}
const SPECIES_ALPHABET = [
  ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)), speciesAtlasOtherInitial,
]
const PRIORITY_TILE_COUNT = 3
const LAYOUT_STORAGE_KEY = 'nature-atlas-layout-v1'
type AtlasLayout = 'grid' | 'list'
interface SpeciesLetterGroup { initial: string; items: SpeciesAtlasItem[] }

/** 全部与单类使用同一套拼音排序；不能先按类别分段再声称是全局 A–Z。 */
function groupSpeciesByInitial(items: SpeciesAtlasItem[]): SpeciesLetterGroup[] {
  const grouped = new Map<string, SpeciesAtlasItem[]>()
  for (const item of sortSpeciesAtlasItems(items)) {
    const initial = normalizeSpeciesAtlasInitial(item.initial)
    const current = grouped.get(initial) ?? []
    current.push(item)
    grouped.set(initial, current)
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => {
      if (left === right) return 0
      if (left === speciesAtlasOtherInitial) return 1
      if (right === speciesAtlasOtherInitial) return -1
      return left.localeCompare(right)
    })
    .map(([initial, groupedItems]) => ({ initial, items: groupedItems }))
}

function getStatusCounts(data: SpeciesAtlasResponse, topic: SpeciesAtlasTopicFilter, progressReady: boolean) {
  const groups = topic === 'all' ? data.groups : data.groups.filter(group => group.key === topic)
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const observed = progressReady ? groups.reduce((sum, group) => sum + (group.observedCount ?? 0), 0) : null
  return { total, observed, unobserved: observed === null ? null : Math.max(0, total - observed) }
}
function buildSpeciesLetterId(topic: SpeciesAtlasTopicFilter, initial: string) {
  return `species-letter-${topic}-${initial === speciesAtlasOtherInitial ? 'other' : initial.toLowerCase()}`
}
function getSpeciesLetterLabel(initial: string) {
  return initial === speciesAtlasOtherInitial ? '其他物种' : `${initial}开头物种`
}
function getTopicSummaryLabel(topic: SpeciesAtlasTopicFilter) {
  return { all: '全部物种', birds: '鸟类', insects: '昆虫', plants: '植物' }[topic]
}
function buildSpeciesHref(filters: {
  query?: string; topic: SpeciesAtlasTopicFilter; status: SpeciesAtlasStatusFilter; canonicalTopicPath?: string
}) {
  const key = buildSpeciesAtlasFiltersKey(filters)
  const basePath = filters.canonicalTopicPath ?? '/nature/species'
  if (!filters.canonicalTopicPath) return key ? `${basePath}?${key}` : basePath
  const params = new URLSearchParams()
  if (filters.query?.trim()) params.set('q', filters.query.trim())
  if (filters.status !== 'all') params.set('status', filters.status)
  return params.size ? `${basePath}?${params}` : basePath
}

/** 布局只是外层 CSS 属性；输入草稿和切换图集/列表不重新执行整批卡片的 React 渲染。 */
const AtlasResults = memo(function AtlasResults({ groups, topic, filtersKey, priorityIds }: {
  groups: SpeciesLetterGroup[]; topic: SpeciesAtlasTopicFilter; filtersKey: string; priorityIds: Set<number>
}) {
  const availableLetters = new Set(groups.map(group => group.initial))
  const resultsRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = resultsRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let previousWidth = -1
    let previousBreakpoint = -1
    const updateGeometry = (width: number) => {
      const breakpoint = window.matchMedia('(min-width: 1280px)').matches ? 3
        : window.matchMedia('(min-width: 768px)').matches ? 2 : 0
      if (width <= 0 || (width === previousWidth && breakpoint === previousBreakpoint)) return
      previousWidth = width
      previousBreakpoint = breakpoint
      const gap = breakpoint >= 2 ? 14 : 10
      const gridMin = breakpoint === 3 ? 190 : 170
      const listMin = breakpoint === 3 ? 340 : 300
      // 手机固定双列，离屏行数和图片高度必须与 CSS 的双列布局一致。
      const gridColumns = breakpoint >= 2 ? Math.max(1, Math.floor((width + gap) / (gridMin + gap))) : 2
      const listColumns = breakpoint >= 2 ? Math.max(1, Math.floor((width + gap) / (listMin + gap))) : 1
      const mediaSize = ((width - gap * (gridColumns - 1)) / gridColumns - 2) * 0.75
      element.style.setProperty('--atlas-grid-media-size', `${mediaSize}px`)
      element.style.setProperty('--atlas-grid-gap', `${gap}px`)
      for (const grid of element.querySelectorAll<HTMLElement>('[data-atlas-count]')) {
        const count = Number(grid.dataset.atlasCount)
        grid.style.setProperty('--atlas-rows-grid', String(Math.ceil(count / gridColumns)))
        grid.style.setProperty('--atlas-rows-list', String(Math.ceil(count / listColumns)))
      }
      element.dataset.atlasMeasured = 'true'
    }
    // 只在目录/宽度改变时计算行数；没有 scroll 监听，也不逐张测量卡片。
    updateGeometry(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(entries => {
      if (entries[0]) updateGeometry(entries[0].contentRect.width)
    })
    observer.observe(element)
    const onResize = () => updateGeometry(element.getBoundingClientRect().width)
    window.addEventListener('resize', onResize, { passive: true })
    return () => { observer.disconnect(); window.removeEventListener('resize', onResize) }
  }, [groups])
  return (
    <div className="nature-atlas-results mt-2 md:mt-8">
      <div ref={resultsRef} className="nature-atlas-results-main space-y-6">
        {groups.map(group => {
          const id = buildSpeciesLetterId(topic, group.initial)
          return (
            <section key={group.initial} id={id} className="nature-atlas-letter-group" aria-labelledby={`${id}-heading`}>
              <div className="nature-atlas-letter-heading">
                <h2 id={`${id}-heading`}>{group.initial}</h2>
                <span className={styles.letterCount}>{group.items.length} 种</span>
              </div>
              <ul className="nature-atlas-grid" data-atlas-count={group.items.length} aria-label={`${getTopicSummaryLabel(topic)}${getSpeciesLetterLabel(group.initial)}`} data-singleton={group.items.length === 1 ? 'true' : undefined}>
                {group.items.map(item => (
                  <li key={item.id} className={performanceStyles.tileCell}>
                    <SpeciesAtlasTile item={item} filtersKey={filtersKey} priority={priorityIds.has(item.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      {groups.length > 0 ? (
        <nav className="nature-atlas-index" aria-label="按名称首字母跳转">
          {SPECIES_ALPHABET.map(letter => availableLetters.has(letter) ? (
            <a key={letter} href={`#${buildSpeciesLetterId(topic, letter)}`} className="nature-atlas-index-link" aria-label={`跳转到${getSpeciesLetterLabel(letter)}`}>{letter}</a>
          ) : (
            <span key={letter} className="nature-atlas-index-link nature-atlas-index-link-disabled" aria-hidden="true">{letter}</span>
          ))}
        </nav>
      ) : null}
    </div>
  )
})

export function SpeciesAtlas({
  initialData, initialQuery = '', initialTopic, initialStatus, requestedStatus = initialStatus,
  canonicalTopicPath, heading = '物种图鉴',
  introduction = '浏览鸟类、昆虫和植物的物种档案，按名称、学名或科属查找识别特征、常见环境与社区观察记录。',
}: SpeciesAtlasProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [query, setQuery] = useState(initialQuery)
  const [searchDraft, setSearchDraft] = useState(initialQuery)
  const [topic, setTopic] = useState<SpeciesAtlasTopicFilter>(initialTopic)
  const [status, setStatus] = useState<SpeciesAtlasStatusFilter>(initialStatus)
  const [layout, setLayout] = useState<AtlasLayout>('grid')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [isNavigating, startNavigation] = useTransition()
  const [isFiltering, startFiltering] = useTransition()
  const progressReady = data.viewer.progressState === 'ready'

  useEffect(() => {
    setData(initialData)
    setQuery(initialQuery)
    setSearchDraft(initialQuery)
    setTopic(initialTopic)
    setStatus(initialData.viewer.progressState === 'ready' ? initialStatus : 'all')
  }, [initialData, initialQuery, initialStatus, initialTopic])

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(LAYOUT_STORAGE_KEY) === 'list') setLayout('list')
    } catch { /* 禁用存储时仍可正常浏览。 */ }
  }, [])
  function changeLayout(next: AtlasLayout) {
    if (next === layout) return
    setLayout(next)
    try { sessionStorage.setItem(LAYOUT_STORAGE_KEY, next) } catch { /* 不依赖存储成功。 */ }
  }

  const updateFilters = useCallback((next: Partial<{
    query: string; topic: SpeciesAtlasTopicFilter; status: SpeciesAtlasStatusFilter
  }>) => {
    const nextQuery = (next.query ?? query).trim()
    const nextTopic = next.topic ?? topic
    const nextStatus = progressReady ? next.status ?? status : 'all'
    if (nextQuery === query && nextTopic === topic && nextStatus === status && !isNavigating) {
      setSearchDraft(nextQuery)
      return
    }
    const href = buildSpeciesHref({ query: nextQuery, topic: nextTopic, status: nextStatus, canonicalTopicPath: TOPIC_PATHS[nextTopic] })
    // 跨专题保留真正的 Next 导航以更新 SEO/页面标题，只在服务端数据到达后换一次结果。
    // 不再先渲染乐观列表、随后用 initialData 又重建一遍。等待时旧列表仍可滚动。
    if (nextTopic !== topic || isNavigating || new URL(href, window.location.href).pathname !== window.location.pathname) {
      startNavigation(() => router.replace(href, { scroll: false }))
      return
    }
    // 同专题搜索/状态已有全量数据，不触发 RSC 导航和重复目录查询。
    window.history.replaceState(null, '', href)
    setSearchDraft(nextQuery)
    startFiltering(() => { setQuery(nextQuery); setStatus(nextStatus) })
  }, [isNavigating, progressReady, query, router, status, topic])

  // 原生历史回退也要同步同页筛选。跨页面的状态继续由服务端 props 同步。
  useEffect(() => {
    const restoreFilters = () => {
      if (window.location.pathname !== (TOPIC_PATHS[topic] ?? '/nature/species')) return
      const params = new URLSearchParams(window.location.search)
      const nextQuery = params.get('q') ?? ''
      const requested = params.get('status')
      const nextStatus = progressReady && (requested === 'observed' || requested === 'unobserved') ? requested : 'all'
      setSearchDraft(nextQuery)
      startFiltering(() => { setQuery(nextQuery); setStatus(nextStatus) })
    }
    window.addEventListener('popstate', restoreFilters)
    return () => window.removeEventListener('popstate', restoreFilters)
  }, [progressReady, topic])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateFilters({ query: searchDraft })
  }
  async function refreshAtlas() {
    if (isRefreshing) return
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const response = await fetch('/api/species/atlas', { cache: 'no-store' })
      if (!response.ok) throw new Error('atlas request failed')
      const nextData = (await response.json()) as SpeciesAtlasResponse
      startFiltering(() => {
        setData(nextData)
        if (nextData.viewer.progressState !== 'ready') setStatus('all')
      })
    } catch { setRefreshError('观察状态暂时不可用') }
    finally { setIsRefreshing(false) }
  }

  const filters = useMemo(() => ({ query, topic, status }), [query, topic, status])
  const filteredGroups = useMemo(() => filterSpeciesAtlasGroups(data.groups, filters), [data.groups, filters])
  const letterGroups = useMemo(() => groupSpeciesByInitial(filteredGroups.flatMap(group => group.items)), [filteredGroups])
  const visibleCount = useMemo(() => letterGroups.reduce((sum, group) => sum + group.items.length, 0), [letterGroups])
  const statusCounts = useMemo(() => getStatusCounts(data, topic, progressReady), [data, topic, progressReady])
  const filtersKey = useMemo(() => buildSpeciesAtlasFiltersKey(filters), [filters])
  const priorityItemIds = useMemo(() => {
    const ids = new Set<number>()
    for (const group of letterGroups) for (const item of group.items) {
      ids.add(item.id)
      if (ids.size >= PRIORITY_TILE_COUNT) return ids
    }
    return ids
  }, [letterGroups])

  useLayoutEffect(() => {
    const saved = readNatureSpeciesScrollRestore()
    if (!saved) return
    const currentKey = buildNatureSpeciesFiltersKey(new URLSearchParams(filtersKey))
    if (saved.filtersKey !== currentKey || window.location.hash.startsWith('#species-letter-')) {
      clearNatureSpeciesScrollRestore()
      return
    }
    let cancelled = false
    let firstFrame = 0
    let secondFrame = 0
    const cancel = () => { cancelled = true; clearNatureSpeciesScrollRestore() }
    // 返回定位只读一个锚点；用户已经触摸/滚动时不再抢回旧位置。
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    for (const event of events) window.addEventListener(event, cancel, { passive: true, once: true })
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (cancelled) return
        const anchor = saved.anchorSlug
          ? document.querySelector<HTMLElement>(`[data-species-slug="${CSS.escape(saved.anchorSlug)}"]`) : null
        const top = anchor && typeof saved.anchorTop === 'number'
          ? Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - saved.anchorTop) : saved.scrollY
        window.scrollTo({ top, left: 0, behavior: 'instant' })
        clearNatureSpeciesScrollRestore()
        for (const event of events) window.removeEventListener(event, cancel)
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      for (const event of events) window.removeEventListener(event, cancel)
    }
  }, [filtersKey])

  return (
    <div className={cn('app-shell-wide pb-24 pt-0 md:px-8 md:pb-12 md:pt-8', styles.atlas, performanceStyles.performance)} data-layout={layout}>
      <MobilePageHeader title="自然观察" className="nature-atlas-mobile-header" contentClassName="nature-atlas-mobile-header-content" backButtonClassName="nature-atlas-mobile-header-back" titleClassName="nature-atlas-mobile-header-title" fallbackHref="/nature" />
      <Link href="/nature" className={styles.desktopBack}>返回自然观察首页</Link>
      <AtlasHero topic={topic} heading={heading} introduction={introduction} />
      <section className="nature-atlas-toolbar" aria-label="物种筛选">
        <form onSubmit={handleSearchSubmit} className="nature-atlas-search-form">
          <label className="sr-only" htmlFor="species-atlas-search">搜索物种</label>
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input id="species-atlas-search" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="搜索名称、学名或科属" autoComplete="off" enterKeyHint="search" />
          {searchDraft ? <button type="button" className="nature-atlas-icon-button" onClick={() => updateFilters({ query: '' })} aria-label="清除搜索" title="清除搜索"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
          <Button type="submit" tone="brand" size="sm" className="shrink-0">搜索</Button>
        </form>
        <div className="nature-atlas-topic-tabs" aria-label="专题筛选">
          {([...data.groups.map(group => group.key), 'all'] as SpeciesAtlasTopicFilter[]).map(key => {
            const Icon = TOPIC_ICONS[key]
            const label = key === 'all' ? '全部' : getTopicSummaryLabel(key)
            const count = key === 'all' ? data.total : data.groups.find(group => group.key === key)?.total ?? 0
            return <button key={key} type="button" className={cn('nature-atlas-topic-tab', topic === key && 'nature-atlas-topic-tab-active')} aria-label={label} data-topic={key} aria-pressed={topic === key} onClick={() => updateFilters({ topic: key })}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className={styles.topicText}><span>{label}</span><span className={styles.topicCount} aria-hidden="true">{count}</span></span>
            </button>
          })}
        </div>
        <div className="nature-atlas-status-row"><div className="nature-atlas-status-filters" aria-label="观察状态筛选">
          {STATUS_OPTIONS.map(({ key, label }) => {
            const count = key === 'all' ? statusCounts.total : key === 'observed' ? statusCounts.observed : statusCounts.unobserved
            return <button key={key} type="button" className={cn('nature-atlas-status-button', key === 'unobserved' && 'nature-atlas-status-button-unobserved', status === key && 'nature-atlas-status-button-active')} aria-pressed={status === key} disabled={!progressReady && key !== 'all'} onClick={() => updateFilters({ status: key })}>
              <span>{label}</span>{count !== null ? <span className="nature-atlas-status-count">{count}</span> : null}
            </button>
          })}
        </div></div>
        {data.viewer.progressState === 'anonymous' ? <p className="nature-atlas-status-note"><Link href={`/login?next=${encodeURIComponent(buildSpeciesHref({ query, topic, status: requestedStatus, canonicalTopicPath }))}`} className="font-semibold text-primary hover:underline">登录</Link> 后可筛选已观察物种。</p> : null}
        {data.viewer.progressState === 'unavailable' || refreshError ? <p className="nature-atlas-status-note nature-atlas-status-note-warning">观察状态暂时不可用，物种仍可正常浏览。<button type="button" className="ml-1 font-semibold underline underline-offset-2" onClick={refreshAtlas} disabled={isRefreshing}>{isRefreshing ? '重试中' : '重试'}</button></p> : null}
      </section>
      <div className={styles.resultsToolbar}>
        <p aria-live="polite" aria-atomic="true"><strong>{visibleCount} 种</strong><span className={styles.sortNote}> · 名称 A–Z</span>{isNavigating || isFiltering ? <span role="status" className={styles.sortNote}> · 正在切换…</span> : null}</p>
        <div className={styles.layoutSwitch} role="group" aria-label="显示方式">
          <button type="button" aria-pressed={layout === 'grid'} onClick={() => changeLayout('grid')}><LayoutGrid size={15} aria-hidden="true" />图集</button>
          <button type="button" aria-pressed={layout === 'list'} onClick={() => changeLayout('list')}><List size={15} aria-hidden="true" />列表</button>
        </div>
      </div>
      <div aria-busy={isNavigating || isFiltering}>
        <AtlasResults groups={letterGroups} topic={topic} filtersKey={filtersKey} priorityIds={priorityItemIds} />
      </div>
      {visibleCount === 0 ? <div className="nature-atlas-empty-all"><Search className="h-5 w-5" aria-hidden="true" /><span>没有找到匹配的物种</span><button type="button" onClick={() => updateFilters({ query: '', topic: 'all', status: 'all' })}>清除筛选</button></div> : null}
    </div>
  )
}