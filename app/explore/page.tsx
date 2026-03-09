import { getExploreFilterOptions, getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { ExploreClient } from './explore-client'

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    difficulty?: string
    page?: string
  }>
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams

  const filters: ProjectFilters = {
    searchQuery: params.q,
    category: params.category,
    difficulty: params.difficulty as ProjectFilters['difficulty'],
  }

  const [{ categories, availableTags }, { projects, hasMore }] = await Promise.all([
    getExploreFilterOptions(),
    getProjects(filters, { page: 0, pageSize: 12 }),
  ])

  return (
    <ExploreClient
      key={JSON.stringify(params)}
      initialProjects={projects}
      initialHasMore={hasMore}
      categories={categories}
      availableTags={availableTags}
    />
  )
}
