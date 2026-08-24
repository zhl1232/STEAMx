'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDownAZ,
  Bird,
  Bug,
  CircleCheck,
  CircleDashed,
  ListFilter,
  Search,
  Sprout,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import {
  buildSpeciesAtlasFiltersKey,
  filterSpeciesAtlasGroups,
  normalizeSpeciesAtlasInitial,
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

interface SpeciesAtlasProps {
  initialData: SpeciesAtlasResponse
  initialQuery?: string
  initialTopic: SpeciesAtlasTopicFilter
  initialStatus: SpeciesAtlasStatusFilter
  requestedStatus: SpeciesAtlasStatusFilter
}

const TOPIC_ICONS: Record<SpeciesAtlasTopicFilter, LucideIcon | null> = {
  all: ListFilter,
  birds: Bird,
  insects: Bug,
  plants: Sprout,
}

const STATUS_OPTIONS: Array<{ key: SpeciesAtlasStatusFilter; label: string; icon: LucideIcon }> = [
  { key: 'all', label: '全部', icon: ListFilter },
  { key: 'observed', label: '已观察', icon: CircleCheck },
  { key: 'unobserved', label: '待观察', icon: CircleDashed },
]

const SPECIES_ALPHABET = [
  ...Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index)),
  speciesAtlasOtherInitial,
]

/** 首屏可见的前几张缩略图使用 priority，其余保持懒加载 */
const PRIORITY_TILE_COUNT = 3

interface SpeciesLetterGroup {
  initial: string
  items: SpeciesAtlasItem[]
}

function groupSpeciesByInitial(items: SpeciesAtlasItem[]): SpeciesLetterGroup[] {
  const grouped = new Map<string, SpeciesAtlasItem[]>()

  for (const item of items) {
    const initial = normalizeSpeciesAtlasInitial(item.initial)
    const current = grouped.get(initial) ?? []
    current.push(item)
    grouped.set(initial, current)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => {
      if (left === speciesAtlasOtherInitial) return 1
      if (right === speciesAtlasOtherInitial) return -1
      return left.localeCompare(right)
    })
    .map(([initial, groupedItems]) => ({ initial, items: groupedItems }))
}

function getStatusCounts(
  data: SpeciesAtlasResponse,
  topic: SpeciesAtlasTopicFilter,
  progressReady: boolean,
) {
  const groups = topic === 'all' ? data.groups : data.groups.filter((group) => group.key === topic)
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const observed = progressReady
    ? groups.reduce((sum, group) => sum + (group.observedCount ?? 0), 0)
    : null

  return {
    total,
    observed,
    unobserved: observed === null ? null : Math.max(0, total - observed),
  }
}

function buildSpeciesLetterId(topic: SpeciesAtlasTopicFilter, initial: string) {
  const key = initial === speciesAtlasOtherInitial ? 'other' : initial.toLowerCase()
  return `species-letter-${topic}-${key}`
}

function getSpeciesLetterLabel(initial: string) {
  return initial === speciesAtlasOtherInitial ? '其他物种' : `${initial}开头物种`
}

function buildSpeciesHref(filters: {
  query?: string
  topic: SpeciesAtlasTopicFilter
  status: SpeciesAtlasStatusFilter
}) {
  const key = buildSpeciesAtlasFiltersKey(filters)
  return key ? `/nature/species?${key}` : '/nature/species'
}

function getTopicSummaryLabel(topic: SpeciesAtlasTopicFilter) {
  if (topic === 'all') return '全部物种'
  if (topic === 'birds') return '鸟类'
  if (topic === 'insects') return '昆虫'
  return '植物'
}

