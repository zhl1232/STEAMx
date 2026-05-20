import type { Metadata } from "next";

import { getExploreFilterOptions, getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { getExploreForYouInitialData } from '@/lib/explore/recommendations'
import { parseExploreSortBy } from '@/lib/explore/presets'
import { buildPageMetadata } from "@/lib/seo/metadata";
import { ExploreClient } from './explore-client'

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    subCategory?: string
    difficulty?: string
    tags?: string
    page?: string
    sortBy?: string | string[]
  }>
}

export const metadata: Metadata = buildPageMetadata({
  title: "项目探索",
  description:
    "浏览 STEAM 科学、技术、工程、艺术、数学项目，按关键词、分类、难度和标签筛选真实可做的项目式学习内容。",
  path: "/explore",
  keywords: ["STEAM项目", "科学实验项目", "项目式学习案例", "创客项目"],
});

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
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
  const sortBy = parseExploreSortBy(firstParam(params.sortBy))

  const [{ categories, availableTags, popularTags, tagScope }, { projects, hasMore, total }, initialForYou] =
    await Promise.all([
      getExploreFilterOptions(),
      getProjects(filters, { page: initialPage, pageSize: 12, sortBy }),
      getExploreForYouInitialData(),
    ])

  return (
    <ExploreClient
      initialProjects={projects}
      initialHasMore={hasMore}
      initialTotal={total}
      initialPage={initialPage}
      categories={categories}
      availableTags={availableTags}
      popularTags={popularTags}
      tagScope={tagScope}
      initialForYou={initialForYou}
    />
  )
}
