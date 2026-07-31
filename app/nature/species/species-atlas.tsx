'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
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

export function SpeciesAtlas({ initialData, initialQuery = '', initialTopic, initialStatus }: SpeciesAtlasProps) {
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
  const filtersKey = useMemo(() => buildSpeciesAtlasFiltersKey(filters), [filters])
  const fromHref = useMemo(() => buildSpeciesHref(filters), [filters])

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

  return (
    <div className="app-shell-wide pb-24 pt-0 md:px-8 md:pb-12 md:pt-8">
      <MobilePageHeader title="自然观察" fallbackHref="/nature" />

      <section className="nature-atlas-toolbar" aria-label="物种筛选">
        <form onSubmit={handleSearchSubmit} className="nature-atlas-search-form">
          <label className="sr-only" htmlFor="species-atlas-search">搜索物种</label>
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id="species-atlas-search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="搜索名称、学名、科属或别名"
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
          <Button type="submit" tone="brand" size="sm" className="h-9 shrink-0 px-3.5">
            搜索
          </Button>
        </form>

        <div className="nature-atlas-filter-row">
          <div className="nature-atlas-topic-filters" aria-label="专题筛选">
            {(['all', ...data.groups.map((group) => group.key)] as SpeciesAtlasTopicFilter[]).map((key) => {
              const Icon = TOPIC_ICONS[key]
              const label = key === 'all' ? '全部' : getTopicSummaryLabel(key)
              return (
                <button
                  key={key}
                  type="button"
                  className={cn('nature-atlas-filter-button', topic === key && 'nature-atlas-filter-button-active')}
                  aria-pressed={topic === key}
                  onClick={() => updateFilters({ topic: key })}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {label}
                </button>
              )
            })}
          </div>

          <div className="nature-atlas-status-filters" aria-label="观察状态筛选">
            {STATUS_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={cn(
                  'nature-atlas-filter-button',
                  key === 'unobserved' && 'nature-atlas-filter-button-warm',
                  status === key && 'nature-atlas-filter-button-active',
                )}
                aria-pressed={status === key}
                disabled={!progressReady}
                onClick={() => updateFilters({ status: key })}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {data.viewer.progressState === 'anonymous' ? (
          <p className="nature-atlas-status-note">
            <Link href="/login?next=%2Fnature%2Fspecies" className="font-semibold text-primary hover:underline">登录</Link> 后可筛选已观察物种。
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

      <div className="mt-6 space-y-8 md:mt-8 md:space-y-10">
        {filteredGroups.map((group) => (
          <section key={group.key} className="nature-atlas-group" aria-labelledby={`species-atlas-${group.key}`}>
            <div className="nature-atlas-group-heading">
              <div className="min-w-0">
                <h2
                  id={`species-atlas-${group.key}`}
                  className={cn('text-base font-semibold text-foreground md:text-lg', isTopicView && 'sr-only')}
                >
                  {group.label}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  共 {group.total} 个物种
                </p>
              </div>
              {topic !== group.key ? (
                <Link href={buildSpeciesHref({ query, topic: group.key, status: progressReady ? status : 'all' })} className="nature-atlas-group-link">
                  查看专题
                </Link>
              ) : null}
            </div>

            {group.items.length > 0 ? (
              <ul className="nature-atlas-grid" aria-label={`${group.label}物种`}>
                {group.items.map((item) => (
                  <li key={item.id}>
                    <SpeciesAtlasTile item={item} fromHref={fromHref} filtersKey={filtersKey} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nature-atlas-empty">当前筛选下没有匹配物种</p>
            )}
          </section>
        ))}
      </div>

      {filteredGroups.every((group) => group.items.length === 0) ? (
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
