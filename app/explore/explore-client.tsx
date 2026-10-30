"use client"

import filterMotion from './explore-filter-motion.module.css'
import { ExploreSearchOverlay } from '@/components/explore/explore-search-overlay'
import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, memo, type FormEvent, type MouseEvent, type ComponentProps } from 'react'
import { buildExplorePageHref } from '@/lib/seo/explore-pagination'
import { useSearchParams } from 'next/navigation'
import {
    Filter,
    Search,
    Sparkles,
    X,
} from 'lucide-react'
import {
    EXPLORE_PROJECT_CARD_CLASS,
    EXPLORE_PROJECT_GRID_CLASS,
} from '@/components/features/compact-project-grid-styles'
import { ProjectCard } from '@/components/features/project-card'
import { useProjects } from '@/lib/context/project-context'
import { useSyncProjectInteractions } from '@/hooks/use-sync-project-interactions'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'
import type { ExploreTagScope } from '@/lib/api/explore-data'
import { normalizeDifficultyParam, parseAgeParam } from '@/lib/content-classification/validation'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
import {
    buildExploreFiltersKey,
    clearExploreScrollRestore,
    readExploreScrollRestore,
    saveExploreScrollRestore,
    type ExploreScrollRestoreState,
} from '@/lib/explore-scroll-restore'
import { buildExploreProjectContext, saveExploreProjectContext } from '@/lib/explore/project-navigation-context'
import {
    EXPLORE_TOPICS,
    EVERYDAY_MATERIALS_TAG,
    EXPLORE_RESULTS_SORT_OPTIONS,
    normalizeExploreThemeTags,
    toggleExploreTopicTag,
    isExploreResultsMode,
    parseExploreSortBy,
    serializeExploreFilterParams,
    type SortBy,
} from '@/lib/explore/presets'

// Opening filters should not rerender unchanged project cards behind the dialog.
const ExploreProjectCard = memo(ProjectCard)

const EXPLORE_LOAD_MORE_PLACEHOLDER_COUNT = 12

/** Keep a 44px hit target around a lighter, compact condition label. */
function ExploreConditionChip({ children, className, ...props }: ComponentProps<typeof FilterChip>) {
    return (
        <FilterChip {...props} className={cn('min-h-11 border-transparent! bg-transparent! px-0 py-2 font-normal shadow-none!', className)}>
            <span className="inline-flex min-h-7 min-w-0 items-center gap-1 rounded-full bg-[hsl(var(--brand-blue)/0.06)] px-2.5 py-1 text-xs font-normal leading-5 text-[hsl(var(--brand-blue))]">
                {children}
            </span>
        </FilterChip>
    )
}

function mergeUniqueProjectsById(existing: Project[], incoming: Project[]): Project[] {
    if (incoming.length === 0) {
        return existing
    }

    const seen = new Set(existing.map((project) => String(project.id)))
    const appended: Project[] = []

    for (const project of incoming) {
        const id = String(project.id)
        if (seen.has(id)) {
            continue
        }
        seen.add(id)
        appended.push(project)
    }

    if (appended.length === 0) {
        return existing
    }

    return [...existing, ...appended]
}

// 类别配置：主分类 -> 子分类映射
import { CATEGORY_CONFIG } from '@/lib/config/categories'
import { ExploreCategoryStrip } from '@/components/explore/explore-category-strip'
import { HouseholdMaterialPicker } from '@/components/explore/household-material-picker'
import { matchProjectMaterials, normalizeOwnedMaterialIds, sortProjectsByMaterials } from '@/lib/explore/material-matching'

const OWNED_MATERIALS_STORAGE_KEY = 'steamx:owned-materials:v1'

// 难度选项
const DIFFICULTY_OPTIONS = [
    { value: "all", label: "全部" },
    { value: "beginner", label: "入门" },
    { value: "intermediate", label: "进阶" },
    { value: "challenge", label: "挑战" },
]

const defaultCategories = ["全部", "科学", "技术", "工程", "艺术", "数学", "其他"]
function normalizeSortBy(value: string | null | undefined): SortBy {
    return parseExploreSortBy(value)
}

/** 仅依据 URL：无 `sortBy` 时使用默认热门推荐。 */
function sortFromSearchParam(raw: string | null): SortBy {
    if (raw === null || raw === '') return normalizeSortBy(undefined)
    return normalizeSortBy(raw)
}

interface ExploreClientProps {
    initialProjects: Project[]
    initialHasMore: boolean
    initialTotal?: number
    initialPage?: number
    categories?: string[]
    availableTags?: string[]
    popularTags?: string[]
    tagScope?: ExploreTagScope
    initialFiltersKey?: string
}

