"use client"

import Link from 'next/link'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { ProjectCard } from '@/components/features/project-card'
import { useProjects } from '@/context/project-context'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'
// import { useAuth } from '@/context/auth-context'

// 类别配置：主分类 -> 子分类映射
import { CATEGORY_CONFIG } from '@/lib/config/categories'

// 难度选项
const DIFFICULTY_OPTIONS = [
    { value: "all", label: "全部难度" },
    { value: "1-2", label: "⭐⭐ 入门 (1-2星)" },
    { value: "3-4", label: "⭐⭐⭐ 进阶 (3-4星)" },
    { value: "5-6", label: "⭐⭐⭐⭐⭐ 挑战 (5-6星)" },
]

const defaultCategories = ["全部", "科学", "技术", "工程", "艺术", "数学", "其他"]

interface ExploreClientProps {
    initialProjects: Project[]
    initialHasMore: boolean
    initialPage?: number
    categories?: string[]
    availableTags?: string[]  // 从数据库获取的可用标签
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
    // const { user } = useAuth()

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
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(
        !!initialSubCategory || initialDifficulty !== "all" || initialTags.length > 0
    )

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
        setShowAdvancedFilters(!!nextSubCategory || nextDifficulty !== "all" || nextTags.length > 0)
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

    // 获取当前主分类对应的子分类
    const currentSubCategories = useMemo(() => (
        selectedCategory === "全部"
            ? Object.values(CATEGORY_CONFIG).flat()
            : CATEGORY_CONFIG[selectedCategory] || []
    ), [selectedCategory])

    // 构建 URL 参数
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

    // 加载更多项目
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

    // 无限滚动观察器
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

    // 执行筛选
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



    // 处理主分类点击
    const handleCategoryClick = (category: string) => {
        setSelectedCategory(category)
        // 切换主分类时清空子分类选择
        setSelectedSubCategory("")
        const params = buildSearchParams({ category, subCategory: "" })
        executeFilter(params)
    }

    // 处理子分类点击（单选）
    const handleSubCategoryClick = (subCategory: string) => {
        const newSubCategory = selectedSubCategory === subCategory ? "" : subCategory
        setSelectedSubCategory(newSubCategory)
        const params = buildSearchParams({ subCategory: newSubCategory })
        executeFilter(params)
    }

    // 处理难度筛选
    const handleDifficultyClick = (difficulty: string) => {
        setSelectedDifficulty(difficulty)
        const params = buildSearchParams({ difficulty })
        executeFilter(params)
    }

    // 处理标签点击（多选）
    const handleTagClick = (tag: string) => {
        const newTags = selectedTags.includes(tag)
            ? selectedTags.filter(t => t !== tag)
            : [...selectedTags, tag]
        setSelectedTags(newTags)
        const params = buildSearchParams({ tags: newTags })
        executeFilter(params)
    }

    // 清除所有筛选
    const handleClearFilters = () => {
        setSearchQuery("")
        setSelectedCategory("全部")
        setSelectedSubCategory("")
        setSelectedDifficulty("all")
        setSelectedTags([])
        executeFilter(new URLSearchParams())
    }

    // 清除子分类选择
    const handleClearSubCategory = () => {
        setSelectedSubCategory("")
        const params = buildSearchParams({ subCategory: "" })
        executeFilter(params)
    }

    // 清除标签选择
    const handleClearTags = () => {
        setSelectedTags([])
        const params = buildSearchParams({ tags: [] })
        executeFilter(params)
    }

    const hasActiveFilters = !!selectedSubCategory || selectedDifficulty !== "all" || selectedTags.length > 0

    return (
        <div className="container mx-auto py-4 md:py-8 px-4">
            <div className="flex flex-col gap-6 mb-6 md:mb-8">
                {/* 标题和搜索栏 */}
                <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">探索项目</h1>
                        <p className="text-sm md:text-base text-muted-foreground">探索社区中最酷的 STEAM 创意。</p>
                    </div>
                </div>

                <div className="rounded-2xl border bg-card px-5 py-5 shadow-sm">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                                自然观察频道
                            </div>
                            <h2 className="text-lg font-semibold">从自然观察频道开始你的第一次观鸟</h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                你可以先进入自然观察频道，再从活动、项目、物种和观察记录中找到最适合自己的开始方式。
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Link
                                href="/bird-observation"
                                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                            >
                                进入频道
                            </Link>
                            <Link
                                href="/explore?category=%E7%A7%91%E5%AD%A6&subCategory=%E5%8A%A8%E7%89%A9%E8%A7%82%E5%AF%9F&tags=%E9%B8%9F%E7%B1%BB"
                                className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                            >
                                筛选鸟类项目
                            </Link>
                        </div>
                    </div>
                </div>

                {/* 主分类标签 */}
                <div className="flex flex-wrap gap-2">
                    {displayCategories.map((category) => (
                        <button
                            key={category}
                            onClick={() => handleCategoryClick(category)}
                            disabled={isFiltering}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                selectedCategory === category
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-muted text-muted-foreground border-input",
                                isFiltering && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {/* 更多筛选折叠区域 */}
                <div className="space-y-4">
                    <button
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showAdvancedFilters ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                        更多筛选
                        {hasActiveFilters && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                                {(selectedSubCategory ? 1 : 0) + (selectedDifficulty !== "all" ? 1 : 0) + selectedTags.length}
                            </span>
                        )}
                    </button>

                    {showAdvancedFilters && (
                        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                            {/* 子分类筛选 */}
                            {currentSubCategories.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">子分类</span>
                                        {selectedSubCategory && (
                                            <button
                                                onClick={handleClearSubCategory}
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                            >
                                                <X className="h-3 w-3" />
                                                清除
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {currentSubCategories.map((sub) => (
                                            <button
                                                key={sub}
                                                onClick={() => handleSubCategoryClick(sub)}
                                                disabled={isFiltering}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                    selectedSubCategory === sub
                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                    isFiltering && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 难度筛选 */}
                            <div className="space-y-2">
                                <span className="text-sm font-medium">难度等级</span>
                                <div className="flex flex-wrap gap-2">
                                    {DIFFICULTY_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleDifficultyClick(option.value)}
                                            disabled={isFiltering}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                selectedDifficulty === option.value
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                    : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                isFiltering && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 标签筛选（多选）*/}
                            {availableTags.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">标签筛选</span>
                                        {selectedTags.length > 0 && (
                                            <button
                                                onClick={handleClearTags}
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                            >
                                                <X className="h-3 w-3" />
                                                清除 ({selectedTags.length})
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {availableTags.map((tag) => (
                                            <button
                                                key={tag}
                                                onClick={() => handleTagClick(tag)}
                                                disabled={isFiltering}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                    selectedTags.includes(tag)
                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                    isFiltering && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {tag}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 项目列表 */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

            {/* 空状态 */}
            {!isLoadingMore && !isFiltering && projects.length === 0 && (
                <div className="text-center py-20">
                    <div className="text-4xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold mb-2">没有找到相关项目</h3>
                    <p className="text-muted-foreground">
                        换个关键词或者类别试试看？
                    </p>
                    <Button
                        variant="link"
                        onClick={handleClearFilters}
                        className="mt-4"
                    >
                        清除所有筛选
                    </Button>
                </div>
            )}
        </div>
    )
}
