"use client"

import { useState, useRef, useCallback, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProjectCard } from '@/components/features/project-card'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { AdvancedSearch } from '@/components/features/advanced-search'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/mappers/types'

const categories = ["全部", "科学", "技术", "工程", "艺术", "数学", "其他"]  // fallback

interface ExploreClientProps {
    initialProjects: Project[]
    initialHasMore: boolean
    categories?: string[]  // 从服务端传入的分类
}

export function ExploreClient({ initialProjects, initialHasMore, categories: propCategories }: ExploreClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    // 使用传入的分类或回退到默认值
    const displayCategories = propCategories || categories

    const initialQuery = searchParams.get("q") || ""
    const initialCategory = searchParams.get("category") || "全部"

    const [projects, setProjects] = useState<Project[]>(initialProjects)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(initialHasMore)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const observer = useRef<IntersectionObserver | null>(null)

    const [selectedCategory, setSelectedCategory] = useState(initialCategory)
    const [searchQuery, setSearchQuery] = useState(initialQuery)
    const [searchKey, setSearchKey] = useState(0) // 用于强制重置 AdvancedSearch
    const [advancedFilters, setAdvancedFilters] = useState({
        difficulty: "all",
        duration: [0, 120],
        materials: [] as string[]
    })

    // 加载更多项目（客户端分页）
    const loadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return

        setIsLoadingMore(true)

        const params = new URLSearchParams()
        if (searchQuery) params.set('q', searchQuery)
        if (selectedCategory !== '全部') params.set('category', selectedCategory)
        if (advancedFilters.difficulty !== 'all') params.set('difficulty', advancedFilters.difficulty)
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
    }, [isLoadingMore, hasMore, page, searchQuery, selectedCategory, advancedFilters])

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

    // 处理筛选变化（触发服务端重新获取）
    const handleFilterChange = async (category?: string, query?: string, filters?: any) => {
        const params = new URLSearchParams()

        const newCategory = category !== undefined ? category : selectedCategory
        const newQuery = query !== undefined ? query : searchQuery
        const newFilters = filters !== undefined ? filters : advancedFilters

        if (newQuery) params.set('q', newQuery)
        if (newCategory !== '全部') params.set('category', newCategory)
        if (newFilters.difficulty !== 'all') params.set('difficulty', newFilters.difficulty)

        if (category !== undefined) setSelectedCategory(category)
        if (query !== undefined) setSearchQuery(query)
        if (filters !== undefined) setAdvancedFilters(filters)

        // 重置分页和项目列表
        setPage(1)
        setProjects([])

        // 从服务端获取新的数据
        startTransition(async () => {
            try {
                const response = await fetch(`/api/projects?${params.toString()}`)
                const data = await response.json()
                setProjects(data.projects)
                setHasMore(data.hasMore)
            } catch (error) {
                console.error('Error fetching projects:', error)
            }

            // 同时更新 URL（用于刷新页面时保持状态）
            router.push(`/explore?${params.toString()}`)
        })
    }

    const handleSearch = (query: string, filters: any) => {
        handleFilterChange(undefined, query, filters)
    }

    const handleCategoryClick = (category: string) => {
        handleFilterChange(category, undefined, undefined)
    }

    const handleClearFilters = async () => {
        setSearchQuery("")
        setSelectedCategory("全部")
        setAdvancedFilters({
            difficulty: "all",
            duration: [0, 120],
            materials: []
        })
        setPage(1)
        setProjects([])
        setSearchKey(prev => prev + 1) // 强制 AdvancedSearch 重新挂载

        startTransition(async () => {
            try {
                // 获取所有项目（无筛选）
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

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">探索项目</h1>
                        <p className="text-muted-foreground">探索社区中最酷的 STEAM 创意。</p>
                    </div>
                    <div className="flex w-full items-center space-x-2 md:w-auto md:min-w-[400px]">
                        <AdvancedSearch key={searchKey} onSearch={handleSearch} />
                    </div>
                </div>

                {/* Category Filter Chips */}
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
            </div>

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
