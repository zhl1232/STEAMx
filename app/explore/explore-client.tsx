"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X, Sparkles } from 'lucide-react'
import { ProjectCard } from '@/components/features/project-card'
import { useProjects } from '@/context/project-context'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { Button } from '@/components/ui/button'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'

// 类别配置：主分类 -> 子分类映射
import { CATEGORY_CONFIG } from '@/lib/config/categories'

// 分类图标 emoji
const CATEGORY_ICONS: Record<string, string> = {
    "全部": "🔍",
    "科学": "🔬",
    "技术": "💻",
    "工程": "⚙️",
    "艺术": "🎨",
    "数学": "📐",
    "其他": "📦",
}

// 难度选项
const DIFFICULTY_OPTIONS = [
    { value: "all", label: "全部" },
    { value: "1-2", label: "⭐⭐ 入门" },
    { value: "3-4", label: "⭐⭐⭐ 进阶" },
    { value: "5-6", label: "⭐⭐⭐⭐⭐ 挑战" },
]

const defaultCategories = ["全部", "科学", "技术", "工程", "艺术", "数学", "其他"]

interface ExploreClientProps {
    initialProjects: Project[]
    initialHasMore: boolean
    initialPage?: number
    categories?: string[]
    availableTags?: string[]
}

export function ExploreClient({
    initialProjects,
    initialHasMore,
    initialPage = 0,
    categories: propCategories,
    availableTags = []
}: ExploreClientProps) {
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const { clearLikesDeltaForProjects } = useProjects()

    const displayCategories = propCategories || defaultCategories

    // 从 URL 初始化状态
    const initialQuery = searchParams.get("q") || ""
    const initialCategory = searchParams.get("category") || "全部"
    const initialSubCategory = searchParams.get("subCategory") || ""
    const initialDifficulty = searchParams.get("difficulty") || "all"
    const initialTags = searchParams.get("tags")?.split(",").filter(Boolean) || []

    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [page, setPage] = useState(initialPage + 1)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [isFiltering, setIsFiltering] = useState(false)
    const observer = useRef<IntersectionObserver | null>(null)
    const activeFilterRequest = useRef<AbortController | null>(null)
    const activeLoadMoreRequest = useRef<AbortController | null>(null)

    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory)
    const [selectedDifficulty, setSelectedDifficulty] = useState(initialDifficulty)
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
    const [searchQuery, setSearchQuery] = useState(initialQuery)

    // Sheet 状态
    const [sheetOpen, setSheetOpen] = useState(false)
    const [draftSubCategory, setDraftSubCategory] = useState(selectedSubCategory)
    const [draftDifficulty, setDraftDifficulty] = useState(selectedDifficulty)
    const [draftTags, setDraftTags] = useState<string[]>(selectedTags)

    useEffect(() => {
        setProjects(initialProjects)
        setHasMore(initialHasMore)
        setPage(initialPage + 1)
        clearLikesDeltaForProjects(initialProjects.map(p => p.id))
    }, [initialProjects, initialHasMore, initialPage, clearLikesDeltaForProjects])

    useEffect(() => {
        const nextQuery = searchParams.get("q") || ""
        const nextCategory = searchParams.get("category") || "全部"
        const nextSubCategory = searchParams.get("subCategory") || ""
        const nextDifficulty = searchParams.get("difficulty") || "all"
        const nextTags = searchParams.get("tags")?.split(",").filter(Boolean) || []

        setSearchQuery(nextQuery)
        setSelectedCategory(nextCategory)
        setSelectedSubCategory(nextSubCategory)
        setSelectedDifficulty(nextDifficulty)
        setSelectedTags(nextTags)
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

    const currentSubCategories = useMemo(() => (
        selectedCategory === "全部"
            ? Object.values(CATEGORY_CONFIG).flat()
            : CATEGORY_CONFIG[selectedCategory] || []
    ), [selectedCategory])

    const buildSearchParams = useCallback((overrides: {
        query?: string
        category?: string
        subCategory?: string
        difficulty?: string
        tags?: string[]
    } = {}) => {
        const params = new URLSearchParams()
        const query = overrides.query ?? searchQuery
        const category = overrides.category ?? selectedCategory
        const subCategory = overrides.subCategory ?? selectedSubCategory
        const difficulty = overrides.difficulty ?? selectedDifficulty
        const tags = overrides.tags ?? selectedTags

        if (query) params.set('q', query)
        if (category !== '全部') params.set('category', category)
        if (subCategory) params.set('subCategory', subCategory)
        if (difficulty !== 'all') params.set('difficulty', difficulty)
        if (tags.length > 0) params.set('tags', tags.join(','))

        return params
    }, [searchQuery, selectedCategory, selectedSubCategory, selectedDifficulty, selectedTags])

    const syncUrl = useCallback((params: URLSearchParams) => {
        const nextUrl = params.size > 0 ? `/explore?${params.toString()}` : '/explore'
        window.history.replaceState(null, '', nextUrl)
    }, [])

    const loadMore = useCallback(async () => {
        if (isLoadingMore || isFiltering || !hasMore) return

        activeLoadMoreRequest.current?.abort()
        const controller = new AbortController()
        activeLoadMoreRequest.current = controller
        setIsLoadingMore(true)
        const params = buildSearchParams()
        params.set('page', String(page))

        try {
            const response = await fetch(`/api/projects?${params.toString()}`, {
                signal: controller.signal,
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            const data = await response.json()
            setProjects(prev => [...prev, ...data.projects])
            clearLikesDeltaForProjects(data.projects.map((p: Project) => p.id))
            setHasMore(data.hasMore)
            setPage(prev => prev + 1)
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
            }
        }
    }, [isLoadingMore, isFiltering, hasMore, page, buildSearchParams, clearLikesDeltaForProjects, isAbortError, toast])

    const lastProjectElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoadingMore || isFiltering) return
        if (observer.current) observer.current.disconnect()

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore()
            }
        })

        if (node) observer.current.observe(node)
    }, [isLoadingMore, isFiltering, hasMore, loadMore])

    const executeFilter = useCallback(async (params: URLSearchParams) => {
        activeFilterRequest.current?.abort()
        activeLoadMoreRequest.current?.abort()
        const controller = new AbortController()
        activeFilterRequest.current = controller

        setIsFiltering(true)

        try {
            const response = await fetch(`/api/projects?${params.toString()}`, {
                signal: controller.signal,
            })
            if (!response.ok) {
                throw new Error(await response.text())
            }
            const data = await response.json()
            setProjects(data.projects)
            clearLikesDeltaForProjects(data.projects.map((p: Project) => p.id))
            setHasMore(data.hasMore)
            setPage(1)
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
            }
        }
    }, [clearLikesDeltaForProjects, isAbortError, syncUrl, toast])

    const handleCategoryClick = (category: string) => {
        setSelectedCategory(category)
        setSelectedSubCategory("")
        const params = buildSearchParams({ category, subCategory: "" })
        executeFilter(params)
    }

    const handleClearFilters = () => {
        setSearchQuery("")
        setSelectedCategory("全部")
        setSelectedSubCategory("")
        setSelectedDifficulty("all")
        setSelectedTags([])
        executeFilter(new URLSearchParams())
    }

    const handleRemoveSubCategory = () => {
        setSelectedSubCategory("")
        const params = buildSearchParams({ subCategory: "" })
        executeFilter(params)
    }

    const handleRemoveDifficulty = () => {
        setSelectedDifficulty("all")
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
        setDraftSubCategory(selectedSubCategory)
        setDraftDifficulty(selectedDifficulty)
        setDraftTags([...selectedTags])
        setSheetOpen(true)
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
        setDraftSubCategory("")
        setDraftDifficulty("all")
        setDraftTags([])
    }

    const handleConfirmFilters = () => {
        setSelectedSubCategory(draftSubCategory)
        setSelectedDifficulty(draftDifficulty)
        setSelectedTags(draftTags)
        setSheetOpen(false)

        const params = buildSearchParams({
            subCategory: draftSubCategory,
            difficulty: draftDifficulty,
            tags: draftTags,
        })
        executeFilter(params)
    }

    const hasActiveAdvancedFilters = !!selectedSubCategory || selectedDifficulty !== "all" || selectedTags.length > 0
    const advancedFilterCount = (selectedSubCategory ? 1 : 0) + (selectedDifficulty !== "all" ? 1 : 0) + selectedTags.length
    const hasDraftFilters = !!draftSubCategory || draftDifficulty !== "all" || draftTags.length > 0
    const draftFilterCount = (draftSubCategory ? 1 : 0) + (draftDifficulty !== "all" ? 1 : 0) + draftTags.length
    const getDifficultyLabel = (value: string) => DIFFICULTY_OPTIONS.find(o => o.value === value)?.label || value
    const sheetSubCategories = currentSubCategories

    return (
        <div className="page-shell pb-6 md:pb-8">
            {/* 分类导航条 - sticky 吸顶 */}
            <div className="mobile-subnav top-0 -mx-4 mb-5 px-4 py-3 md:-mx-6 md:px-6">
                <div className="flex items-center gap-2">
                    {/* 横向滚动分类 */}
                    <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
                        {displayCategories.map((category) => (
                            <button
                                key={category}
                                onClick={() => handleCategoryClick(category)}
                                disabled={isFiltering}
                                className={cn(
                                    "relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                                    selectedCategory === category
                                        ? "bg-foreground text-background shadow-md"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    isFiltering && "cursor-not-allowed opacity-50"
                                )}
                            >
                                <span className="text-base leading-none">{CATEGORY_ICONS[category] || "📁"}</span>
                                {category}
                            </button>
                        ))}
                    </div>

                    {/* 筛选按钮 */}
                    <button
                        onClick={openSheet}
                        className={cn(
                            "relative inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all duration-200",
                            hasActiveAdvancedFilters
                                ? "border-primary/40 bg-primary/10 text-primary shadow-sm shadow-primary/10"
                                : "border-border/70 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">筛选</span>
                        {advancedFilterCount > 0 && (
                            <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                                {advancedFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* 已选条件 chips */}
                {(hasActiveAdvancedFilters || searchQuery) && (
                    <div className="no-scrollbar mt-2.5 flex items-center gap-1.5 overflow-x-auto">
                        <Sparkles className="h-3 w-3 shrink-0 text-primary/60" />

                        {searchQuery && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
                                搜索: {searchQuery}
                            </span>
                        )}

                        {selectedSubCategory && (
                            <button
                                onClick={handleRemoveSubCategory}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                                {selectedSubCategory}
                                <X className="h-3 w-3" />
                            </button>
                        )}

                        {selectedDifficulty !== "all" && (
                            <button
                                onClick={handleRemoveDifficulty}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                                {getDifficultyLabel(selectedDifficulty)}
                                <X className="h-3 w-3" />
                            </button>
                        )}

                        {selectedTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => handleRemoveTag(tag)}
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                            >
                                {tag}
                                <X className="h-3 w-3" />
                            </button>
                        ))}

                        <button
                            onClick={handleClearFilters}
                            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                            清除
                        </button>
                    </div>
                )}
            </div>

            {/* 筛选 Bottom Sheet */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl px-5 pb-8 pt-6 sm:px-6">
                    <SheetHeader className="mb-5">
                        <div className="flex items-center justify-between">
                            <SheetTitle className="text-lg font-semibold">筛选条件</SheetTitle>
                            {hasDraftFilters && (
                                <button
                                    onClick={handleDraftClearAll}
                                    className="text-sm text-muted-foreground hover:text-foreground"
                                >
                                    重置
                                </button>
                            )}
                        </div>
                        <SheetDescription className="text-sm text-muted-foreground">
                            选择子分类、难度或标签来缩小范围
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6">
                        {sheetSubCategories.length > 0 && (
                            <div className="space-y-3">
                                <span className="text-sm font-medium">子分类</span>
                                <div className="flex flex-wrap gap-2">
                                    {sheetSubCategories.map((sub) => (
                                        <button
                                            key={sub}
                                            onClick={() => handleDraftSubCategoryClick(sub)}
                                            className={cn(
                                                "rounded-full border border-border/70 bg-background/80 px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:border-primary/40 hover:bg-primary/5",
                                                draftSubCategory === sub && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary"
                                            )}
                                        >
                                            {sub}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            <span className="text-sm font-medium">难度等级</span>
                            <div className="flex flex-wrap gap-2">
                                {DIFFICULTY_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleDraftDifficultyClick(option.value)}
                                        className={cn(
                                            "rounded-full border border-border/70 bg-background/80 px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:border-primary/40 hover:bg-primary/5",
                                            draftDifficulty === option.value && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary"
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {availableTags.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">标签</span>
                                    {draftTags.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            已选 {draftTags.length} 个
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableTags.map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => handleDraftTagClick(tag)}
                                            className={cn(
                                                "rounded-full border border-border/70 bg-background/80 px-3.5 py-2 text-sm font-medium transition-all duration-200 hover:border-primary/40 hover:bg-primary/5",
                                                draftTags.includes(tag) && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary"
                                            )}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl"
                            onClick={() => setSheetOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            className="flex-1 rounded-xl"
                            onClick={handleConfirmFilters}
                        >
                            查看结果
                            {draftFilterCount > 0 && (
                                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-xs">
                                    {draftFilterCount}
                                </span>
                            )}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* 项目网格 */}
            <div className="grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project, index) => {
                    const isPriority = index < 2
                    if (projects.length === index + 1) {
                        return (
                            <div ref={lastProjectElementRef} key={project.id}>
                                <ProjectCard project={project} searchQuery={searchQuery} priority={isPriority} />
                            </div>
                        )
                    } else {
                        return <ProjectCard key={project.id} project={project} searchQuery={searchQuery} priority={isPriority} />
                    }
                })}

                {isLoadingMore && (
                    <>
                        {[1, 2, 3].map((i) => (
                            <ProjectCardSkeleton key={`skeleton-${i}`} />
                        ))}
                    </>
                )}
            </div>

            {!isLoadingMore && !isFiltering && projects.length === 0 && (
                <div className="mt-12 flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 text-5xl">🔍</div>
                    <h3 className="text-lg font-semibold">没有找到相关项目</h3>
                    <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                        换个关键词或者类别试试看？
                    </p>
                    <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="mt-5 rounded-full"
                    >
                        清除所有筛选
                    </Button>
                </div>
            )}
        </div>
    )
}
