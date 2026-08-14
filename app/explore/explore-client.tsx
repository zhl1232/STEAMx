"use client"

import { Fragment, useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, type FormEvent, type MouseEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
    ArrowLeft,
    BarChart3,
    ChevronRight,
    Filter,
    Lightbulb,
    Search,
    Sparkles,
    Target,
    Trophy,
    UserCircle,
    X,
} from 'lucide-react'
import {
    COMPACT_VERTICAL_PROJECT_CARD_CLASS,
    COMPACT_VERTICAL_PROJECT_GRID_CLASS,
} from '@/components/features/compact-project-grid-styles'
import { ProjectCard } from '@/components/features/project-card'
import { Progress } from '@/components/ui/progress'
import { useProjects } from '@/lib/context/project-context'
import { useSyncProjectInteractions } from '@/hooks/use-sync-project-interactions'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { Surface } from '@/components/ui/surface'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'
import type { ExploreTagScope } from '@/lib/api/explore-data'
import { useAuth } from '@/lib/context/auth-context'
import { useGamification } from '@/lib/context/gamification-context'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
import {
    buildExploreFiltersKey,
    clearExploreScrollRestore,
    readExploreScrollRestore,
    saveExploreScrollRestore,
    type ExploreScrollRestoreState,
} from '@/lib/explore-scroll-restore'
import {
    EXPLORE_PRESETS,
    EXPLORE_RESULTS_SORT_OPTIONS,
    detectActivePreset,
    getPresetHintLabel,
    isExploreResultsMode,
    parseExploreSortBy,
    serializeExploreFilterParams,
    type ExplorePresetId,
    type SortBy,
} from '@/lib/explore/presets'

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
import { CATEGORY_CONFIG, CATEGORY_META } from '@/lib/config/categories'
import { categoryToneClasses } from '@/components/ui/tone-badge'

// 难度选项
const DIFFICULTY_OPTIONS = [
    { value: "all", label: "全部" },
    { value: "1-2", label: "1-2星" },
    { value: "1", label: "1星" },
    { value: "2", label: "2星" },
    { value: "3", label: "3星" },
    { value: "4", label: "4星" },
    { value: "5", label: "5星" },
]

const defaultCategories = ["全部", "科学", "技术", "工程", "艺术", "数学", "其他"]
const SHEET_HOT_TAGS_LIMIT = 20
const EMPTY_TAGS: string[] = []
const EMPTY_TAG_SCOPE: ExploreTagScope = {
    all: [],
    byCategory: {},
    bySubCategory: {},
}