export function ExploreClient({
    initialProjects,
    initialHasMore,
    initialTotal = 0,
    initialPage = 0,
    categories: propCategories,
    initialFiltersKey,
}: ExploreClientProps) {
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const { clearLikesDeltaForProjects } = useProjects()

    const displayCategories = propCategories || defaultCategories

    // 从 URL 初始化状态
    const initialQuery = searchParams.get("q") || ""
    const initialCategory = searchParams.get("category") || "全部"
    const initialSubCategory = searchParams.get("subCategory") || ""
    const initialDifficulty = normalizeDifficultyParam(searchParams.get("difficulty")) || "all"
    const initialAge = parseAgeParam(searchParams.get("age"))
    const initialTags = normalizeExploreThemeTags(searchParams.get("tags"))
    const initialSort = sortFromSearchParam(searchParams.get("sortBy"))

    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [resultTotal, setResultTotal] = useState(initialTotal)
    const projectIdsForSync = useMemo(() => projects.map((project) => project.id), [projects])
    useSyncProjectInteractions(projectIdsForSync)
    const [page, setPage] = useState(initialPage + 1)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isFiltering, setIsFiltering] = useState(false)
    const observer = useRef<IntersectionObserver | null>(null)
    const activeFilterRequest = useRef<AbortController | null>(null)
    const activeLoadMoreRequest = useRef<AbortController | null>(null)
    const activeRestoreRequest = useRef<AbortController | null>(null)
    const pageRef = useRef(initialPage + 1)
    const hasMoreRef = useRef(initialHasMore)
    const isLoadingMoreRef = useRef(false)
    const isFilteringRef = useRef(false)
    const pendingScrollRestoreRef = useRef<ExploreScrollRestoreState | null>(null)
    const isRestoringScrollRef = useRef(false)
    const [isRestoringScroll, setIsRestoringScroll] = useState(false)
    const [restoreError, setRestoreError] = useState(false)
    const activeFiltersKeyRef = useRef('')
    const filterRequestGenerationRef = useRef(0)
    const initializedFiltersKeyRef = useRef(false)
    const restoreGenerationRef = useRef(0)

    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory)
    const [selectedDifficulty, setSelectedDifficulty] = useState(initialDifficulty)
    const [selectedAge, setSelectedAge] = useState<number | null>(initialAge)
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
    const [searchQuery, setSearchQuery] = useState(initialQuery)
    const [searchDraft, setSearchDraft] = useState(initialQuery)
    const [searchOverlayOpen, setSearchOverlayOpen] = useState(false)
    const closeSearchOverlay = useCallback(() => setSearchOverlayOpen(false), [])
    const searchComposingRef = useRef(false)
    const searchDraftRevisionRef = useRef(0)
    const searchDraftDirtyRef = useRef(false)
    const internalUrlFiltersKeyRef = useRef<string | null>(null)
    const sheetTriggerRef = useRef<HTMLElement | null>(null)
    const filterPanelRef = useRef<HTMLDivElement | null>(null)
    const [selectedSortBy, setSelectedSortBy] = useState<SortBy>(initialSort)
    const [ownedMaterialIds, setOwnedMaterialIds] = useState<string[]>([])
    const showMaterials = selectedTags.includes(EVERYDAY_MATERIALS_TAG)
    const displayedProjects = useMemo(
        () => showMaterials ? sortProjectsByMaterials(projects, ownedMaterialIds) : projects,
        [projects, ownedMaterialIds, showMaterials],
    )
    const matchedProjectCount = showMaterials ? displayedProjects.filter((project) => {
        const match = matchProjectMaterials(project.materials, ownedMaterialIds, project.householdRequirements)
        return match?.hasSelection && match.missingLabels.length === 0 && !match.pendingLabels?.length
    }).length : 0

    useLayoutEffect(() => {
        try {
            setOwnedMaterialIds(normalizeOwnedMaterialIds(JSON.parse(sessionStorage.getItem(OWNED_MATERIALS_STORAGE_KEY) || '[]')))
        } catch {
            // Storage may be unavailable; selection still works for this visit.
        }
    }, [])

    const updateOwnedMaterials = (ids: string[]) => {
        const next = normalizeOwnedMaterialIds(ids)
        setOwnedMaterialIds(next)
        try {
            sessionStorage.setItem(OWNED_MATERIALS_STORAGE_KEY, JSON.stringify(next))
        } catch {
            // Keep the interactive selection usable when storage is disabled.
        }
    }

    // Sheet 状态
    const [sheetOpen, setSheetOpen] = useState(false)
    const [draftSubCategory, setDraftSubCategory] = useState(selectedSubCategory)
    const [draftDifficulty, setDraftDifficulty] = useState(selectedDifficulty)
    const [draftAge, setDraftAge] = useState<number | null>(selectedAge)

    useEffect(() => {
        pageRef.current = page
        hasMoreRef.current = hasMore
        isLoadingMoreRef.current = isLoadingMore
        isFilteringRef.current = isFiltering
    }, [page, hasMore, isLoadingMore, isFiltering])

    useEffect(() => {
        if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return
        const previous = window.history.scrollRestoration
        window.history.scrollRestoration = 'manual'
        return () => {
            window.history.scrollRestoration = previous
        }
    }, [])

    useEffect(() => {
        const nextQuery = searchParams.get("q") || ""
        const nextCategory = searchParams.get("category") || "全部"
        const nextSubCategory = searchParams.get("subCategory") || ""
        const nextDifficulty = normalizeDifficultyParam(searchParams.get("difficulty")) || "all"
        const nextAge = parseAgeParam(searchParams.get("age"))
        const nextTags = normalizeExploreThemeTags(searchParams.get("tags"))
        const nextSortBy = sortFromSearchParam(searchParams.get("sortBy"))

        const nextFiltersKey = serializeExploreFilterParams(new URLSearchParams(searchParams.toString()))
        const isInternalUrlUpdate = internalUrlFiltersKeyRef.current === nextFiltersKey
        if (isInternalUrlUpdate) internalUrlFiltersKeyRef.current = null

        setSearchQuery(nextQuery)
        if (!isInternalUrlUpdate) {
            setSearchDraft(nextQuery)
            searchDraftDirtyRef.current = false
        }
        setSelectedCategory(nextCategory)
        setSelectedSubCategory(nextSubCategory)
        setSelectedDifficulty(nextDifficulty)
        setSelectedAge(nextAge)
        setSelectedTags(nextTags)
        setSelectedSortBy(nextSortBy)
    }, [searchParams])

    useEffect(() => {
        return () => {
            activeFilterRequest.current?.abort()
            activeLoadMoreRequest.current?.abort()
            activeRestoreRequest.current?.abort()
            observer.current?.disconnect()
        }
    }, [])

    const isAbortError = useCallback((error: unknown) => {
        return (error instanceof DOMException && error.name === 'AbortError')
            || (error instanceof Error && error.name === 'AbortError')
    }, [])

    const sheetSubCategories = useMemo(() => (
        selectedCategory === "全部"
            ? []
            : CATEGORY_CONFIG[selectedCategory] || []
    ), [selectedCategory])

    const getFilterState = useCallback(() => ({
        category: selectedCategory,
        subCategory: selectedSubCategory,
        difficulty: selectedDifficulty,
        age: selectedAge,
        tags: selectedTags,
        searchQuery,
        sortBy: selectedSortBy,
    }), [selectedCategory, selectedSubCategory, selectedDifficulty, selectedAge, selectedTags, searchQuery, selectedSortBy])

    const buildSearchParams = useCallback((overrides: {
        query?: string
        category?: string
        subCategory?: string
        difficulty?: string
        age?: number | null
        tags?: string[]
        sortBy?: SortBy
    } = {}) => {
        const params = new URLSearchParams()
        const query = overrides.query ?? searchQuery
        const category = overrides.category ?? selectedCategory
        const subCategory = overrides.subCategory ?? selectedSubCategory
        const difficulty = overrides.difficulty ?? selectedDifficulty
        const age = overrides.age !== undefined ? overrides.age : selectedAge
        const tags = overrides.tags ?? selectedTags
        const sortBy = overrides.sortBy ?? selectedSortBy

        if (query) params.set('q', query)
        if (category !== '全部') params.set('category', category)
        if (subCategory) params.set('subCategory', subCategory)
        if (difficulty !== 'all') params.set('difficulty', difficulty)
        if (age !== null && Number.isInteger(age) && age >= 3 && age <= 16) params.set('age', String(age))
        if (tags.length > 0) params.set('tags', tags.join(','))
        if (sortBy !== 'popular') params.set('sortBy', sortBy)

        return params
    }, [searchQuery, selectedCategory, selectedSubCategory, selectedDifficulty, selectedAge, selectedTags, selectedSortBy])

    const saveExploreScrollPosition = useCallback((anchor?: { projectId: string; top: number }) => {
        if (typeof window === 'undefined') return

        saveExploreScrollRestore({
            filtersKey: buildExploreFiltersKey(buildSearchParams()),
            scrollY: window.scrollY || document.documentElement.scrollTop || 0,
            nextPage: pageRef.current,
            ...(anchor
                ? { anchorProjectId: anchor.projectId, anchorTop: anchor.top }
                : {}),
        })
    }, [buildSearchParams])

    const handleExploreProjectLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const link = target.closest('a[href^="/project/"]')
        if (!(link instanceof HTMLAnchorElement)) return

        const match = link.getAttribute('href')?.match(/^\/project\/([^/?#]+)/)
        const projectId = match?.[1]
        const card = link.closest('[data-explore-project-id]')
            || (projectId
                ? document.querySelector(`[data-explore-project-id="${CSS.escape(projectId)}"]`)
                : null)
        const top = card instanceof HTMLElement ? card.getBoundingClientRect().top : 0

        saveExploreScrollPosition(
            projectId
                ? { projectId, top }
                : undefined,
        )

        const index = projectId ? displayedProjects.findIndex((project) => String(project.id) === projectId) : -1
        const filterParams = buildSearchParams()
        const exploreHref = filterParams.size > 0 ? `/explore?${filterParams.toString()}` : '/explore'
        saveExploreProjectContext(index >= 0 ? buildExploreProjectContext(displayedProjects, index, exploreHref) : null)
    }, [buildSearchParams, displayedProjects, saveExploreScrollPosition])

    useLayoutEffect(() => {
        if (initializedFiltersKeyRef.current) return
        initializedFiltersKeyRef.current = true
        activeFiltersKeyRef.current = serializeExploreFilterParams(buildSearchParams())
    }, [buildSearchParams])

    useLayoutEffect(() => {
        const saved = readExploreScrollRestore()
        if (!saved) return

        const filtersKey = buildExploreFiltersKey(buildSearchParams())
        if (saved.filtersKey !== filtersKey) {
            clearExploreScrollRestore()
            return
        }

        // Keep sessionStorage until restore finishes so remounts / effect re-runs don't lose it.
        pendingScrollRestoreRef.current = saved
        // 仅在从详情页返回时读取一次 session 恢复点
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const filtersKey = buildExploreFiltersKey(buildSearchParams())
        const stored = pendingScrollRestoreRef.current ?? readExploreScrollRestore()
        const hasSavedScroll = stored?.filtersKey === filtersKey
        if (stored && !hasSavedScroll) {
            clearExploreScrollRestore()
            pendingScrollRestoreRef.current = null
        }
        // Browser forward/back and unavailable storage can restore a cached RSC
        // payload without a scroll checkpoint. Data still needs the same guard.
        const saved = hasSavedScroll ? stored : (
            initialFiltersKey !== undefined && initialFiltersKey !== filtersKey
                ? { filtersKey, scrollY: 0, nextPage: 1 }
                : null
        )
        if (!saved) return

        pendingScrollRestoreRef.current = saved
        let cancelled = false
        isRestoringScrollRef.current = true
        setIsRestoringScroll(true)
        const retryTimers: number[] = []
        const restoreGeneration = restoreGenerationRef.current
        const isCurrentRestore = () => !cancelled && restoreGenerationRef.current === restoreGeneration
        const restoreController = new AbortController()
        activeRestoreRequest.current = restoreController

        const applyScroll = () => {
            if (!isCurrentRestore() || typeof window === 'undefined') return

            const anchor = saved.anchorProjectId
                ? document.querySelector<HTMLElement>(
                    `[data-explore-project-id="${CSS.escape(saved.anchorProjectId)}"]`,
                )
                : null

            if (anchor && typeof saved.anchorTop === 'number') {
                window.scrollTo({
                    top: Math.max(0, window.scrollY + anchor.getBoundingClientRect().top - saved.anchorTop),
                    left: 0,
                    behavior: 'auto',
                })
            } else {
                window.scrollTo({ top: saved.scrollY, left: 0, behavior: 'auto' })
            }
        }

        const finishRestore = () => {
            if (!isCurrentRestore()) return
            clearExploreScrollRestore()
            pendingScrollRestoreRef.current = null
            isRestoringScrollRef.current = false
            setIsRestoringScroll(false)
        }

        const restoreScroll = () => {
            if (!hasSavedScroll) {
                finishRestore()
                return
            }
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!isCurrentRestore()) return
                    applyScroll()
                    // Layout can still shift after cards/images paint; nudge a few times.
                    for (const delay of [50, 150, 320]) {
                        retryTimers.push(window.setTimeout(() => {
                            if (!isCurrentRestore()) return
                            applyScroll()
                            if (delay === 320) finishRestore()
                        }, delay))
                    }
                })
            })
        }

        const syncRestoredProjects = (nextProjects: Project[], nextHasMore: boolean, nextPage: number, nextTotal?: number) => {
            if (!isCurrentRestore()) return
            setProjects(nextProjects)
            clearLikesDeltaForProjects(nextProjects.map((project) => project.id))
            setHasMore(nextHasMore)
            hasMoreRef.current = nextHasMore
            setPage(nextPage)
            pageRef.current = nextPage
            if (typeof nextTotal === 'number') setResultTotal(nextTotal)
            restoreScroll()
        }

        const serverMatchesFilters = initialFiltersKey === filtersKey
        const basePage = serverMatchesFilters ? initialPage : -1
        const baseProjects = serverMatchesFilters ? initialProjects : []
        const baseHasMore = serverMatchesFilters ? initialHasMore : true
        const baseTotal = serverMatchesFilters ? initialTotal : undefined
        if (!serverMatchesFilters) {
            setProjects([])
            setResultTotal(0)
        }

        if (saved.nextPage <= basePage + 1 && serverMatchesFilters) {
            syncRestoredProjects(initialProjects, initialHasMore, saved.nextPage)
            return () => {
                cancelled = true
                for (const id of retryTimers) window.clearTimeout(id)
                isRestoringScrollRef.current = false
                setIsRestoringScroll(false)
            }
        }

        void (async () => {
            const pagesToRestore = Array.from(
                { length: Math.max(0, saved.nextPage - (basePage + 1)) },
                (_, index) => basePage + 1 + index,
            )
            const baseParams = buildSearchParams()
            const pageResults = await Promise.allSettled(
                pagesToRestore.map(async (page) => {
                    if (cancelled) return { page, projects: [] as Project[], hasMore: true }

                    const params = new URLSearchParams(baseParams)
                    params.set('page', String(page))
                    const response = await fetch(`/api/projects?${params.toString()}`, {
                        signal: restoreController.signal,
                    })
                    if (!response.ok) {
                        throw new Error(await response.text())
                    }

                    const data = await response.json()
                    return {
                        page,
                        projects: (data.projects as Project[]) || [],
                        hasMore: Boolean(data.hasMore),
                        total: typeof data.total === 'number' ? data.total : undefined,
                    }
                }),
            )

            if (!isCurrentRestore()) return

            let mergedProjects = [...baseProjects]
            let nextHasMore = baseHasMore
            let nextTotal = baseTotal
            let nextPage = basePage + 1
            let failed = false

            for (const result of pageResults) {
                if (result.status !== 'fulfilled') {
                    nextHasMore = true
                    failed = true
                    break
                }
                mergedProjects = mergeUniqueProjectsById(mergedProjects, result.value.projects)
                nextHasMore = result.value.hasMore
                nextTotal = result.value.total ?? nextTotal
                nextPage = result.value.page + 1
            }

            setRestoreError(failed)
            syncRestoredProjects(mergedProjects, nextHasMore, nextPage, nextTotal)
        })()

        return () => {
            cancelled = true
            restoreController.abort()
            if (activeRestoreRequest.current === restoreController) {
                activeRestoreRequest.current = null
            }
            for (const id of retryTimers) window.clearTimeout(id)
            isRestoringScrollRef.current = false
            setIsRestoringScroll(false)
        }
        // Intentionally mount-once: remount / prop identity churn must not drop the restore payload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return

        let timeoutId: number | null = null
        const onScroll = () => {
            if (isRestoringScrollRef.current) return
            if (timeoutId !== null) return
            timeoutId = window.setTimeout(() => {
                timeoutId = null
                saveExploreScrollPosition()
            }, 150)
        }

        window.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('scroll', onScroll)
            if (timeoutId !== null) window.clearTimeout(timeoutId)
        }
    }, [saveExploreScrollPosition])

    // Project links stay canonical (`/project/:id`); list filters + position travel via
    // sessionStorage (see lib/explore/project-navigation-context.ts) instead of `?from=&sourceIndex=`.
    const buildProjectDetailHref = useCallback((projectId: string | number) => `/project/${projectId}`, [])

    const syncUrl = useCallback((params: URLSearchParams) => {
        const nextUrl = params.size > 0 ? `/explore?${params.toString()}` : '/explore'
        internalUrlFiltersKeyRef.current = serializeExploreFilterParams(params)
        window.history.replaceState(null, '', nextUrl)
    }, [])

    const loadMore = useCallback(async () => {
        if (isLoadingMoreRef.current || isFilteringRef.current || isRestoringScrollRef.current || !hasMoreRef.current) return

        activeLoadMoreRequest.current?.abort()
        const controller = new AbortController()
        activeLoadMoreRequest.current = controller
        setIsLoadingMore(true)
        isLoadingMoreRef.current = true
        const params = buildSearchParams()
        params.set('page', String(pageRef.current))

        try {
            const response = await fetch(`/api/projects?${params.toString()}`, {
                signal: controller.signal,
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            const data = await response.json()
            if (controller.signal.aborted || activeLoadMoreRequest.current !== controller) return
            setProjects((prev) => mergeUniqueProjectsById(prev, data.projects))
            setRestoreError(false)
            if (typeof data.total === 'number') setResultTotal(data.total)
            clearLikesDeltaForProjects(data.projects.map((p: Project) => p.id))
            setHasMore(data.hasMore)
            hasMoreRef.current = data.hasMore
            setPage(prev => {
                const nextPage = prev + 1
                pageRef.current = nextPage
                return nextPage
            })
        } catch (error) {
            if (isAbortError(error)) {
                return
            }
            logger.error('Error loading more projects', { error })
            toast({ title: '加载失败', description: '无法加载更多项目，请稍后重试', variant: 'destructive' })
        } finally {
            if (activeLoadMoreRequest.current === controller) {
                activeLoadMoreRequest.current = null
                setIsLoadingMore(false)
                isLoadingMoreRef.current = false
            }
        }
    }, [buildSearchParams, clearLikesDeltaForProjects, isAbortError, toast])

    const lastProjectElementRef = useCallback((node: HTMLDivElement) => {
        if (observer.current) observer.current.disconnect()
        if (isLoadingMore || isFiltering || isRestoringScroll || restoreError) return
        if (!node) return

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMoreRef.current) {
                loadMore()
            }
        })

        observer.current.observe(node)
    }, [isLoadingMore, isFiltering, isRestoringScroll, restoreError, loadMore])

    const executeFilter = useCallback(async (params: URLSearchParams): Promise<boolean> => {
        const filterKey = serializeExploreFilterParams(params)
        if (filterKey === activeFiltersKeyRef.current) {
            activeFilterRequest.current?.abort()
            filterRequestGenerationRef.current += 1
            return true
        }

        restoreGenerationRef.current += 1
        setRestoreError(false)
        pendingScrollRestoreRef.current = null
        isRestoringScrollRef.current = false
        setIsRestoringScroll(false)
        activeRestoreRequest.current?.abort()
        clearExploreScrollRestore()
        activeFilterRequest.current?.abort()
        activeLoadMoreRequest.current?.abort()
        const controller = new AbortController()
        activeFilterRequest.current = controller
        const requestGeneration = ++filterRequestGenerationRef.current

        setIsFiltering(true)
        isFilteringRef.current = true

        try {
            const response = await fetch(`/api/projects?${params.toString()}`, {
                signal: controller.signal,
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            const data = await response.json()
            if (controller.signal.aborted || requestGeneration !== filterRequestGenerationRef.current) {
                return false
            }

            activeFiltersKeyRef.current = filterKey
            setProjects(data.projects)
            clearLikesDeltaForProjects(data.projects.map((p: Project) => p.id))
            setHasMore(data.hasMore)
            hasMoreRef.current = data.hasMore
            if (typeof data.total === 'number') {
                setResultTotal(data.total)
            }
            setPage(1)
            pageRef.current = 1
            syncUrl(params)
            return true

        } catch (error) {
            if (isAbortError(error)) {
                return false
            }
            logger.error('Error fetching projects', { error })
            toast({ title: '加载失败', description: '无法加载项目列表，请稍后重试', variant: 'destructive' })
            return false
        } finally {
            if (activeFilterRequest.current === controller) {
                activeFilterRequest.current = null
                setIsFiltering(false)
                isFilteringRef.current = false
            }
        }
    }, [clearLikesDeltaForProjects, isAbortError, syncUrl, toast])

    const handleCategoryClick = (category: string) => {
        setSelectedCategory(category)
        setSelectedSubCategory("")
        // 分类和主题是两个独立筛选（AND），切换分类保留主题；「全部」只清分类。
        setDraftSubCategory("")
        const params = buildSearchParams({ category, subCategory: "" })
        executeFilter(params)
    }

    const submitSearch = useCallback(async (value: string) => {
        const query = value.trim()
        const revision = searchDraftRevisionRef.current
        const success = await executeFilter(buildSearchParams({ query }))
        if (success) {
            setSearchQuery(query)
            if (revision === searchDraftRevisionRef.current) {
                setSearchDraft(query)
                searchDraftDirtyRef.current = false
            }
        }
    }, [buildSearchParams, executeFilter])

    const clearSearch = useCallback(() => {
        searchDraftRevisionRef.current += 1
        searchDraftDirtyRef.current = true
        setSearchDraft('')
        void submitSearch('')
    }, [submitSearch])

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (searchComposingRef.current) return
        void submitSearch(searchDraft)
    }

    const handleClearFilters = () => {
        setSearchQuery("")
        setSearchDraft("")
        searchDraftDirtyRef.current = false
        setSelectedCategory("全部")
        setSelectedSubCategory("")
        setSelectedDifficulty("all")
        setSelectedAge(null)
        setSelectedTags([])
        setSelectedSortBy("popular")
        setDraftSubCategory("")
        setDraftDifficulty("all")
        setDraftAge(null)
        setResultTotal(0)
        void executeFilter(new URLSearchParams())
    }

    const handleSortChange = (sortBy: SortBy) => {
        if (sortBy === selectedSortBy) return
        setSelectedSortBy(sortBy)
        executeFilter(buildSearchParams({ sortBy }))
    }

    const handleTopicClick = (tag: string) => {
        const nextTags = toggleExploreTopicTag(selectedTags, tag)
        setSelectedTags(nextTags)
        executeFilter(buildSearchParams({ tags: nextTags }))
    }

    const handleRemoveSubCategory = () => {
        setSelectedSubCategory("")
        const params = buildSearchParams({ subCategory: "" })
        executeFilter(params)
    }

    const handleRemoveDifficulty = () => {
        setSelectedDifficulty("all")
        setDraftDifficulty("all")
        const params = buildSearchParams({ difficulty: "all" })
        executeFilter(params)
    }

    const handleRemoveAge = () => {
        setSelectedAge(null)
        setDraftAge(null)
        const params = buildSearchParams({ age: null })
        executeFilter(params)
    }

    // Animate the surface from the trigger while controls keep their natural size.
    const updateFilterMotionOrigin = useCallback(() => {
        const panel = filterPanelRef.current
        const trigger = sheetTriggerRef.current
        if (!panel || !trigger || !window.matchMedia('(max-width: 767px)').matches) return
        const bounds = panel.getBoundingClientRect()
        const origin = trigger.getBoundingClientRect()
        if (!bounds.width || !bounds.height) return
        panel.style.setProperty('--filter-origin-x', `${origin.left - bounds.left}px`)
        panel.style.setProperty('--filter-origin-y', `${origin.top - bounds.top}px`)
        panel.style.setProperty('--filter-origin-scale-x', `${origin.width / bounds.width}`)
        panel.style.setProperty('--filter-origin-scale-y', `${origin.height / bounds.height}`)
    }, [])

    const setFilterPanelRef = useCallback((panel: HTMLDivElement | null) => {
        filterPanelRef.current = panel
        if (panel) updateFilterMotionOrigin()
    }, [updateFilterMotionOrigin])

    useLayoutEffect(() => {
        if (!sheetOpen) return
        updateFilterMotionOrigin()
        window.addEventListener('resize', updateFilterMotionOrigin)
        window.visualViewport?.addEventListener('resize', updateFilterMotionOrigin)
        return () => {
            window.removeEventListener('resize', updateFilterMotionOrigin)
            window.visualViewport?.removeEventListener('resize', updateFilterMotionOrigin)
        }
    }, [sheetOpen, updateFilterMotionOrigin])

    // Sheet 逻辑
    const openSheet = (event?: MouseEvent<HTMLButtonElement>) => {
        if (event?.currentTarget) sheetTriggerRef.current = event.currentTarget
        setDraftSubCategory(selectedSubCategory)
        setDraftDifficulty(selectedDifficulty)
        setDraftAge(selectedAge)
        setSheetOpen(true)
    }

    const handleDraftSubCategoryClick = (sub: string) => {
        setDraftSubCategory(prev => prev === sub ? "" : sub)
    }

    const handleDraftDifficultyClick = (value: string) => {
        setDraftDifficulty(value)
    }

    const handleDraftClearAll = () => {
        setDraftSubCategory("")
        setDraftDifficulty("all")
        setDraftAge(null)
    }

    const handleFilterSheetOpenChange = (open: boolean) => {
        setSheetOpen(open)
    }

    const handleConfirmFilters = () => {
        setSelectedSubCategory(draftSubCategory)
        setSelectedDifficulty(draftDifficulty)
        setSelectedAge(draftAge)
        setSheetOpen(false)

        const params = buildSearchParams({
            subCategory: draftSubCategory,
            difficulty: draftDifficulty,
            age: draftAge,
        })
        executeFilter(params)
    }

    useEffect(() => {
        const raw = searchParams.get('tags')
        if (!raw) return
        const tags = normalizeExploreThemeTags(raw)
        if (tags.join(',') === raw) return
        const params = new URLSearchParams(searchParams.toString())
        if (tags.length) params.set('tags', tags.join(','))
        else params.delete('tags')
        window.history.replaceState(null, '', params.size ? `/explore?${params}` : '/explore')
    }, [searchParams])

    const advancedFilterCount = (selectedSubCategory ? 1 : 0) + (selectedDifficulty !== "all" ? 1 : 0) + (selectedAge !== null ? 1 : 0)
    const isResultsMode = isExploreResultsMode(getFilterState())
    const hasSummaryFilters = !!searchQuery || !!selectedSubCategory || selectedDifficulty !== 'all'
        || selectedAge !== null
    const hasDraftFilters = !!draftSubCategory || draftDifficulty !== "all" || draftAge !== null
    const draftFilterCount = (draftSubCategory ? 1 : 0) + (draftDifficulty !== "all" ? 1 : 0) + (draftAge !== null ? 1 : 0)
    const topicRow = (
        <div className="flex min-w-0 items-start justify-between gap-2 md:gap-4">
            <div role="group" aria-label="快捷主题" className="-mx-1 flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible">
                {EXPLORE_TOPICS.map((topic) => {
                    const tag = topic.tags[0]
                    const isActive = selectedTags.includes(tag)
                    return (
                        <button
                            key={topic.id}
                            type="button"
                            onClick={() => handleTopicClick(tag)}
                            disabled={isFiltering}
                            aria-pressed={isActive}
                            className="inline-flex h-11 shrink-0 items-center rounded-full font-normal focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                            <span className={cn(
                                "inline-flex h-8 items-center justify-center rounded-full border px-3 text-sm font-normal leading-none",
                                isActive
                                    ? "border-[hsl(var(--brand-blue)/0.4)] bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))]"
                                    : "border-[hsl(var(--surface-border))] text-foreground",
                            )}>
                                {topic.label}
                            </span>
                        </button>
                    )
                })}
            </div>
            {!showMaterials ? (
                <Select
                    value={selectedSortBy}
                    onValueChange={(value) => handleSortChange(parseExploreSortBy(value))}
                    disabled={isFiltering}
                >
                    <SelectTrigger
                        aria-label="项目排序"
                        className="h-11 w-auto min-w-11 shrink-0 gap-1 border-0 bg-transparent px-2 font-normal text-muted-foreground shadow-none hover:text-foreground focus:shadow-none! focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
                    >
                        <SelectValue>{selectedSortBy === 'latest' ? '最新' : '推荐'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end" sideOffset={4} className="min-w-36">
                        {EXPLORE_RESULTS_SORT_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value} className="min-h-11 whitespace-nowrap font-normal">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : null}
        </div>
    )
    const getDifficultyLabel = (value: string) => DIFFICULTY_OPTIONS.find(o => o.value === value)?.label || value


    return (
        <div className="app-canvas-explore relative min-h-[calc(100vh-var(--mobile-global-header-height,3rem))] overflow-hidden pb-20 md:min-h-[calc(100vh-4rem)] md:pb-8">
            <MobileGlobalHeader
                variant="search"
                showNotification={false}
                showUserButton={false}
                className="[&_[data-testid=mobile-search-entry]]:h-11 bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.96)_0%,hsl(var(--app-canvas)/0.92)_100%)] md:bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.88)_0%,hsl(var(--app-canvas)/0.72)_100%)] md:backdrop-blur-xl"
                searchValue={searchDraft}
                searchPlaceholder="搜索项目"
                onSearchChange={(value) => {
                    searchDraftRevisionRef.current += 1
                    searchDraftDirtyRef.current = true
                    setSearchDraft(value)
                }}
                onSearchSubmit={(value) => void submitSearch(value)}
                onSearchClear={clearSearch}
                onSearchEntryClick={() => setSearchOverlayOpen(true)}
                rightSlot={
                    <button
                        type="button"
                        onClick={openSheet}
                        data-testid="explore-mobile-filters"
                        aria-label={advancedFilterCount > 0 ? `筛选，已选 ${advancedFilterCount} 项` : '筛选'}
                        className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-normal text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Filter className="h-4 w-4" aria-hidden="true" />
                        筛选
                        {advancedFilterCount > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-1 text-xs text-[hsl(var(--brand-blue))]">{advancedFilterCount}</span> : null}
                    </button>
                }
            />
            <ExploreSearchOverlay
                open={searchOverlayOpen}
                initialValue={searchQuery}
                onClose={closeSearchOverlay}
                onSubmit={(value) => {
                    searchDraftRevisionRef.current += 1
                    setSearchDraft(value)
                    void submitSearch(value)
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--app-canvas))_0%,hsl(var(--surface-raised)/0.98)_45%,hsl(var(--app-canvas-soft))_100%)] md:hidden"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] bg-[linear-gradient(180deg,hsl(var(--app-canvas)/0.98)_0%,hsl(var(--app-canvas-soft)/0.72)_56%,hsl(var(--app-canvas-soft)/0)_100%)] md:block"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] opacity-95 dark:md:hidden md:block"
                style={{
                    backgroundImage: "url('/assets/explore-page-bg-light.webp')",
                    backgroundPosition: 'right top',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'auto 440px',
                    maskImage: 'linear-gradient(to right, transparent 20%, black 80%), linear-gradient(to bottom, black 35%, transparent 78%)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent 20%, black 80%), linear-gradient(to bottom, black 35%, transparent 78%)',
                    maskComposite: 'intersect',
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] opacity-95 dark:md:block"
                style={{
                    backgroundImage: "url('/assets/explore-page-bg-dark.webp')",
                    backgroundPosition: 'right top',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'auto 440px',
                    maskImage: 'linear-gradient(to right, transparent 20%, black 80%), linear-gradient(to bottom, black 35%, transparent 78%)',
                    WebkitMaskImage: 'linear-gradient(to right, transparent 20%, black 80%), linear-gradient(to bottom, black 35%, transparent 78%)',
                    maskComposite: 'intersect',
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[300px] hidden h-[560px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--brand-blue)/0.16),hsl(var(--app-canvas-soft)/0)_64%)] md:block"
            />
            <div className="relative z-10" aria-hidden={sheetOpen}>
                <div className="app-shell-wide min-w-0 pt-1 md:px-8 md:pt-5">
                    <div className="min-w-0">
                        <div className={cn(
                            "relative min-w-0 overflow-hidden md:surface-panel md:rounded-lg",
                            isResultsMode && "md:border-[hsl(var(--surface-border))]",
                        )}>
                            <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3 md:p-5 md:pb-0">
                                <form id="explore-search" onSubmit={handleSearchSubmit}>
                                    <label className="relative block">
                                        <span className="sr-only">搜索项目</span>
                                        <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                                        <input type="search" value={searchDraft}
                                            onCompositionStart={() => { searchComposingRef.current = true }}
                                            onCompositionEnd={() => { searchComposingRef.current = false }}
                                            onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}
                                            onChange={(event) => {
                                                searchDraftRevisionRef.current += 1
                                                searchDraftDirtyRef.current = true
                                                setSearchDraft(event.target.value)
                                            }} placeholder="搜索项目、材料、作者..."
                                            className="control-field h-11 w-full rounded-sm pl-11 pr-11 text-sm font-medium placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden" />
                                        {searchDraft ? <button type="button" aria-label="清空搜索" onClick={clearSearch} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-[hsl(var(--surface-muted))]"><X className="h-3.5 w-3.5" /></button> : null}
                                    </label>
                                </form>
                                <button type="button" onClick={openSheet} data-testid="explore-desktop-filters" className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
                                    <Filter className="h-4 w-4" strokeWidth={2.2} />
                                    <span>筛选</span>
                                    {advancedFilterCount > 0 ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--brand-amber))] px-1 text-[11px] font-bold text-[hsl(var(--brand-amber-foreground))]">{advancedFilterCount}</span> : null}
                                </button>
                            </div>
                            <div className="space-y-2.5 pt-1 max-md:space-y-3 max-md:pt-0 md:px-5 md:pt-4">
                                <span className="hidden text-[13px] font-semibold text-muted-foreground md:block">分类</span>
                                <ExploreCategoryStrip
                                    categories={displayCategories}
                                    selectedCategory={selectedCategory}
                                    disabled={isFiltering}
                                    onSelect={handleCategoryClick}
                                />
                                {topicRow}
                            </div>
                            <div className={cn(
                                "bg-transparent",
                                isResultsMode && "pb-2 pt-0 md:p-5 md:border-b md:border-[hsl(var(--surface-border))]",
                            )}>
                                {isResultsMode ? (
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        {hasSummaryFilters ? <div data-testid="explore-filter-summary" className="flex w-full min-w-0 items-center gap-3 md:flex-1">
                                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 [&_button]:min-h-11 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:break-all">
                                            {searchQuery && (
                                                <ExploreConditionChip
                                                    onClick={() => {
                                                        clearSearch()
                                                    }}
                                                    active
                                                    shape="pill"
                                                >
                                                    {searchQuery}
                                                    <X className="h-3 w-3" />
                                                </ExploreConditionChip>
                                            )}
                                            {selectedSubCategory && (
                                                <ExploreConditionChip
                                                    onClick={handleRemoveSubCategory}
                                                    active
                                                    shape="pill"
                                                >
                                                    {selectedSubCategory}
                                                    <X className="h-3 w-3" />
                                                </ExploreConditionChip>
                                            )}
                                            {selectedDifficulty !== "all" && (
                                                <ExploreConditionChip
                                                    onClick={handleRemoveDifficulty}
                                                    active
                                                    shape="pill"
                                                >
                                                    {getDifficultyLabel(selectedDifficulty)}
                                                    <X className="h-3 w-3" />
                                                </ExploreConditionChip>
                                            )}
                                            {selectedAge !== null && (
                                                <ExploreConditionChip
                                                    onClick={handleRemoveAge}
                                                    active
                                                    shape="pill"
                                                >
                                                    优先 {selectedAge} 岁
                                                    <X className="h-3 w-3" />
                                                </ExploreConditionChip>
                                            )}

                                        </div>

                                            <p aria-live="polite" className="shrink-0 text-xs font-normal text-muted-foreground">
                                                {isFiltering ? '正在查找…' : `${resultTotal} 个项目`}
                                            </p>
                                        </div> : null}
                                    </div>
                                ) : (
                                    <>
                                <h1 className="sr-only">探索</h1>

                                    </>
                                )}
                            </div>

                            <div className={cn(
                                "@container pb-4 pt-0 md:p-5",
                                isResultsMode && "md:pt-4",
                            )}>
                                <div className={cn(
                                    "relative",
                                    !isResultsMode && "pb-5 pt-0.5 md:pb-0 md:pt-0",
                                )}>
                                    {(isFiltering || isRestoringScroll) && (
                                        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))] px-4 py-2 text-xs font-bold text-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-top-3 duration-300 md:bg-[hsl(var(--surface-raised)/0.8)] md:backdrop-blur-md">
                                            <Sparkles className="h-3.5 w-3.5 animate-spin text-[hsl(var(--brand-blue))]" strokeWidth={2.4} aria-hidden="true" />
                                            <span className="tracking-wide text-foreground/90">正在更新项目列表...</span>
                                        </div>
                                    )}

                                    {showMaterials ? (
                                        <HouseholdMaterialPicker selectedIds={ownedMaterialIds} onChange={updateOwnedMaterials} matchedCount={matchedProjectCount} />
                                    ) : null}

                                    <div
                                        data-testid="explore-project-grid"
                                        className={cn(
                                            EXPLORE_PROJECT_GRID_CLASS,
                                            "auto-rows-auto transition-opacity duration-300 max-md:[&_.explore-card>div]:border-transparent max-md:[&_.explore-card>div]:bg-white max-md:dark:[&_.explore-card>div]:bg-white/[0.05]",
                                            isFiltering && "opacity-40 pointer-events-none",
                                        )}
                                        onClickCapture={handleExploreProjectLinkClick}
                                    >
                                        {displayedProjects.map((project, index) => (
                                            <div
                                                key={project.id}
                                                ref={displayedProjects.length === index + 1 ? lastProjectElementRef : undefined}
                                                data-explore-project-id={String(project.id)}
                                                className="h-full"
                                            >
                                                <ExploreProjectCard
                                                    project={project}
                                                    searchQuery={searchQuery}
                                                    priority={index < 2}
                                                    href={buildProjectDetailHref(project.id)}
                                                    scroll={false}
                                                    variant="explore"
                                                    materialMatch={showMaterials ? matchProjectMaterials(project.materials, ownedMaterialIds, project.householdRequirements) : undefined}
                                                    className={EXPLORE_PROJECT_CARD_CLASS}
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    {restoreError && (
                                        <div role="alert" className="mt-4 flex items-center justify-center gap-3 text-sm">
                                            <span>列表恢复失败，请重试。</span>
                                            <Button variant="outline" disabled={isRestoringScroll || isLoadingMore} onClick={() => void loadMore()}>
                                                重试加载
                                            </Button>
                                        </div>
                                    )}

                                    {!showMaterials && <nav aria-label="项目分页" className="flex justify-center gap-5 py-4 text-sm text-muted-foreground">
                                        {selectedSortBy === 'latest' ? (
                                            <>
                                                {page > 1 && (
                                                    <a href={buildExplorePageHref(buildSearchParams(), 0)} className="underline underline-offset-4">第一页</a>
                                                )}
                                                {hasMore && (
                                                    <a href={buildExplorePageHref(buildSearchParams(), page)} className="underline underline-offset-4">下一页</a>
                                                )}
                                            </>
                                        ) : (
                                            <a href={buildExplorePageHref(buildSearchParams({ sortBy: 'latest' }), 0)} className="underline underline-offset-4">按最新发布浏览全部项目</a>
                                        )}
                                    </nav>}

                                    {isLoadingMore && (
                                        <div
                                            data-testid="explore-load-more-placeholder"
                                            aria-busy="true"
                                            aria-live="polite"
                                            className="mt-3"
                                        >
                                            <div className={EXPLORE_PROJECT_GRID_CLASS}>
                                                {Array.from({ length: EXPLORE_LOAD_MORE_PLACEHOLDER_COUNT }, (_, index) => (
                                                    <ProjectCardSkeleton
                                                        key={`skeleton-${index}`}
                                                        variant="explore"
                                                        className={EXPLORE_PROJECT_CARD_CLASS}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!isLoadingMore && !isFiltering && !isRestoringScroll && !restoreError && projects.length === 0 && (
                                        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.72)] px-6 py-14 text-center">
                                            <div className="mb-4 grid h-14 w-14 place-items-center rounded-md bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]">
                                                <Search className="h-7 w-7" />
                                            </div>
                                            <h3 className="text-lg font-semibold">没有找到相关项目</h3>
                                            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                                                换个关键词、类别或减少筛选条件再试试看。
                                            </p>
                                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={handleClearFilters}
                                                >
                                                    {isResultsMode ? '返回探索' : '清除所有筛选'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* 更多筛选 */}
            <Sheet open={sheetOpen} onOpenChange={handleFilterSheetOpenChange}>
                <SheetContent
                    side="right"
                    showClose={false}
                    ref={setFilterPanelRef}
                    overlayClassName={filterMotion.overlay}
                    className={cn("flex max-h-[70vh] flex-col gap-0 rounded-l-md p-0 md:h-[100dvh] md:max-h-none md:w-[440px] md:max-w-[440px]", filterMotion.panel)}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault()
                        const trigger = sheetTriggerRef.current
                        if (trigger && trigger.isConnected && !trigger.hasAttribute('disabled')) {
                            window.requestAnimationFrame(() => trigger.focus())
                        }
                    }}
                >
                    <SheetHeader className="shrink-0 space-y-0 px-5 pb-4 pt-6 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-3">
                                <SheetTitle className="text-lg font-semibold">筛选项目</SheetTitle>
                                {hasDraftFilters ? <span className="text-xs text-muted-foreground">已选 {draftFilterCount} 项</span> : null}
                            </div>
                            <button
                                type="button"
                                onClick={handleDraftClearAll}
                                className={cn(
                                    "hidden min-h-11 px-2 text-sm text-muted-foreground hover:text-foreground md:inline-flex md:items-center",
                                    !hasDraftFilters && "invisible"
                                )}
                            >
                                重置
                            </button>
                            <button
                                type="button"
                                aria-label="关闭筛选"
                                onClick={() => handleFilterSheetOpenChange(false)}
                                className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                            >
                                <X className="h-5 w-5" aria-hidden="true" />
                            </button>
                        </div>
                    </SheetHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
                        <div className="space-y-6 pb-4">
                            {sheetSubCategories.length > 0 && (
                                <div className="space-y-3">
                                    <span className="text-sm font-medium">子分类</span>
                                    <div className="flex flex-wrap gap-2">
                                        {sheetSubCategories.map((sub) => (
                                            <FilterChip
                                                key={sub}
                                                onClick={() => handleDraftSubCategoryClick(sub)}
                                                active={draftSubCategory === sub}
                                                aria-pressed={draftSubCategory === sub}
                                                shape="pill"
                                                size="md"
                                                className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                            >
                                                {sub}
                                            </FilterChip>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <span className="text-sm font-medium">难度等级</span>
                                <div className="flex flex-wrap gap-2">
                                    {DIFFICULTY_OPTIONS.map((option) => (
                                        <FilterChip
                                            key={option.value}
                                            onClick={() => handleDraftDifficultyClick(option.value)}
                                            active={draftDifficulty === option.value}
                                            aria-pressed={draftDifficulty === option.value}
                                            shape="pill"
                                            size="md"
                                            className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                        >
                                            {option.label}
                                        </FilterChip>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label htmlFor="explore-child-age" className="text-sm font-medium">孩子年龄</label>
                                    <p id="explore-child-age-hint" className="text-xs leading-5 text-muted-foreground">优先显示适合该年龄的项目，不排除其他项目</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={3}
                                        max={16}
                                        step={1}
                                        value={draftAge ?? ''}
                                        onChange={(event) => setDraftAge(parseAgeParam(event.target.value))}
                                        placeholder="3–16"
                                        id="explore-child-age"
                                        aria-describedby="explore-child-age-hint"
                                        className="h-11 w-32 rounded-sm"
                                    />
                                    <span className="text-sm text-muted-foreground">岁</span>
                                    {draftAge !== null ? (
                                        <button
                                            type="button"
                                            onClick={() => setDraftAge(null)}
                                            className="min-h-11 px-2 text-sm font-medium text-[hsl(var(--brand-blue))]"
                                        >
                                            清除
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="shrink-0 border-t border-[hsl(var(--surface-border))] bg-background px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="hidden h-11 flex-1 md:inline-flex"
                                onClick={() => handleFilterSheetOpenChange(false)}
                            >
                                取消
                            </Button>
                            <Button
                                variant="outline"
                                className="h-11 flex-1 md:hidden"
                                onClick={handleDraftClearAll}
                                disabled={!hasDraftFilters}
                            >
                                重置
                            </Button>
                            <Button
                                className="h-11 flex-1"
                                onClick={handleConfirmFilters}
                            >
                                查看结果
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
