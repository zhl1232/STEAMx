import { Suspense } from 'react'
import { getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { ExploreClient } from './explore-client'
import { ProjectCardSkeleton } from '@/components/ui/loading-skeleton'
import { createClient } from '@/lib/supabase/server'

interface ExplorePageProps {
    searchParams: Promise<{
        q?: string
        category?: string
        difficulty?: string
        page?: string
    }>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
    // Await searchParams (required in Next.js 15)
    const params = await searchParams

    // 获取分类数据
    const supabase = await createClient()
    const { data: categoriesData } = await supabase
        .from('categories')
        .select('name')
        .order('sort_order') as { data: { name: string }[] | null }

    const categories = ['全部', ...(categoriesData?.map(c => c.name) || [])]

    // 获取所有可用的 tags
    const { data: tagsData } = await supabase
        .from('projects')
        .select('tags')
        .eq('status', 'approved')
        .not('tags', 'is', null) as { data: { tags: string[] | null }[] | null }

    // 提取并去重所有 tags，排除与主分类重复的标签
    const categoryNames = new Set(categories)
    const allTags = Array.from(new Set(
        (tagsData || [])
            .flatMap(p => p.tags || [])
            .filter(tag => tag && !categoryNames.has(tag))
    )).sort() as string[]

    // 构建筛选条件
    const filters: ProjectFilters = {
        searchQuery: params.q,
        category: params.category,
        difficulty: params.difficulty as any,
    }

    // 服务端获取首屏数据
    const { projects, hasMore } = await getProjects(filters, { page: 0, pageSize: 12 })

    return (
        <Suspense fallback={<LoadingSkeleton />}>
            <ExploreClient
                key={JSON.stringify(params)}
                initialProjects={projects}
                initialHasMore={hasMore}
                categories={categories}
                availableTags={allTags}
            />
        </Suspense>
    )
}

function LoadingSkeleton() {
    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">探索项目</h1>
                        <p className="text-muted-foreground">探索社区中最酷的 STEAM 创意。</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <ProjectCardSkeleton key={`skeleton-${i}`} />
                ))}
            </div>
        </div>
    )
}