function ExplorationProgressCard({ suggestedPresetId }: { suggestedPresetId: Exclude<ExplorePresetId, 'browse'> }) {
    const { user, loading } = useAuth()
    const {
        level,
        progress,
        levelProgress,
        levelTotalNeeded,
        unlockedBadges,
        userStats,
    } = useGamification()
    const suggestedLabel = getPresetHintLabel(suggestedPresetId)

    if (!user) {
        return (
            <Surface className="border-[hsl(var(--tone-tech-border))] bg-[hsl(var(--tone-tech-soft))] p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-base font-bold text-[hsl(var(--tone-tech))]">
                            <BarChart3 className="h-[18px] w-[18px]" />
                            保存你的探索进度
                        </h2>
                        <p className="mt-3 text-xs leading-5 text-[hsl(var(--tone-tech))] opacity-80">
                            登录后可累计完成项目、经验值和成就勋章，回到这里继续下一步。
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[hsl(var(--tone-tech))] opacity-70">
                            不知道从哪开始？试试「{suggestedLabel}」。
                        </p>
                        <Link href="/login" className="mt-4 inline-flex rounded-sm bg-[hsl(var(--brand-green))] px-4 py-2 text-xs font-bold text-[hsl(var(--brand-green-foreground))] shadow-[0_12px_24px_-16px_hsl(var(--brand-green)/0.72)]">
                            登录保存进度
                        </Link>
                    </div>
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[hsl(var(--surface-raised)/0.74)] text-[hsl(var(--brand-green))] shadow-inner">
                        <UserCircle className="h-8 w-8" />
                    </div>
                </div>
            </Surface>
        )
    }

    const safeProgress = Math.min(Math.max(progress, 0), 100)
    const remainingXp = Math.max(levelTotalNeeded - levelProgress, 0)
    const completedProjectsLabel = userStats ? `${userStats.projectsCompleted} 个` : '同步中'

    return (
        <Surface className="overflow-hidden border-[hsl(var(--tone-tech-border))] bg-[hsl(var(--tone-tech-soft))] p-4">
            <div className="flex items-start justify-between gap-3">
                <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold text-[hsl(var(--tone-tech))]">
                    <BarChart3 className="h-[18px] w-[18px] shrink-0" />
                    你的探索进度
                </h2>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-[hsl(var(--surface-raised)/0.82)] text-[hsl(var(--brand-green))] shadow-inner">
                    <UserCircle className="h-7 w-7" />
                </div>
            </div>
            <div className="mt-4 space-y-3">
                <div className="rounded-md border border-[hsl(var(--tone-tech-border))] bg-[hsl(var(--surface-raised)/0.76)] p-3.5 shadow-[0_18px_36px_-32px_hsl(var(--tone-tech)/0.6)]">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-muted-foreground">当前等级</p>
                            <p className="mt-1 text-[28px] font-black leading-none text-[hsl(var(--tone-tech))]">Lv.{level}</p>
                        </div>
                        <div className="shrink-0 rounded-full bg-[hsl(var(--brand-green)/0.12)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--brand-green))]">
                            {Math.floor(safeProgress)}%
                        </div>
                    </div>
                    <Progress value={safeProgress} className="mt-3 h-2" />
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {remainingXp > 0 ? `距离下一级还差 ${remainingXp} XP` : '已达到当前等级目标'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-sm bg-[hsl(var(--surface-raised)/0.66)] p-3">
                        <p className="text-[11px] font-medium text-muted-foreground">完成项目</p>
                        <p className="mt-1 text-[17px] font-black leading-6 text-foreground">{loading ? '同步中' : completedProjectsLabel}</p>
                    </div>
                    <div className="rounded-sm bg-[hsl(var(--surface-raised)/0.66)] p-3">
                        <p className="text-[11px] font-medium text-muted-foreground">已获徽章</p>
                        <p className="mt-1 text-[17px] font-black leading-6 text-foreground">{unlockedBadges.size} 枚</p>
                    </div>
                </div>

                <Link
                    href="/profile/library"
                    className="inline-flex w-full items-center justify-center rounded-sm bg-[hsl(var(--brand-green))] px-4 py-2.5 text-xs font-bold text-[hsl(var(--brand-green-foreground))] shadow-[0_12px_24px_-16px_hsl(var(--brand-green)/0.72)] transition hover:bg-[hsl(var(--brand-green)/0.92)]"
                >
                    查看探索记录
                </Link>
                <p className="text-center text-[11px] leading-5 text-muted-foreground">
                    试试「{suggestedLabel}」发现下一个项目
                </p>
            </div>
        </Surface>
    )
}

function normalizeSortBy(value: string | null | undefined): SortBy {
    return parseExploreSortBy(value)
}

/** 仅依据 URL：无 `sortBy` 时使用默认热门推荐。 */
function sortFromSearchParam(raw: string | null): SortBy {
    if (raw === null || raw === '') return normalizeSortBy(undefined)
    return normalizeSortBy(raw)
}

function normalizeTagList(tags: string[]) {
    return Array.from(
        new Set(
            tags
                .map((tag) => tag.trim())
                .filter(Boolean)
        )
    )
}

interface ExploreClientProps {
    initialProjects: Project[]
    initialHasMore: boolean
    initialTotal?: number
    initialPage?: number
    categories?: string[]
    availableTags?: string[]
    /** 服务端按标签在项目中的出现次数排序；为空时侧栏回退为 `availableTags` 前若干项 */
    popularTags?: string[]
    tagScope?: ExploreTagScope
}

export function ExploreClient({
    initialProjects,
    initialHasMore,
    initialTotal = 0,
    initialPage = 0,
    categories: propCategories,
    availableTags,
    popularTags: popularTagsProp,
    tagScope,
}: ExploreClientProps) {
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const { clearLikesDeltaForProjects } = useProjects()

    const displayCategories = propCategories || defaultCategories
    const resolvedAvailableTags = availableTags || EMPTY_TAGS
    const resolvedPopularTags = popularTagsProp ?? EMPTY_TAGS
    const resolvedTagScope = tagScope || EMPTY_TAG_SCOPE

    const hotTags = useMemo(() => {
        const ranked =
            resolvedPopularTags.length > 0 ? resolvedPopularTags : resolvedAvailableTags
        return ranked.slice(0, 10)
    }, [resolvedPopularTags, resolvedAvailableTags])

    // 从 URL 初始化状态
    const initialQuery = searchParams.get("q") || ""
    const initialCategory = searchParams.get("category") || "全部"
    const initialSubCategory = searchParams.get("subCategory") || ""
    const initialDifficulty = searchParams.get("difficulty") || "all"
    const initialTags = normalizeTagList(searchParams.get("tags")?.split(",") || [])
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
    const pageRef = useRef(initialPage + 1)
    const hasMoreRef = useRef(initialHasMore)
    const isLoadingMoreRef = useRef(false)
    const isFilteringRef = useRef(false)
    const pendingScrollRestoreRef = useRef<ExploreScrollRestoreState | null>(null)
    const isRestoringScrollRef = useRef(false)
    const activeFiltersKeyRef = useRef('')
    const filterRequestGenerationRef = useRef(0)
    const initializedFiltersKeyRef = useRef(false)

    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory)
    const [selectedDifficulty, setSelectedDifficulty] = useState(initialDifficulty)
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
    const [searchQuery, setSearchQuery] = useState(initialQuery)
    const [selectedSortBy, setSelectedSortBy] = useState<SortBy>(initialSort)

    // Sheet 状态
    const [sheetOpen, setSheetOpen] = useState(false)
    const [draftCategory, setDraftCategory] = useState(selectedCategory)
    const [draftSubCategory, setDraftSubCategory] = useState(selectedSubCategory)
    const [draftDifficulty, setDraftDifficulty] = useState(selectedDifficulty)
    const [draftTags, setDraftTags] = useState<string[]>(selectedTags)
    const [sheetView, setSheetView] = useState<'filters' | 'tags'>('filters')
    const [tagSearchQuery, setTagSearchQuery] = useState('')

    useEffect(() => {
        pageRef.current = page
        hasMoreRef.current = hasMore
        isLoadingMoreRef.current = isLoadingMore
        isFilteringRef.current = isFiltering
    }, [page, hasMore, isLoadingMore, isFiltering])

    useEffect(() => {
        const nextQuery = searchParams.get("q") || ""
        const nextCategory = searchParams.get("category") || "全部"
        const nextSubCategory = searchParams.get("subCategory") || ""
        const nextDifficulty = searchParams.get("difficulty") || "all"
        const nextTags = normalizeTagList(searchParams.get("tags")?.split(",") || [])
        const nextSortBy = sortFromSearchParam(searchParams.get("sortBy"))

        setSearchQuery(nextQuery)
        setSelectedCategory(nextCategory)
        setSelectedSubCategory(nextSubCategory)
        setSelectedDifficulty(nextDifficulty)
        setSelectedTags(nextTags)
        setSelectedSortBy(nextSortBy)
    }, [searchParams])

    useEffect(() => {
        return () => {
            activeFilterRequest.current?.abort()
            activeLoadMoreRequest.current?.abort()
            observer.current?.disconnect()
        }
    }, [])

    const isAbortError = useCallback((error: unknown) => {
        return (error instanceof DOMException && error.name === 'AbortError')
            || (error instanceof Error && error.name === 'AbortError')
    }, [])

    const sheetSubCategories = useMemo(() => (
        draftCategory === "全部"
            ? Object.values(CATEGORY_CONFIG).flat()
            : CATEGORY_CONFIG[draftCategory] || []
    ), [draftCategory])

    const scopedAvailableTags = useMemo(() => {
        if (draftSubCategory && resolvedTagScope.bySubCategory[draftSubCategory]) {
            return resolvedTagScope.bySubCategory[draftSubCategory]
        }

        if (draftCategory !== "全部" && resolvedTagScope.byCategory[draftCategory]) {
            return resolvedTagScope.byCategory[draftCategory]
        }

        return resolvedTagScope.all.length > 0 ? resolvedTagScope.all : resolvedAvailableTags
    }, [draftSubCategory, resolvedAvailableTags, resolvedTagScope, draftCategory])

    const sheetHotTags = useMemo(() => {
        const scopedSet = new Set(scopedAvailableTags)
        const ranked =
            resolvedPopularTags.length > 0 ? resolvedPopularTags : resolvedAvailableTags
        const popularInScope = ranked.filter((tag) => scopedSet.has(tag))
        const selectedInScope = draftTags.filter(
            (tag) => scopedSet.has(tag) && !popularInScope.includes(tag)
        )

        const merged: string[] = []
        const seen = new Set<string>()
        for (const tag of [...selectedInScope, ...popularInScope, ...scopedAvailableTags]) {
            if (seen.has(tag)) continue
            seen.add(tag)
            merged.push(tag)
            if (merged.length >= SHEET_HOT_TAGS_LIMIT) break
        }

        return merged
    }, [draftTags, resolvedAvailableTags, resolvedPopularTags, scopedAvailableTags])

    const pickerTags = useMemo(() => {
        const query = tagSearchQuery.trim().toLowerCase()
        const sorted = [...scopedAvailableTags].sort((left, right) => {
            const leftSelected = draftTags.includes(left)
            const rightSelected = draftTags.includes(right)
            if (leftSelected !== rightSelected) return leftSelected ? -1 : 1
            return left.localeCompare(right, 'zh-Hans-CN', { sensitivity: 'base' })
        })

        if (!query) return sorted
        return sorted.filter((tag) => tag.toLowerCase().includes(query))
    }, [draftTags, scopedAvailableTags, tagSearchQuery])

    const getFilterState = useCallback(() => ({
        category: selectedCategory,
        subCategory: selectedSubCategory,
        difficulty: selectedDifficulty,
        tags: selectedTags,
        searchQuery,
        sortBy: selectedSortBy,
    }), [selectedCategory, selectedSubCategory, selectedDifficulty, selectedTags, searchQuery, selectedSortBy])

    useEffect(() => {
        const scopedTagSet = new Set(scopedAvailableTags)
        setDraftTags(prev => prev.filter(tag => scopedTagSet.has(tag)))
    }, [scopedAvailableTags])

    const buildSearchParams = useCallback((overrides: {
        query?: string
        category?: string
        subCategory?: string
        difficulty?: string
        tags?: string[]
        sortBy?: SortBy
    } = {}) => {
        const params = new URLSearchParams()
        const query = overrides.query ?? searchQuery
        const category = overrides.category ?? selectedCategory
        const subCategory = overrides.subCategory ?? selectedSubCategory
        const difficulty = overrides.difficulty ?? selectedDifficulty
        const tags = overrides.tags ?? selectedTags
        const sortBy = overrides.sortBy ?? selectedSortBy

        if (query) params.set('q', query)
        if (category !== '全部') params.set('category', category)
        if (subCategory) params.set('subCategory', subCategory)
        if (difficulty !== 'all') params.set('difficulty', difficulty)
        if (tags.length > 0) params.set('tags', tags.join(','))
        if (sortBy !== 'popular') params.set('sortBy', sortBy)

        return params
    }, [searchQuery, selectedCategory, selectedSubCategory, selectedDifficulty, selectedTags, selectedSortBy])

    const saveExploreScrollPosition = useCallback(() => {
        if (typeof window === 'undefined') return

        saveExploreScrollRestore({
            filtersKey: buildExploreFiltersKey(buildSearchParams()),
            scrollY: window.scrollY,
            nextPage: pageRef.current,
        })
    }, [buildSearchParams])

    const handleExploreProjectLinkClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
        const target = event.target
        if (!(target instanceof Element)) return
        if (!target.closest('a[href^="/project/"]')) return
        saveExploreScrollPosition()
    }, [saveExploreScrollPosition])

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

        pendingScrollRestoreRef.current = saved
        clearExploreScrollRestore()
        // 仅在从详情页返回时读取一次 session 恢复点
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const saved = pendingScrollRestoreRef.current
        if (!saved) {
            return
        }

        pendingScrollRestoreRef.current = null
        let cancelled = false
        isRestoringScrollRef.current = true

        const restoreScroll = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    window.scrollTo({ top: saved.scrollY, left: 0, behavior: 'auto' })
                    isRestoringScrollRef.current = false
                })
            })
        }

        const syncRestoredProjects = (nextProjects: Project[], nextHasMore: boolean, nextPage: number) => {
            if (cancelled) return
            setProjects(nextProjects)
            clearLikesDeltaForProjects(nextProjects.map((project) => project.id))
            setHasMore(nextHasMore)
            hasMoreRef.current = nextHasMore
            setPage(nextPage)
            pageRef.current = nextPage
            restoreScroll()
        }

        if (saved.nextPage <= initialPage + 1) {
            syncRestoredProjects(initialProjects, initialHasMore, saved.nextPage)
            return () => {
                cancelled = true
                isRestoringScrollRef.current = false
            }
        }

        void (async () => {
            const pagesToRestore = Array.from(
                { length: Math.max(0, saved.nextPage - (initialPage + 1)) },
                (_, index) => initialPage + 1 + index,
            )
            const baseParams = buildSearchParams()
            const pageResults = await Promise.allSettled(
                pagesToRestore.map(async (page) => {
                    if (cancelled) return { page, projects: [] as Project[], hasMore: true }

                    const params = new URLSearchParams(baseParams)
                    params.set('page', String(page))
                    const response = await fetch(`/api/projects?${params.toString()}`)
                    if (!response.ok) {
                        throw new Error(await response.text())
                    }

                    const data = await response.json()
                    return {
                        page,
                        projects: (data.projects as Project[]) || [],
                        hasMore: Boolean(data.hasMore),
                    }
                }),
            )

            if (cancelled) return

            let mergedProjects = [...initialProjects]
            let nextHasMore = initialHasMore

            for (const result of pageResults) {
                if (result.status !== 'fulfilled') {
                    break
                }
                mergedProjects = mergeUniqueProjectsById(mergedProjects, result.value.projects)
                nextHasMore = result.value.hasMore
            }

            syncRestoredProjects(mergedProjects, nextHasMore, saved.nextPage)
        })()

        return () => {
            cancelled = true
            isRestoringScrollRef.current = false
        }
    }, [
        initialProjects,
        initialHasMore,
        initialPage,
        clearLikesDeltaForProjects,
        buildSearchParams,
    ])

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

    const buildProjectDetailHref = useCallback((projectId: string | number, index: number) => {
        const params = buildSearchParams()
        params.set('from', 'explore')
        params.set('sourceIndex', String(index))

        const query = params.toString()
        return query ? `/project/${projectId}?${query}` : `/project/${projectId}`
    }, [buildSearchParams])

    const syncUrl = useCallback((params: URLSearchParams) => {
        const nextUrl = params.size > 0 ? `/explore?${params.toString()}` : '/explore'
        window.history.replaceState(null, '', nextUrl)
    }, [])

    const loadMore = useCallback(async () => {
        if (isLoadingMoreRef.current || isFilteringRef.current || !hasMoreRef.current) return

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
            setProjects((prev) => mergeUniqueProjectsById(prev, data.projects))
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
        if (isLoadingMore || isFiltering) return
        if (observer.current) observer.current.disconnect()
        if (!node) return

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMoreRef.current) {
                loadMore()
            }
        })

        observer.current.observe(node)
    }, [isLoadingMore, isFiltering, loadMore])

    const executeFilter = useCallback(async (params: URLSearchParams) => {
        const filterKey = serializeExploreFilterParams(params)
        if (filterKey === activeFiltersKeyRef.current) {
            return
        }

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
                return
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

        } catch (error) {
            if (isAbortError(error)) {
                return
            }
            logger.error('Error fetching projects', { error })
            toast({ title: '加载失败', description: '无法加载项目列表，请稍后重试', variant: 'destructive' })
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
        setSelectedTags([])
        setDraftSubCategory("")
        setDraftTags([])
        const params = buildSearchParams({ category, subCategory: "", tags: [] })
        executeFilter(params)
    }

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const query = searchQuery.trim()
        setSearchQuery(query)
        const params = buildSearchParams({ query })
        executeFilter(params)
    }

    const handleTagClick = (tag: string) => {
        const nextTags = selectedTags.includes(tag)
            ? selectedTags.filter((selectedTag) => selectedTag !== tag)
            : [...selectedTags, tag]
        setSelectedTags(nextTags)
        setDraftTags(nextTags)
        const params = buildSearchParams({ tags: nextTags })
        executeFilter(params)
    }

    const handleClearFilters = () => {
        setSearchQuery("")
        setSelectedCategory("全部")
        setSelectedSubCategory("")
        setSelectedDifficulty("all")
        setSelectedTags([])
        setSelectedSortBy("popular")
        setDraftSubCategory("")
        setDraftDifficulty("all")
        setDraftTags([])
        setResultTotal(0)
        executeFilter(new URLSearchParams())
    }

    const handleSortChange = (sortBy: SortBy) => {
        if (sortBy === selectedSortBy) return
        setSelectedSortBy(sortBy)
        executeFilter(buildSearchParams({ sortBy }))
    }

    const handlePresetClick = (presetId: ExplorePresetId) => {
        const preset = EXPLORE_PRESETS.find((item) => item.id === presetId)
        if (!preset) return

        const params = buildSearchParams({
            difficulty: preset.difficulty,
            sortBy: preset.sortBy,
        })
        if (serializeExploreFilterParams(params) === activeFiltersKeyRef.current) {
            return
        }

        setSelectedDifficulty(preset.difficulty)
        setSelectedSortBy(preset.sortBy)
        setDraftDifficulty(preset.difficulty)

        executeFilter(params)
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

    const handleRemoveTag = (tag: string) => {
        const newTags = selectedTags.filter(t => t !== tag)
        setSelectedTags(newTags)
        const params = buildSearchParams({ tags: newTags })
        executeFilter(params)
    }

    // Sheet 逻辑
    const openSheet = () => {
        setDraftCategory(selectedCategory)
        setDraftSubCategory(selectedSubCategory)
        setDraftDifficulty(selectedDifficulty)
        setDraftTags([...selectedTags])
        setSheetView('filters')
        setTagSearchQuery('')
        setSheetOpen(true)
    }

    const openTagPicker = () => {
        setTagSearchQuery('')
        setSheetView('tags')
    }

    const handleDraftCategoryClick = (category: string) => {
        setDraftCategory(category)
        
        // 联动清空不属于该大类的子分类草稿
        const validSubs = category === "全部"
            ? Object.values(CATEGORY_CONFIG).flat()
            : CATEGORY_CONFIG[category] || []
        if (draftSubCategory && !validSubs.includes(draftSubCategory)) {
            setDraftSubCategory("")
        }

        // 联动清空不适用于该大类的标签草稿
        const scopedSet = new Set(
            category === "全部"
                ? resolvedTagScope.all
                : resolvedTagScope.byCategory[category] || []
        )
        setDraftTags(prev => prev.filter(tag => scopedSet.has(tag)))
    }

    const handleDraftSubCategoryClick = (sub: string) => {
        setDraftSubCategory(prev => prev === sub ? "" : sub)
    }

    const handleDraftDifficultyClick = (value: string) => {
        setDraftDifficulty(value)
    }

    const handleDraftTagClick = (tag: string) => {
        setDraftTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        )
    }

    const handleDraftClearAll = () => {
        setDraftCategory("全部")
        setDraftSubCategory("")
        setDraftDifficulty("all")
        setDraftTags([])
    }

    const handleFilterSheetOpenChange = (open: boolean) => {
        setSheetOpen(open)
        if (!open) {
            setSheetView('filters')
            setTagSearchQuery('')
        }
    }

    const handleConfirmFilters = () => {
        setSelectedCategory(draftCategory)
        setSelectedSubCategory(draftSubCategory)
        setSelectedDifficulty(draftDifficulty)
        setSelectedTags(draftTags)
        setSheetView('filters')
        setTagSearchQuery('')
        setSheetOpen(false)

        const params = buildSearchParams({
            category: draftCategory,
            subCategory: draftSubCategory,
            difficulty: draftDifficulty,
            tags: draftTags,
        })
        executeFilter(params)
    }

    const activePresetId = detectActivePreset(getFilterState())
    const activeListTabId = activePresetId === 'browse'
        || activePresetId === 'latest'
        || activePresetId === 'beginner-friendly'
        ? activePresetId
        : null
    const difficultyBelongsToListTab = activeListTabId === 'beginner-friendly'
    const hasActiveAdvancedFilters = !!selectedSubCategory || (!difficultyBelongsToListTab && selectedDifficulty !== "all") || selectedTags.length > 0
    const advancedFilterCount = (selectedSubCategory ? 1 : 0) + (!difficultyBelongsToListTab && selectedDifficulty !== "all" ? 1 : 0) + selectedTags.length
    const isResultsMode = isExploreResultsMode(getFilterState())
    const hasDraftFilters = draftCategory !== selectedCategory || !!draftSubCategory || draftDifficulty !== "all" || draftTags.length > 0
    const draftFilterCount = (draftSubCategory ? 1 : 0) + (draftDifficulty !== "all" ? 1 : 0) + draftTags.length
    const getDifficultyLabel = (value: string) => DIFFICULTY_OPTIONS.find(o => o.value === value)?.label || value

    const suggestedPresetId: Exclude<ExplorePresetId, 'browse'> = 'beginner-friendly'

    return (
        <div className="app-canvas-explore relative min-h-[calc(100vh-var(--mobile-global-header-height,3rem))] overflow-hidden pb-20 md:min-h-[calc(100vh-4rem)] md:pb-8">
            <MobileGlobalHeader
                variant="search"
                showNotification={false}
                showUserButton={false}
                className="bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.96)_0%,hsl(var(--app-canvas)/0.92)_100%)] md:bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.88)_0%,hsl(var(--app-canvas)/0.72)_100%)] md:backdrop-blur-xl"
                searchValue={searchQuery}
                searchPlaceholder="搜索项目、材料、作者..."
                onSearchChange={setSearchQuery}
                onSearchSubmit={(value) => {
                    const trimmed = value.trim()
                    setSearchQuery(trimmed)
                    executeFilter(buildSearchParams({ query: trimmed }))
                }}
                rightSlot={
                    <button
                        type="button"
                        onClick={openSheet}
                        data-testid="explore-more-filters"
                        className={cn(
                            "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--surface-border)/0.78)] bg-[hsl(var(--surface-raised)/0.82)] text-muted-foreground transition hover:text-foreground md:hidden",
                            hasActiveAdvancedFilters && "border-[hsl(var(--brand-blue)/0.56)] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]"
                        )}
                        aria-label="筛选条件"
                    >
                        <Filter className="h-4 w-4" strokeWidth={2.2} />
                        {advancedFilterCount > 0 && (
                            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue))] px-1 text-[9px] font-bold leading-none text-[hsl(var(--brand-blue-foreground))]">
                                {advancedFilterCount}
                            </span>
                        )}
                    </button>
                }
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
                    backgroundSize: 'max(100%, 1840px) auto',
                    maskImage: 'linear-gradient(180deg, black 0%, black 72%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 72%, transparent 100%)',
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 hidden h-[560px] opacity-95 dark:md:block"
                style={{
                    backgroundImage: "url('/assets/explore-page-bg-dark.webp')",
                    backgroundPosition: 'right top',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'max(100%, 1840px) auto',
                    maskImage: 'linear-gradient(180deg, black 0%, black 72%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 72%, transparent 100%)',
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[300px] hidden h-[560px] bg-[radial-gradient(ellipse_at_50%_0%,hsl(var(--brand-blue)/0.16),hsl(var(--app-canvas-soft)/0)_64%)] md:block"
            />
            <div className="relative z-10" aria-hidden={sheetOpen}>
                <div className="app-shell-wide min-w-0 pt-2 md:px-8 md:pt-5">
                    <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
                        <main className={cn(
                            "relative min-w-0 overflow-hidden md:surface-panel md:rounded-lg",
                            isResultsMode && "md:border-[hsl(var(--surface-border))]",
                        )}>
                            <div className={cn(
                                "bg-transparent pb-2 pt-0 md:p-5",
                                isResultsMode && "md:border-b md:border-[hsl(var(--surface-border))]",
                            )}>
                                {isResultsMode ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3 overflow-visible pr-0.5">
                                            <button
                                                type="button"
                                                onClick={handleClearFilters}
                                                className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-[hsl(var(--brand-blue))] md:text-sm"
                                            >
                                                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                                                返回探索
                                            </button>
                                            <button
                                                type="button"
                                                onClick={openSheet}
                                                data-testid="explore-more-filters"
                                                className={cn(
                                                    "hidden md:inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-sm border px-4 text-sm font-semibold transition",
                                                    hasActiveAdvancedFilters
                                                        ? "border-[hsl(var(--brand-blue)/0.56)] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]"
                                                        : "border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.86)] text-muted-foreground hover:text-foreground",
                                                )}
                                            >
                                                <Filter className="h-4 w-4" strokeWidth={2.2} />
                                                <span>筛选</span>
                                                {advancedFilterCount > 0 && (
                                                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--brand-blue))] px-1 text-[11px] font-bold leading-none text-[hsl(var(--brand-blue-foreground))]">
                                                        {advancedFilterCount}
                                                    </span>
                                                )}
                                            </button>
                                        </div>

                                        <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3">
                                            <form id="explore-search" onSubmit={handleSearchSubmit}>
                                                <label className="relative block">
                                                    <span className="sr-only">搜索项目</span>
                                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                                                    <input
                                                        type="search"
                                                        value={searchQuery}
                                                        onChange={(event) => setSearchQuery(event.target.value)}
                                                        placeholder="搜索项目、材料、作者..."
                                                        className="control-field h-11 w-full rounded-sm pl-11 pr-4 text-sm font-medium placeholder:text-muted-foreground/70"
                                                    />
                                                </label>
                                            </form>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {selectedCategory !== "全部" && (
                                                <FilterChip
                                                    onClick={() => handleCategoryClick("全部")}
                                                    active
                                                    shape="pill"
                                                >
                                                    {selectedCategory}
                                                    <X className="h-3 w-3" />
                                                </FilterChip>
                                            )}
                                            {searchQuery && (
                                                <FilterChip
                                                    onClick={() => {
                                                        setSearchQuery("")
                                                        executeFilter(buildSearchParams({ query: "" }))
                                                    }}
                                                    active
                                                    shape="pill"
                                                >
                                                    {searchQuery}
                                                    <X className="h-3 w-3" />
                                                </FilterChip>
                                            )}
                                            {selectedSubCategory && (
                                                <FilterChip
                                                    onClick={handleRemoveSubCategory}
                                                    active
                                                    shape="pill"
                                                >
                                                    {selectedSubCategory}
                                                    <X className="h-3 w-3" />
                                                </FilterChip>
                                            )}
                                            {selectedDifficulty !== "all" && !difficultyBelongsToListTab && (
                                                <FilterChip
                                                    onClick={handleRemoveDifficulty}
                                                    active
                                                    shape="pill"
                                                >
                                                    {getDifficultyLabel(selectedDifficulty)}
                                                    <X className="h-3 w-3" />
                                                </FilterChip>
                                            )}
                                            {selectedTags.map(tag => (
                                                <FilterChip
                                                    key={tag}
                                                    onClick={() => handleRemoveTag(tag)}
                                                    active
                                                    shape="pill"
                                                >
                                                    {tag}
                                                    <X className="h-3 w-3" />
                                                </FilterChip>
                                            ))}
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-[13px] font-semibold text-foreground md:text-sm">
                                                {isFiltering
                                                    ? '正在查找项目…'
                                                    : `共找到 ${resultTotal} 个项目`}
                                            </p>
                                            <div className="flex items-center gap-1.5">
                                                {EXPLORE_RESULTS_SORT_OPTIONS.map((option) => (
                                                    <FilterChip
                                                        key={option.value}
                                                        onClick={() => handleSortChange(option.value)}
                                                        disabled={isFiltering}
                                                        aria-pressed={selectedSortBy === option.value}
                                                        active={selectedSortBy === option.value}
                                                        tone="primary"
                                                        shape="pill"
                                                        className="px-3.5 font-semibold"
                                                    >
                                                        {option.label}
                                                    </FilterChip>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                <h1 className="sr-only">探索</h1>

                                <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-3">
                                    <form id="explore-search" onSubmit={handleSearchSubmit} className="hidden md:block">
                                        <label className="relative block">
                                            <span className="sr-only">搜索项目</span>
                                            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                                            <input
                                                type="search"
                                                value={searchQuery}
                                                onChange={(event) => setSearchQuery(event.target.value)}
                                                placeholder="搜索项目、材料、作者..."
                                                className="control-field h-11 w-full rounded-sm pl-11 pr-4 text-sm font-medium placeholder:text-muted-foreground/70"
                                            />
                                        </label>
                                    </form>

                                    <button
                                        type="button"
                                        onClick={openSheet}
                                        className={cn(
                                            "relative inline-flex h-11 items-center justify-center gap-2 rounded-sm border px-4 text-sm font-semibold transition",
                                            hasActiveAdvancedFilters
                                                ? "border-[hsl(var(--brand-amber)/0.5)] bg-[hsl(var(--brand-amber)/0.12)] text-[hsl(var(--brand-amber))] filter-chip-active"
                                                : "border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.86)] text-muted-foreground hover:border-[hsl(var(--surface-border-strong))] hover:text-foreground"
                                        )}
                                    >
                                        <Filter className="h-4 w-4" strokeWidth={2.2} />
                                        <span>更多筛选</span>
                                        {advancedFilterCount > 0 && (
                                            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(var(--brand-amber))] px-1 text-[11px] font-bold text-[hsl(var(--brand-amber-foreground))]">
                                                {advancedFilterCount}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                <div className="space-y-2.5 md:mt-4 md:space-y-2">
                                    <span className="hidden text-[13px] font-semibold text-muted-foreground md:block">分类</span>
                                    <div className="relative md:static">
                                    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
                                    <div className="flex min-w-max items-center gap-1.5 pb-0.5 md:min-w-0 md:flex-wrap md:gap-3">
                                        {displayCategories.map((category) => {
                                            const meta = CATEGORY_META[category]
                                            const isActive = selectedCategory === category
                                            const tone = meta?.tone
                                            const activeToneBg = isActive && tone ? categoryToneClasses[tone].badge : undefined
                                            const Icon = meta?.icon ?? Sparkles
                                            return (
                                                <FilterChip
                                                    key={category}
                                                    onClick={() => handleCategoryClick(category)}
                                                    disabled={isFiltering}
                                                    aria-pressed={isActive}
                                                    active={isActive}
                                                    solid={isActive && !tone}
                                                    shape="pill"
                                                    size="md"
                                                    className={cn(
                                                        "h-11 min-w-[64px] px-3 text-[13px] font-semibold max-md:min-w-0 max-md:border-transparent! max-md:bg-transparent! max-md:p-0! max-md:shadow-none! max-md:text-inherit! md:h-10 md:min-w-0 md:rounded-sm md:px-5 md:text-sm",
                                                        !isActive && "border-transparent bg-[hsl(var(--surface-muted)/0.62)] text-foreground/76 shadow-none hover:bg-[hsl(var(--surface-muted)/0.9)] dark:bg-white/8 dark:text-foreground/84 dark:hover:bg-white/12",
                                                        isActive && tone && cn(
                                                            activeToneBg,
                                                            "border-transparent shadow-xs",
                                                        ),
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "contents max-md:inline-flex max-md:h-8 max-md:items-center max-md:gap-1.5 max-md:rounded-sm max-md:px-2.5 max-md:text-xs max-md:font-semibold max-md:leading-none max-md:transition-colors",
                                                            isActive
                                                                ? "max-md:bg-[hsl(var(--brand-blue))] max-md:text-[hsl(var(--brand-blue-foreground))] max-md:shadow-xs"
                                                                : "max-md:bg-[hsl(var(--surface-muted)/0.62)] max-md:text-foreground/76 max-md:hover:bg-[hsl(var(--surface-muted)/0.9)] dark:max-md:bg-white/8 dark:max-md:text-foreground/84 dark:max-md:hover:bg-white/12",
                                                        )}
                                                    >
                                                        <Icon
                                                            className={cn(
                                                                "mr-0.5 h-3.5 w-3.5 shrink-0 max-md:mr-0 max-md:h-3.5 max-md:w-3.5",
                                                                isActive ? "text-inherit" : tone ? categoryToneClasses[tone].text : "text-muted-foreground",
                                                            )}
                                                            strokeWidth={2.2}
                                                            aria-hidden="true"
                                                        />
                                                        {category}
                                                    </span>
                                                </FilterChip>
                                            )
                                        })}
                                    </div>
                                    </div>
                                    <div
                                        aria-hidden
                                        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-[hsl(var(--app-canvas))] via-[hsl(var(--app-canvas)/0.88)] to-transparent md:hidden"
                                    />
                                    </div>
                                </div>
                                    </>
                                )}
                            </div>

                            <div className={cn(
                                "pb-4 pt-0 md:p-5",
                                isResultsMode && "md:pt-4",
                            )}>
                                <div className={cn(
                                    "relative",
                                    !isResultsMode && "pb-5 pt-0.5 md:pb-0 md:pt-0",
                                )}>
                                    {isFiltering && (
                                        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 flex items-center gap-2 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised))] px-4 py-2 text-xs font-bold text-foreground shadow-[0_12px_32px_-12px_rgba(0,0,0,0.16)] animate-in fade-in slide-in-from-top-3 duration-300 md:bg-[hsl(var(--surface-raised)/0.8)] md:backdrop-blur-md">
                                            <Sparkles className="h-3.5 w-3.5 animate-spin text-[hsl(var(--brand-blue))]" strokeWidth={2.4} aria-hidden="true" />
                                            <span className="tracking-wide text-foreground/90">正在更新项目列表...</span>
                                        </div>
                                    )}

                                    {!isResultsMode ? (
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1">
                                            {EXPLORE_PRESETS.map((preset) => {
                                                const isActive = activeListTabId === preset.id

                                                return (
                                                    <FilterChip
                                                        key={preset.id}
                                                        onClick={() => handlePresetClick(preset.id)}
                                                        disabled={isFiltering}
                                                        aria-pressed={isActive}
                                                        active={isActive}
                                                        tone="primary"
                                                        shape="pill"
                                                        size="md"
                                                        className={cn(
                                                            "h-11 min-w-[78px] px-3.5 text-[12px] font-semibold max-md:min-w-0 max-md:border-transparent! max-md:bg-transparent! max-md:p-0! max-md:shadow-none! max-md:text-inherit! md:h-10 md:min-w-[96px] md:text-sm",
                                                            isActive
                                                                ? "border-[hsl(var(--brand-blue)/0.42)] dark:border-[hsl(var(--brand-blue)/0.6)] bg-[hsl(var(--brand-blue)/0.1)] dark:bg-[hsl(var(--brand-blue)/0.18)] shadow-[0_8px_18px_-16px_hsl(var(--brand-blue)/0.5)] dark:shadow-[0_8px_20px_-12px_hsl(var(--brand-blue)/0.66)]"
                                                                : "border-transparent bg-[hsl(var(--surface-raised)/0.66)] text-foreground/68 shadow-none md:bg-[hsl(var(--surface-muted)/0.58)]",
                                                        )}
                                                    >
                                                        <span
                                                            className={cn(
                                                                "contents max-md:inline-flex max-md:h-8 max-md:min-w-[68px] max-md:items-center max-md:justify-center max-md:rounded-sm max-md:px-3 max-md:text-xs max-md:font-semibold max-md:leading-none max-md:transition-colors",
                                                                isActive
                                                                    ? "max-md:border max-md:border-[hsl(var(--brand-blue)/0.34)] max-md:bg-[hsl(var(--brand-blue)/0.1)] max-md:text-[hsl(var(--brand-blue))] max-md:shadow-none"
                                                                    : "max-md:bg-[hsl(var(--surface-raised)/0.66)] max-md:text-foreground/68 max-md:hover:bg-[hsl(var(--surface-muted)/0.58)]",
                                                            )}
                                                        >
                                                            {preset.label}
                                                        </span>
                                                    </FilterChip>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    ) : null}

                                    <div
                                        className={cn(
                                            COMPACT_VERTICAL_PROJECT_GRID_CLASS,
                                            "transition-opacity duration-300",
                                            isFiltering && "opacity-40 pointer-events-none"
                                        )}
                                        onClickCapture={handleExploreProjectLinkClick}
                                    >
                                        {projects.map((project, index) => {
                                            const isPriority = index < 2
                                            const detailHref = buildProjectDetailHref(project.id, index)
                                            const card = (
                                                <ProjectCard
                                                    project={project}
                                                    searchQuery={searchQuery}
                                                    priority={isPriority}
                                                    href={detailHref}
                                                    variant="compact"
                                                    compactLayout="vertical"
                                                    className={COMPACT_VERTICAL_PROJECT_CARD_CLASS}
                                                />
                                            )
                                            const projectNode = projects.length === index + 1 ? (
                                                <div ref={lastProjectElementRef}>
                                                    {card}
                                                </div>
                                            ) : (
                                                <div>
                                                    {card}
                                                </div>
                                            )

                                            return (
                                                <Fragment key={project.id}>
                                                    {projectNode}
                                                </Fragment>
                                            )
                                        })}

                                        {isLoadingMore && (
                                            <>
                                                {[1, 2, 3, 4].map((i) => (
                                                    <ProjectCardSkeleton key={`skeleton-${i}`} variant="compact" compactLayout="vertical" className={COMPACT_VERTICAL_PROJECT_CARD_CLASS} />
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {!isLoadingMore && !isFiltering && projects.length === 0 && (
                                        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.72)] px-6 py-14 text-center">
                                            <div className="mb-4 grid h-14 w-14 place-items-center rounded-md bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]">
                                                <Search className="h-7 w-7" />
                                            </div>
                                            <h3 className="text-lg font-semibold">没有找到相关项目</h3>
                                            <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                                                换个关键词、类别或减少筛选条件再试试看。
                                            </p>
                                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                                                {!isResultsMode && activeListTabId !== 'beginner-friendly' ? (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => handlePresetClick('beginner-friendly')}
                                                    >
                                                        试试新手推荐
                                                    </Button>
                                                ) : null}
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
                        </main>

                        <aside className="hidden min-w-0 xl:block">
                            <div className="sticky top-24 flex h-full min-h-0 flex-col gap-4">
                                {!isResultsMode ? (
                                    <>
                                <Surface className="p-4">
                                    <div className="mb-3 flex items-center justify-between gap-2">
                                        <h2 className="text-base font-bold text-foreground">热门标签</h2>
                                        <button
                                            type="button"
                                            onClick={openSheet}
                                            className="shrink-0 text-xs font-semibold text-[hsl(var(--brand-blue))] underline-offset-2 hover:underline"
                                        >
                                            查看全部
                                        </button>
                                    </div>
                                    {hotTags.length === 0 ? (
                                        <p className="text-xs leading-5 text-muted-foreground">
                                            暂无标签数据（项目通过审核并填写标签后会显示在这里）
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {hotTags.map((tag) => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => handleTagClick(tag)}
                                                    disabled={isFiltering}
                                                    className={cn(
                                                        "rounded-xs px-3 py-1.5 text-left text-xs font-semibold transition disabled:opacity-60",
                                                        selectedTags.includes(tag)
                                                            ? "filter-chip-active"
                                                            : "bg-[hsl(var(--surface-muted))] text-muted-foreground hover:bg-[hsl(var(--surface-border))] hover:text-foreground",
                                                    )}
                                                >
                                                    {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </Surface>

                                <Surface className="p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                                            <Trophy className="h-[18px] w-[18px] text-[hsl(var(--brand-amber))]" />
                                            本周挑战
                                        </h2>
                                        <span className="text-xs text-muted-foreground">挑战进行中</span>
                                    </div>
                                    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3">
                                        <div className="relative overflow-hidden rounded-sm bg-linear-to-br from-[#0b68c9] to-[#9fd4ff]">
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(255,255,255,0.72),transparent_20%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.34),transparent_24%)]" />
                                            <div className="relative flex h-full min-h-[92px] items-center justify-center">
                                                <div className="h-0 w-0 rotate-[-16deg] border-b-18 border-l-52 border-t-18 border-b-transparent border-l-white border-t-transparent drop-shadow-[0_10px_18px_rgba(11,62,122,0.32)]" />
                                            </div>
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-foreground">
                                                纸飞机飞行距离挑战赛
                                            </h3>
                                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                设计并制作一架纸飞机，测试飞行距离并分享你的设计思路。
                                            </p>
                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <span className="text-xs font-semibold text-muted-foreground">1,258 人参与</span>
                                                <Link href="/create" className="rounded-sm bg-[hsl(var(--brand-blue))] px-3 py-2 text-xs font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_12px_24px_-16px_hsl(var(--brand-blue)/0.78)]">
                                                    参与挑战
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </Surface>

                                <Surface className="p-4">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h2 className="text-base font-bold text-foreground">探索小贴士</h2>
                                        <Lightbulb className="h-5 w-5 text-[hsl(var(--brand-amber))]" />
                                    </div>
                                    <div className="space-y-3 text-xs leading-5 text-muted-foreground">
                                        <p className="flex gap-2">
                                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-blue))]" />
                                            先从 1星、2星项目开始，循序渐进。
                                        </p>
                                        <p className="flex gap-2">
                                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-blue))]" />
                                            查看项目所需材料和安全提示。
                                        </p>
                                        <p className="flex gap-2">
                                            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--brand-blue))]" />
                                            动手实践后记录并分享你的成果。
                                        </p>
                                    </div>
                                    <Link href="/create" className="mt-4 inline-flex text-xs font-bold text-[hsl(var(--brand-blue))]">
                                        了解更多使用指南 →
                                    </Link>
                                </Surface>
                                    </>
                                ) : null}

                                <ExplorationProgressCard suggestedPresetId={suggestedPresetId} />
                            </div>
                        </aside>
                    </div>
                </div>
            </div>

            {/* 筛选 Bottom Sheet（含标签二级视图） */}
            <Sheet open={sheetOpen} onOpenChange={handleFilterSheetOpenChange}>
                <SheetContent
                    side="bottom"
                    showClose={false}
                    className={cn(
                        "flex flex-col gap-0 rounded-t-md p-0 sm:max-w-none",
                        sheetView === 'tags' ? "max-h-[85vh]" : "max-h-[70vh]"
                    )}
                >
                    {sheetView === 'filters' ? (
                        <>
                            <SheetHeader className="shrink-0 space-y-0 px-5 pb-4 pt-6 sm:px-6">
                                <SheetTitle className="sr-only">项目筛选</SheetTitle>
                                <div className="flex items-center justify-between">
                                    <div className="text-xs text-muted-foreground">
                                        {hasDraftFilters ? `已选 ${draftFilterCount} 项` : '更多筛选'}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleDraftClearAll}
                                        className={cn(
                                            "text-sm text-muted-foreground hover:text-foreground",
                                            !hasDraftFilters && "invisible"
                                        )}
                                    >
                                        重置
                                    </button>
                                </div>
                            </SheetHeader>

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
                                <div className="space-y-6 pb-4">
                                    <div className="space-y-3">
                                        <span className="text-sm font-medium">分类</span>
                                        <div className="flex flex-wrap gap-2">
                                            {displayCategories.map((category) => (
                                                <FilterChip
                                                    key={category}
                                                    onClick={() => handleDraftCategoryClick(category)}
                                                    active={draftCategory === category}
                                                    shape="pill"
                                                    size="md"
                                                    className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                                >
                                                    {category}
                                                </FilterChip>
                                            ))}
                                        </div>
                                    </div>

                                    {sheetSubCategories.length > 0 && (
                                        <div className="space-y-3">
                                            <span className="text-sm font-medium">子分类</span>
                                            <div className="flex flex-wrap gap-2">
                                                {sheetSubCategories.map((sub) => (
                                                    <FilterChip
                                                        key={sub}
                                                        onClick={() => handleDraftSubCategoryClick(sub)}
                                                        active={draftSubCategory === sub}
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
                                                    shape="pill"
                                                    size="md"
                                                    className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                                >
                                                    {option.label}
                                                </FilterChip>
                                            ))}
                                        </div>
                                    </div>

                                    {scopedAvailableTags.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <span className="text-sm font-medium">标签</span>
                                                </div>
                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                    已选 {draftTags.length} 个
                                                </span>
                                            </div>

                                            {sheetHotTags.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {sheetHotTags.map((tag) => (
                                                        <FilterChip
                                                            key={tag}
                                                            onClick={() => handleDraftTagClick(tag)}
                                                            active={draftTags.includes(tag)}
                                                            shape="pill"
                                                            size="md"
                                                            className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                                        >
                                                            {tag}
                                                        </FilterChip>
                                                    ))}
                                                </div>
                                            )}

                                            {scopedAvailableTags.length > sheetHotTags.length && (
                                                <button
                                                    type="button"
                                                    data-testid="explore-more-tags"
                                                    onClick={openTagPicker}
                                                    className="flex min-h-11 w-full items-center justify-between py-2 text-sm font-medium text-[hsl(var(--brand-blue))]"
                                                >
                                                    <span>查看更多标签</span>
                                                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-[hsl(var(--surface-border))] bg-background px-5 py-4 sm:px-6">
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-11 flex-1"
                                        onClick={() => handleFilterSheetOpenChange(false)}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        className="h-11 flex-1"
                                        onClick={handleConfirmFilters}
                                    >
                                        查看结果
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div data-testid="explore-tag-picker" className="flex min-h-0 flex-1 flex-col">
                            <SheetHeader className="shrink-0 space-y-3 px-5 pb-3 pt-6 sm:px-6">
                                <SheetTitle className="sr-only">选择标签</SheetTitle>
                                <button
                                    type="button"
                                    onClick={() => setSheetView('filters')}
                                    className="inline-flex items-center gap-0.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                                    aria-label="返回筛选"
                                >
                                    <ArrowLeft className="h-4 w-4" aria-hidden />
                                    返回
                                </button>
                                <div className="flex items-center justify-between">
                                    <span className="text-base font-semibold text-foreground">选择标签</span>
                                    <span className="text-xs text-muted-foreground">
                                        已选 {draftTags.length} 个
                                    </span>
                                </div>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={tagSearchQuery}
                                        onChange={(event) => setTagSearchQuery(event.target.value)}
                                        placeholder="搜索标签"
                                        aria-label="搜索标签"
                                        className="h-10 rounded-sm pl-9"
                                    />
                                </div>
                            </SheetHeader>

                            {draftTags.length > 0 && (
                                <div className="shrink-0 border-b border-[hsl(var(--surface-border))] px-5 pb-3 sm:px-6">
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">已选标签</p>
                                    <div className="flex flex-wrap gap-2">
                                        {draftTags.map((tag) => (
                                            <FilterChip
                                                key={`selected-${tag}`}
                                                onClick={() => handleDraftTagClick(tag)}
                                                active
                                                shape="pill"
                                                size="md"
                                                className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                            >
                                                {tag}
                                            </FilterChip>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
                                {pickerTags.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        没有匹配的标签
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2 py-2">
                                        {pickerTags.map((tag) => (
                                            <FilterChip
                                                key={tag}
                                                onClick={() => handleDraftTagClick(tag)}
                                                active={draftTags.includes(tag)}
                                                shape="pill"
                                                size="md"
                                                className="min-h-11 px-3.5 py-2 text-sm font-medium"
                                            >
                                                {tag}
                                            </FilterChip>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 border-t border-[hsl(var(--surface-border))] bg-background px-5 py-4 sm:px-6">
                                <Button
                                    className="h-11 w-full"
                                    onClick={() => setSheetView('filters')}
                                >
                                    完成
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}
