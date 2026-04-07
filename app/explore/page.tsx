import { getExploreFilterOptions, getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { ExploreClient } from './explore-client'

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    subCategory?: string
    difficulty?: string
    tags?: string
    page?: string
  }>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams
  const parsedPage = Number.parseInt(params.page ?? '0', 10)
  const initialPage = Number.isNaN(parsedPage) ? 0 : Math.max(0, parsedPage)

  const filters: ProjectFilters = {
    searchQuery: params.q,
    category: params.category,
    subCategory: params.subCategory,
    difficulty: params.difficulty as ProjectFilters['difficulty'],
    tags: params.tags?.split(',').filter(Boolean),
  }

  const [{ categories, availableTags, tagScope }, { projects, hasMore }] = await Promise.all([
    getExploreFilterOptions(),
    getProjects(filters, { page: initialPage, pageSize: 12 }),
  ])

  return (
    <ExploreClient
      initialProjects={projects}
      initialHasMore={hasMore}
      initialPage={initialPage}
      categories={categories}
      availableTags={availableTags}
      tagScope={tagScope}
    />
  )
}
