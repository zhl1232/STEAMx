import type { Metadata } from "next";

import { getExploreFilterOptions, getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { normalizeDifficultyParam, parseAgeParam } from '@/lib/content-classification/validation'
import { parseExploreSortBy } from '@/lib/explore/presets'
import { getRecommendationViewerKey } from '@/lib/recommendations/viewer'
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { ExploreClient } from './explore-client'

interface ExplorePageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    subCategory?: string
    difficulty?: string
    age?: string
    tags?: string
    page?: string
    sortBy?: string | string[]
  }>
}

export const metadata: Metadata = buildPageMetadata({
  title: "STEAM 项目探索",
  description:
    "在 STEAMX · 史迪姆浏览科学、技术、工程、艺术、数学项目，按关键词、分类、难度和标签筛选真实可做的动手实践内容。",
  path: "/explore",
  keywords: ["STEAMX 项目", "STEAM项目", "科学实验项目", "创客项目", "积木项目"],
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
    difficulty: normalizeDifficultyParam(params.difficulty) ?? 'all',
    age: parseAgeParam(params.age) ?? undefined,
    tags: params.tags?.split(',').filter(Boolean),
  }
  const sortBy = parseExploreSortBy(firstParam(params.sortBy))
  const viewerKey = await getRecommendationViewerKey()

  const [{ categories, availableTags, popularTags, tagScope }, { projects, hasMore, total }] =
    await Promise.all([
      getExploreFilterOptions(),
      getProjects(filters, {
        page: initialPage,
        pageSize: 12,
        sortBy,
        shuffleSeed: sortBy === 'popular' ? viewerKey : undefined,
        shuffleBatch: 0,
        // 让 popular 排序的翻页也保持五类交错——是否真的混合由 shouldBlendPopularExplore
        // 按筛选条件最终决定（选了 category/tags/search 会自动降级回单类语义）。
        blendPopular: sortBy === 'popular',
      }),
    ])

  return (
    <>
    <JsonLd
      data={buildBreadcrumbJsonLd([
        { name: "首页", url: "/" },
        { name: "项目探索", url: "/explore" },
      ])}
    />
    <ExploreClient
      initialProjects={projects}
      initialHasMore={hasMore}
      initialTotal={total}
      initialPage={initialPage}
      categories={categories}
      availableTags={availableTags}
      popularTags={popularTags}
      tagScope={tagScope}
    />
    </>
  )
}