export function SpeciesAtlas({
  initialData,
  initialQuery = '',
  initialTopic,
  initialStatus,
  requestedStatus = initialStatus,
}: SpeciesAtlasProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [query, setQuery] = useState(initialQuery)
  const [searchDraft, setSearchDraft] = useState(initialQuery)
  const [topic, setTopic] = useState<SpeciesAtlasTopicFilter>(initialTopic)
  const [status, setStatus] = useState<SpeciesAtlasStatusFilter>(initialStatus)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const progressReady = data.viewer.progressState === 'ready'
  const isTopicView = topic !== 'all'

  useEffect(() => {
    setData(initialData)
    setQuery(initialQuery)
    setSearchDraft(initialQuery)
    setTopic(initialTopic)
    setStatus(initialData.viewer.progressState === 'ready' ? initialStatus : 'all')
  }, [initialData, initialQuery, initialStatus, initialTopic])

  const updateFilters = useCallback((next: Partial<{
    query: string
    topic: SpeciesAtlasTopicFilter
    status: SpeciesAtlasStatusFilter
  }>) => {
    const nextQuery = next.query ?? query
    const nextTopic = next.topic ?? topic
    const nextStatus = progressReady ? next.status ?? status : 'all'
    setQuery(nextQuery)
    setSearchDraft(nextQuery)
    setTopic(nextTopic)
    setStatus(nextStatus)
    router.replace(buildSpeciesHref({ query: nextQuery, topic: nextTopic, status: nextStatus }), { scroll: false })
  }, [progressReady, query, router, status, topic])

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateFilters({ query: searchDraft.trim() })
  }

  async function refreshAtlas() {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      const response = await fetch('/api/species/atlas', { cache: 'no-store' })
      if (!response.ok) throw new Error('atlas request failed')
      const nextData = (await response.json()) as SpeciesAtlasResponse
      setData(nextData)
      if (nextData.viewer.progressState !== 'ready') {
        setStatus('all')
      }
    } catch {
      setRefreshError('观察状态暂时不可用')
    } finally {
      setIsRefreshing(false)
    }
  }

  const filters = useMemo(() => ({ query, topic, status }), [query, status, topic])
  const filteredGroups = useMemo(() => filterSpeciesAtlasGroups(data.groups, filters), [data.groups, filters])
  const visibleCount = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.items.length, 0),
    [filteredGroups],
  )
  const statusCounts = useMemo(
    () => getStatusCounts(data, topic, progressReady),
    [data, progressReady, topic],
  )
  const filtersKey = useMemo(() => buildSpeciesAtlasFiltersKey(filters), [filters])
  const fromHref = useMemo(() => buildSpeciesHref(filters), [filters])
  const letterGroups = useMemo(
    () => (isTopicView ? groupSpeciesByInitial(filteredGroups[0]?.items ?? []) : []),
    [filteredGroups, isTopicView],
  )
  // 必须按实际渲染顺序取：专题视图会按首字母重新分组，
  // filteredGroups 的前几项通常不是首屏最先出现的瓦片
  const priorityItemIds = useMemo(() => {
    const renderedGroups = isTopicView ? letterGroups : filteredGroups
    const ids = new Set<number>()

    for (const group of renderedGroups) {
      for (const item of group.items) {
        ids.add(item.id)
        if (ids.size >= PRIORITY_TILE_COUNT) return ids
      }
    }

    return ids
  }, [filteredGroups, isTopicView, letterGroups])
  const availableLetters = useMemo(
    () => new Set(letterGroups.map((group) => group.initial)),
    [letterGroups],
  )

  useLayoutEffect(() => {
    const saved = readNatureSpeciesScrollRestore()
    if (!saved) return

    const currentFiltersKey = buildNatureSpeciesFiltersKey(new URLSearchParams(filtersKey))
    if (saved.filtersKey !== currentFiltersKey) {
      clearNatureSpeciesScrollRestore()
      return
    }

    clearNatureSpeciesScrollRestore()
    let cancelled = false
    const restore = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          const anchorElement = saved.anchorSlug
            ? document.querySelector<HTMLElement>(`[data-species-slug="${CSS.escape(saved.anchorSlug)}"]`)
            : null

          if (anchorElement && typeof saved.anchorTop === 'number') {
            window.scrollTo({
              top: Math.max(0, window.scrollY + anchorElement.getBoundingClientRect().top - saved.anchorTop),
              left: 0,
              behavior: 'auto',
            })
          } else {
            window.scrollTo({ top: saved.scrollY, left: 0, behavior: 'auto' })
          }
        })
      })
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [filtersKey])

  function renderTileGrid(items: SpeciesAtlasItem[], label: string) {
    return (
      <ul className="nature-atlas-grid" aria-label={label}>
        {items.map((item) => (
          <li key={item.id}>
            <SpeciesAtlasTile
              item={item}
              fromHref={fromHref}
              filtersKey={filtersKey}
              priority={priorityItemIds.has(item.id)}
            />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="app-shell-wide pb-24 pt-0 md:px-8 md:pb-12 md:pt-8">
      <MobilePageHeader
        title="自然观察"
        className="nature-atlas-mobile-header"
        contentClassName="nature-atlas-mobile-header-content"
        backButtonClassName="nature-atlas-mobile-header-back"
        titleClassName="nature-atlas-mobile-header-title"
        fallbackHref="/nature"
      />

      <header className="px-4 pb-4 pt-5 md:px-0 md:pb-6 md:pt-0">
        <p className="text-xs font-semibold tracking-[0.16em] text-[hsl(var(--brand-green))]">自然观察 · STEAMX</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground md:text-4xl">物种图鉴</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base">
          浏览鸟类、昆虫和植物的物种档案，按名称、学名或科属查找识别特征、常见环境与社区观察记录。
        </p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href="/nature/observations" className="text-[hsl(var(--brand-green))] hover:underline">
            查看公开观察记录
          </Link>
          <Link href="/nature" className="text-muted-foreground hover:text-foreground hover:underline">
            返回自然观察首页
          </Link>
        </div>
      </header>

      <section className="nature-atlas-toolbar" aria-label="物种筛选">
        <form onSubmit={handleSearchSubmit} className="nature-atlas-search-form">
          <label className="sr-only" htmlFor="species-atlas-search">搜索物种</label>
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id="species-atlas-search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="搜索名称、学名或科属"
            autoComplete="off"
          />
          {searchDraft ? (
            <button
              type="button"
              className="nature-atlas-icon-button"
              onClick={() => updateFilters({ query: '' })}
              aria-label="清除搜索"
              title="清除搜索"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <Button type="submit" tone="brand" size="sm" className="shrink-0">
            搜索
          </Button>
        </form>

        <div className="nature-atlas-topic-tabs" aria-label="专题筛选">
          {(['all', ...data.groups.map((group) => group.key)] as SpeciesAtlasTopicFilter[]).map((key) => {
            const Icon = TOPIC_ICONS[key]
            const label = key === 'all' ? '全部' : getTopicSummaryLabel(key)
            return (
              <button
                key={key}
                type="button"
                className={cn('nature-atlas-topic-tab', topic === key && 'nature-atlas-topic-tab-active')}
                aria-pressed={topic === key}
                onClick={() => updateFilters({ topic: key })}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        <div className="nature-atlas-status-row">
          <div className="nature-atlas-status-filters" aria-label="观察状态筛选">
            {STATUS_OPTIONS.map(({ key, label }) => {
              const count = key === 'all'
                ? statusCounts.total
                : key === 'observed'
                  ? statusCounts.observed
                  : statusCounts.unobserved

              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    'nature-atlas-status-button',
                    key === 'unobserved' && 'nature-atlas-status-button-unobserved',
                    status === key && 'nature-atlas-status-button-active',
                  )}
                  aria-pressed={status === key}
                  disabled={!progressReady && key !== 'all'}
                  onClick={() => updateFilters({ status: key })}
                >
                  <span>{label}</span>
                  {count !== null ? <span className="nature-atlas-status-count">{count}</span> : null}
                </button>
              )
            })}
          </div>

          <span className="nature-atlas-sort-label" aria-label="当前按名称排序">
            <span>名称排序</span>
            <ArrowDownAZ className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>

        {data.viewer.progressState === 'anonymous' ? (
          <p className="nature-atlas-status-note">
            <Link
              href={`/login?next=${encodeURIComponent(buildSpeciesHref({ query, topic, status: requestedStatus }))}`}
              className="font-semibold text-primary hover:underline"
            >登录</Link> 后可筛选已观察物种。
          </p>
        ) : null}
        {data.viewer.progressState === 'unavailable' || refreshError ? (
          <p className="nature-atlas-status-note nature-atlas-status-note-warning">
            观察状态暂时不可用，物种仍可正常浏览。
            <button type="button" className="ml-1 font-semibold underline underline-offset-2" onClick={refreshAtlas} disabled={isRefreshing}>
              {isRefreshing ? '重试中' : '重试'}
            </button>
          </p>
        ) : null}
      </section>

      <p className="sr-only" aria-live="polite">当前显示 {visibleCount} 个物种</p>

      <div className="nature-atlas-results mt-2 md:mt-8">
        <div className="nature-atlas-results-main space-y-8 md:space-y-10">
          {filteredGroups.map((group) => (
            <section
              key={group.key}
              className="nature-atlas-group"
              aria-labelledby={!isTopicView ? `species-atlas-${group.key}` : undefined}
              aria-label={isTopicView ? group.label : undefined}
            >
              {!isTopicView ? (
                <div className="nature-atlas-group-heading">
                  <div className="min-w-0">
                    <h2 id={`species-atlas-${group.key}`} className="text-base font-semibold text-foreground md:text-lg">
                      {group.label}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      共 {group.total} 个物种
                    </p>
                  </div>
                </div>
              ) : null}

              {isTopicView ? (
                letterGroups.length > 0 ? (
                  <div className="space-y-6">
                    {letterGroups.map((letterGroup) => {
                      const letterId = buildSpeciesLetterId(topic, letterGroup.initial)

                      return (
                        <section key={letterGroup.initial} id={letterId} className="nature-atlas-letter-group" aria-labelledby={`${letterId}-heading`}>
                          <div className="nature-atlas-letter-heading">
                            <h2 id={`${letterId}-heading`}>{letterGroup.initial}</h2>
                          </div>
                          {renderTileGrid(letterGroup.items, `${group.label}${getSpeciesLetterLabel(letterGroup.initial)}`)}
                        </section>
                      )
                    })}
                  </div>
                ) : (
                  <p className="nature-atlas-empty">当前筛选下没有匹配物种</p>
                )
              ) : group.items.length > 0 ? (
                renderTileGrid(group.items, `${group.label}物种`)
              ) : (
                <p className="nature-atlas-empty">当前筛选下没有匹配物种</p>
              )}
            </section>
          ))}
        </div>

        {isTopicView && letterGroups.length > 0 ? (
          <nav className="nature-atlas-index" aria-label="按名称首字母跳转">
            {SPECIES_ALPHABET.map((letter) => {
              const active = availableLetters.has(letter)
              const letterId = buildSpeciesLetterId(topic, letter)

              return active ? (
                <a key={letter} href={`#${letterId}`} className="nature-atlas-index-link" aria-label={`跳转到${getSpeciesLetterLabel(letter)}`}>
                  {letter}
                </a>
              ) : (
                <span key={letter} className="nature-atlas-index-link nature-atlas-index-link-disabled" aria-hidden="true">
                  {letter}
                </span>
              )
            })}
          </nav>
        ) : null}
      </div>

      {!isTopicView && filteredGroups.every((group) => group.items.length === 0) ? (
        <div className="nature-atlas-empty-all">
          <Search className="h-5 w-5" aria-hidden="true" />
          <span>没有找到匹配的物种</span>
          <button type="button" onClick={() => updateFilters({ query: '', topic: 'all', status: 'all' })}>
            清除筛选
          </button>
        </div>
      ) : null}
    </div>
  )
}
