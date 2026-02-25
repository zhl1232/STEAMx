import { getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { ExploreClient } from './explore-client'
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
        difficulty: params.difficulty as ProjectFilters['difficulty'],
    }

    // 服务端获取首屏数据
    const { projects, hasMore } = await getProjects(filters, { page: 0, pageSize: 12 })

    return (
        <ExploreClient
            key={JSON.stringify(params)}
            initialProjects={projects}
            initialHasMore={hasMore}
            categories={categories}
            availableTags={allTags}
        />
    )
}

