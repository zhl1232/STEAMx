import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildExplorePageHref, parseExplorePage } from "@/lib/seo/explore-pagination";

import { getExploreFilterOptions, getProjects, type ProjectFilters } from '@/lib/api/explore-data'
import { normalizeDifficultyParam, parseAgeParam } from '@/lib/content-classification/validation'
import { normalizeExploreThemeTags, parseExploreSortBy } from '@/lib/explore/presets'
import { buildExploreFiltersKey } from '@/lib/explore-scroll-restore'
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

export async function generateMetadata({ searchParams }: ExplorePageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = parseExplorePage(params.page);
  const query = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = firstParam(raw);
    if (value) query.set(key, value);
  }
  if (parseExploreSortBy(query.get('sortBy')) === 'latest') query.set('sortBy', 'latest');
  else query.delete('sortBy');
  const themeTags = normalizeExploreThemeTags(query.get('tags'));
  if (themeTags.length > 0) query.set('tags', themeTags.join(','));
  else query.delete('tags');
  const filtered = ['q', 'category', 'subCategory', 'difficulty', 'age', 'tags']
    .some((key) => Boolean(query.get(key)));
  const metadata = buildPageMetadata({
    title: `STEAM 项目探索${page > 0 ? ` · 第 ${page + 1} 页` : ''}`,
    description: "在创探空间浏览科学、技术、工程、艺术、数学项目，按关键词、分类、主题和难度筛选真实可做的动手实践内容。",
    path: buildExplorePageHref(query, page),
    keywords: ["STEAM项目", "科学实验项目", "积木项目"],
  });
  // Search and filter combinations are discovery pages, not standalone topics.
  return filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function buildInitialFiltersKey(params: Awaited<ExplorePageProps['searchParams']>): string {
  const query = new URLSearchParams()
  const q = firstParam(params.q)
  const category = firstParam(params.category)
  const subCategory = firstParam(params.subCategory)
  const difficulty = normalizeDifficultyParam(firstParam(params.difficulty))
  const age = parseAgeParam(firstParam(params.age))
  const tags = firstParam(params.tags)
  const sortBy = parseExploreSortBy(firstParam(params.sortBy))

  if (q) query.set('q', q)
  if (category && category !== '全部') query.set('category', category)
  if (subCategory) query.set('subCategory', subCategory)
  if (difficulty) query.set('difficulty', difficulty)
  if (age !== null) query.set('age', String(age))
  const normalizedTags = normalizeExploreThemeTags(tags)
  if (normalizedTags.length > 0) query.set('tags', normalizedTags.join(','))
  if (sortBy !== 'popular') query.set('sortBy', sortBy)
  return buildExploreFiltersKey(query)
}

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const params = await searchParams
  const initialPage = parseExplorePage(params.page)

  const filters: ProjectFilters = {
    searchQuery: params.q,
    category: params.category,
    subCategory: params.subCategory,
    difficulty: normalizeDifficultyParam(params.difficulty) ?? 'all',
    age: parseAgeParam(params.age) ?? undefined,
    tags: normalizeExploreThemeTags(firstParam(params.tags)),
  }
  const sortBy = parseExploreSortBy(firstParam(params.sortBy))
  const viewerKey = await getRecommendationViewerKey()

  const [{ categories, availableTags, popularTags, tagScope }, { projects, hasMore, total }] =
    await Promise.all([
      getExploreFilterOptions(),
      getProjects(filters, {
        strictErrors: true,
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

  if (initialPage > 0 && projects.length === 0) notFound();

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
      initialFiltersKey={buildInitialFiltersKey(params)}
    />
    </>
  )
}
