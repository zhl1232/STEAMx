"use client"

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { ProjectCard } from '@/components/features/project-card'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'
import { useAuth } from '@/context/auth-context'

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
    categories?: string[]
    availableTags?: string[]  // 从数据库获取的可用标签
}

export function ExploreClient({ initialProjects, initialHasMore, categories: propCategories, availableTags = [] }: ExploreClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const { user } = useAuth()

    const displayCategories = propCategories || defaultCategories

    // 从 URL 初始化状态
    const initialQuery = searchParams.get("q") || ""
    const initialCategory = searchParams.get("category") || "全部"
    const initialSubCategory = searchParams.get("subCategory") || ""
    const initialDifficulty = searchParams.get("difficulty") || "all"
    const initialTags = searchParams.get("tags")?.split(",").filter(Boolean) || []

    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const observer = useRef<IntersectionObserver | null>(null)

    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory)
    const [selectedDifficulty, setSelectedDifficulty] = useState(initialDifficulty)
    const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
    const [searchQuery, setSearchQuery] = useState(initialQuery)
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(
        !!initialSubCategory || initialDifficulty !== "all" || initialTags.length > 0
    )

    // 获取当前主分类对应的子分类
    const currentSubCategories = selectedCategory === "全部"
        ? Object.values(CATEGORY_CONFIG).flat()
        : CATEGORY_CONFIG[selectedCategory] || []

    // 构建 URL 参数
    const buildSearchParams = (overrides: {
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
    }

    // 加载更多项目
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return

        setIsLoadingMore(true)
        const params = buildSearchParams()
        params.set('page', String(page))

        try {
            const response = await fetch(`/api/projects?${params.toString()}`)
            const data = await response.json()
            setProjects(prev => [...prev, ...data.projects])
            setHasMore(data.hasMore)
            setPage(prev => prev + 1)
        } catch (error) {
            console.error('Error loading more projects:', error)
        } finally {
            setIsLoadingMore(false)
        }
    }, [isLoadingMore, hasMore, page, searchQuery, selectedCategory, selectedSubCategory, selectedDifficulty, selectedTags])

    // 无限滚动观察器
    const lastProjectElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoadingMore) return
        if (observer.current) observer.current.disconnect()

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                loadMore()
            }
        })

        if (node) observer.current.observe(node)
    }, [isLoadingMore, hasMore, loadMore])

    // 执行筛选
    const executeFilter = (params: URLSearchParams) => {
        setPage(1)
        setProjects([])

        startTransition(async () => {
            try {
                const response = await fetch(`/api/projects?${params.toString()}`)
                const data = await response.json()
                setProjects(data.projects)
                setHasMore(data.hasMore)
            } catch (error) {
                console.error('Error fetching projects:', error)
            }
            router.push(`/explore?${params.toString()}`)
        })
    }



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
        setPage(1)
        setProjects([])

        startTransition(async () => {
            try {
                const response = await fetch('/api/projects')
                const data = await response.json()
                setProjects(data.projects)
                setHasMore(data.hasMore)
            } catch (error) {
                console.error('Error fetching projects:', error)
            }
            router.push('/explore')
        })
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
        <div className="container mx-auto py-8">
            <div className="flex flex-col gap-6 mb-8">
                {/* 标题和搜索栏 */}
                <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">探索项目</h1>
                        <p className="text-muted-foreground">探索社区中最酷的 STEAM 创意。</p>
                    </div>
                    {/* Global search is now in the header */}
                </div>

                {/* 主分类标签 */}
                <div className="flex flex-wrap gap-2">
                    {displayCategories.map((category) => (
                        <button
                            key={category}
                            onClick={() => handleCategoryClick(category)}
                            disabled={isPending}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
                                selectedCategory === category
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-muted text-muted-foreground border-input",
                                isPending && "opacity-50 cursor-not-allowed"
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
                                                disabled={isPending}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                    selectedSubCategory === sub
                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                    isPending && "opacity-50 cursor-not-allowed"
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
                                            disabled={isPending}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                selectedDifficulty === option.value
                                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                    : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                isPending && "opacity-50 cursor-not-allowed"
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
                                                disabled={isPending}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-sm font-medium transition-all border",
                                                    selectedTags.includes(tag)
                                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                                        : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5",
                                                    isPending && "opacity-50 cursor-not-allowed"
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project, index) => {
                    if (projects.length === index + 1) {
                        return (
                            <div ref={lastProjectElementRef} key={project.id}>
                                <ProjectCard project={project} searchQuery={searchQuery} />
                            </div>
                        )
                    } else {
                        return <ProjectCard key={project.id} project={project} searchQuery={searchQuery} />
                    }
                })}

                {(isLoadingMore || isPending) && (
                    <>
                        {[1, 2, 3].map((i) => (
                            <ProjectCardSkeleton key={`skeleton-${i}`} />
                        ))}
                    </>
                )}
            </div>

            {/* 空状态 */}
            {!isLoadingMore && !isPending && projects.length === 0 && (
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
