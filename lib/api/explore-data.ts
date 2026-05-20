/**
 * 探索页面数据获取函数
 * 用于服务端组件中获取项目列表
 */

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { isPlaywrightSmoke } from "@/lib/testing/playwright-smoke";
import {
  mapDbProject,
  mapDbCompletion,
  mapDbComment,
  type Project,
  type ProjectCompletion,
  type Comment,
} from "@/lib/mappers/types";
import { sanitizeSearch } from "@/lib/api/validation";
import { logger } from "@/lib/logger";

/** 查询结果行类型（含关联），用于在 Supabase 推断为 SelectQueryError 时做断言 */
type ProjectRowForMapper = Parameters<typeof mapDbProject>[0];
type CompletionRowForMapper = Omit<Parameters<typeof mapDbCompletion>[0], "profiles">;
export type ExploreTagScope = {
  all: string[];
  byCategory: Record<string, string[]>;
  bySubCategory: Record<string, string[]>;
};

type ExploreFilterOptions = {
  categories: string[];
  availableTags: string[];
  /** 按在项目中的出现次数降序，用于侧栏「热门标签」 */
  popularTags: string[];
  tagScope: ExploreTagScope;
};

type SmokeProject = Project & {
  createdAt: string;
};

const SMOKE_CATEGORIES = ["全部", "科学", "工程", "艺术"];

const SMOKE_PROJECTS: SmokeProject[] = [
  {
    id: 101,
    title: "磁力寻宝实验",
    author: "Smoke Teacher",
    author_id: "smoke-user-1",
    image: "/projects/magnet_fishing.webp",
    category: "科学",
    sub_category: "物理",
    likes: 42,
    comments_count: 6,
    coins_count: 2,
    description: "用磁铁观察不同材料的吸附差异，记录实验结果。",
    materials: ["磁铁", "水桶", "金属小物件"],
    steps: [
      { title: "准备材料", description: "准备磁铁和待观察的材料。" },
      { title: "开始实验", description: "记录哪些材料会被吸附。" },
    ],
    difficulty: "easy",
    difficulty_stars: 2,
    tags: ["磁力", "观察"],
    status: "approved",
    createdAt: "2026-03-06T09:00:00.000Z",
  },
  {
    id: 102,
    title: "翻滚杯玩具",
    author: "Maker Lab",
    author_id: "smoke-user-2",
    image: "/projects/tumbler_toy.webp",
    category: "工程",
    sub_category: "结构",
    likes: 58,
    comments_count: 9,
    coins_count: 4,
    description: "用重心和平衡原理制作一个会自动站起来的小玩具。",
    materials: ["纸杯", "橡皮泥", "贴纸"],
    steps: [
      { title: "搭主体", description: "制作外壳并预留配重空间。" },
      { title: "调重心", description: "不断调整底部配重。" },
    ],
    difficulty: "medium",
    difficulty_stars: 4,
    tags: ["平衡", "结构"],
    status: "approved",
    createdAt: "2026-03-08T10:30:00.000Z",
  },
  {
    id: 103,
    title: "手工杯垫编织",
    author: "Creative Corner",
    author_id: "smoke-user-3",
    image: "/projects/handmade_coaster.webp",
    category: "艺术",
    sub_category: "手工",
    likes: 27,
    comments_count: 3,
    coins_count: 1,
    description: "从配色到编织，完成一个可重复制作的家居小物件。",
    materials: ["毛线", "针", "剪刀"],
    steps: [
      { title: "选择配色", description: "准备主色与点缀色。" },
      { title: "完成编织", description: "按顺序完成杯垫。" },
    ],
    difficulty: "easy",
    difficulty_stars: 3,
    tags: ["编织", "配色"],
    status: "approved",
    createdAt: "2026-03-04T08:15:00.000Z",
  },
];

const SMOKE_TAGS = Array.from(new Set(SMOKE_PROJECTS.flatMap((project) => project.tags || []))).sort();
const EXPLORE_FILTER_OPTIONS_TTL_MS = 5 * 60 * 1000;
let cachedExploreFilterOptions:
  | { data: ExploreFilterOptions; expiresAt: number }
  | null = null;
let exploreFilterOptionsPromise: Promise<ExploreFilterOptions> | null = null;

function sortLabels(labels: Iterable<string>): string[] {
  return Array.from(new Set(labels)).sort((left, right) =>
    left.localeCompare(right, "zh-Hans-CN", { sensitivity: "base" }),
  );
}

/** 与 `buildTagScope` 相同的排除规则，按标签被多少个项目使用排序 */
function rankTagsByPopularity(
  entries: Array<{ tags?: string[] | null }>,
  excludedNames: Set<string>,
): string[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    for (const tag of entry.tags || []) {
      if (!tag || excludedNames.has(tag)) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        a[0].localeCompare(b[0], "zh-Hans-CN", { sensitivity: "base" }),
    )
    .map(([tag]) => tag);
}

function buildTagScope(
  entries: Array<{ category?: string | null; subCategory?: string | null; tags?: string[] | null }>,
  excludedNames: Set<string>,
): ExploreTagScope {
  const allTags = new Set<string>();
  const categoryTags = new Map<string, Set<string>>();
  const subCategoryTags = new Map<string, Set<string>>();

  for (const entry of entries) {
    const tags = (entry.tags || []).filter((tag) => tag && !excludedNames.has(tag));
    if (tags.length === 0) continue;

    for (const tag of tags) {
      allTags.add(tag);

      if (entry.category) {
        if (!categoryTags.has(entry.category)) {
          categoryTags.set(entry.category, new Set());
        }
        categoryTags.get(entry.category)?.add(tag);
      }

      if (entry.subCategory) {
        if (!subCategoryTags.has(entry.subCategory)) {
          subCategoryTags.set(entry.subCategory, new Set());
        }
        subCategoryTags.get(entry.subCategory)?.add(tag);
      }
    }
  }

  return {
    all: sortLabels(allTags),
    byCategory: Object.fromEntries(
      Array.from(categoryTags.entries()).map(([category, tags]) => [category, sortLabels(tags)]),
    ),
    bySubCategory: Object.fromEntries(
      Array.from(subCategoryTags.entries()).map(([subCategory, tags]) => [subCategory, sortLabels(tags)]),
    ),
  };
}

/**
 * 项目筛选参数
 */
export interface ProjectFilters {
  category?: string;
  subCategory?: string; // 按子分类筛选（单选）
  difficulty?: "easy" | "medium" | "hard" | "all" | "1" | "2" | "3" | "4" | "5" | "1-2" | "3-4" | "5-6";
  materials?: string[];
  tags?: string[]; // 标签筛选（多选）
  searchQuery?: string;
}

/** 热门列表首页在「无筛选、全部类」时多取一批再按类轮询穿插，避免单一分类霸屏 */
const EXPLORE_POPULAR_BLEND_POOL_MULTIPLIER = 4;
const EXPLORE_POPULAR_BLEND_POOL_MAX = 200;
const EXPLORE_POPULAR_CATEGORY_BLEND_ORDER = ["科学", "技术", "工程", "艺术", "数学"] as const;
const PROJECT_LIST_BASE_SELECT = [
  "id",
  "title",
  "author_id",
  "image_url",
  "category",
  "sub_category_id",
  "likes_count",
  "views_count",
  "coins_count",
  "comments_count",
  "description",
  "difficulty",
  "difficulty_stars",
  "tags",
  "status",
  "rejection_reason",
  "challenge_id",
].join(",");
const PROJECT_LIST_PROJECT_STEPS_SELECT = "project_steps (title, description, image_url, sort_order)";
const PROJECT_LIST_MATERIALS_SELECT = "project_materials (material, sort_order)";
const PROJECT_LIST_MATERIALS_FILTER_SELECT = "project_materials!inner (material, sort_order)";
const PROJECT_LIST_SUB_CATEGORIES_SELECT = "sub_categories (name)";
const PROJECT_LIST_SUB_CATEGORIES_FILTER_SELECT = "sub_categories!inner (name)";
const PROJECT_LIST_PROFILE_SELECT = "profiles:author_id (display_name)";

function shouldBlendPopularExplore(filters: ProjectFilters, pagination: PaginationOptions): boolean {
  const { page = 0, sortBy = "popular", blendPopular = false } = pagination;
  if (sortBy !== "popular") return false;
  if (!blendPopular && page !== 0) return false;
  const { category, subCategory, difficulty, materials, tags, searchQuery } = filters;
  if (category && category !== "全部") return false;
  if (subCategory) return false;
  if (difficulty && difficulty !== "all") return false;
  if (materials?.length) return false;
  if (tags?.length) return false;
  if (searchQuery?.trim()) return false;
  return true;
}

/** @internal Exported for regression tests around category-balanced popular blending. */
export function diversifyPopularByCategoryForTest<T extends { id: string | number; category?: string | null }>(
  rows: T[],
  targetLen: number,
): T[] {
  return diversifyPopularByCategory(rows, targetLen);
}

function diversifyPopularByCategory<T extends { id: string | number; category?: string | null }>(
  rows: T[],
  targetLen: number,
): T[] {
  if (rows.length === 0 || targetLen <= 0) return [];

  const byCat = new Map<string, T[]>();
  for (const row of rows) {
    const c = row.category || "其他";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(row);
  }

  const catRotation: string[] = [...EXPLORE_POPULAR_CATEGORY_BLEND_ORDER];
  for (const c of byCat.keys()) {
    if (!catRotation.includes(c)) catRotation.push(c);
  }

  const used = new Set<string>();
  const keyOf = (id: string | number) => String(id);
  const out: T[] = [];

  const maxPasses = rows.length * catRotation.length + 1;
  for (let pass = 0; pass < maxPasses && out.length < targetLen; pass++) {
    let addedThisPass = false;
    for (const cat of catRotation) {
      if (out.length >= targetLen) break;
      const bucket = byCat.get(cat);
      if (!bucket?.length) continue;
      const pick = bucket.find((r) => !used.has(keyOf(r.id)));
      if (!pick) continue;
      used.add(keyOf(pick.id));
      out.push(pick);
      addedThisPass = true;
    }
    if (!addedThisPass) break;
  }

  for (const row of rows) {
    if (out.length >= targetLen) break;
    if (!used.has(keyOf(row.id))) {
      used.add(keyOf(row.id));
      out.push(row);
    }
  }

  return out;
}

function getSmokeInteractionRawScore(project: SmokeProject): number {
  return (
    (project.likes ?? 0) * 1 +
    (project.comments_count ?? 0) * 2 +
    (project.coins_count ?? 0) * 3
  );
}

function getSmokePopularScore(project: SmokeProject): number {
  const raw = getSmokeInteractionRawScore(project);
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(project.createdAt).getTime()) / 86_400_000,
  );
  const decayed = raw / Math.pow(ageDays + 14, 1.2);
  const weekly = getSmokeInteractionRawScore(project);
  return 0.75 * decayed + 0.25 * weekly;
}

function buildExploreSelectStatement(filters: Pick<ProjectFilters, "materials" | "subCategory">): string {
  const materialsJoin = filters.materials && filters.materials.length > 0
    ? PROJECT_LIST_MATERIALS_FILTER_SELECT
    : PROJECT_LIST_MATERIALS_SELECT;
  const subCategoriesJoin = filters.subCategory
    ? PROJECT_LIST_SUB_CATEGORIES_FILTER_SELECT
    : PROJECT_LIST_SUB_CATEGORIES_SELECT;
  return `
      ${PROJECT_LIST_BASE_SELECT},
      ${PROJECT_LIST_PROFILE_SELECT},
      ${materialsJoin},
      ${PROJECT_LIST_PROJECT_STEPS_SELECT},
      ${subCategoriesJoin}
    `;
}

function buildExploreRankingFilterArgs(
  filters: ProjectFilters,
  limit: number,
  offset: number,
  categoryOverride?: string | null,
) {
  const { category, subCategory, difficulty, materials, tags, searchQuery } = filters;
  const sanitizedSearch = searchQuery ? sanitizeSearch(searchQuery) : "";
  const starsRange = resolveDifficultyStarsRange(difficulty);
  const resolvedCategory = categoryOverride !== undefined
    ? categoryOverride
    : category && category !== "全部"
      ? category
      : null;

  return {
    rpcArgs: {
      p_limit: limit,
      p_offset: offset,
      p_category: resolvedCategory,
      p_sub_category: subCategory || null,
      p_difficulty_stars_min: starsRange.min,
      p_difficulty_stars_max: starsRange.max,
      p_tags: tags?.length ? tags : null,
      p_search: sanitizedSearch || null,
      p_materials: materials?.length ? materials : null,
    },
    starsRange,
  };
}

async function hydrateExploreProjectsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectIds: number[],
  filters: ProjectFilters,
  starsRange: ReturnType<typeof resolveDifficultyStarsRange>,
): Promise<Project[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const selectStatement = buildExploreSelectStatement(filters);
  const { data: rows, error: hydrateError } = await supabase
    .from("projects")
    .select(selectStatement)
    .eq("status", "approved")
    .in("id", projectIds);

  if (hydrateError) {
    logger.error("Error hydrating explore projects", { error: hydrateError });
    return [];
  }

  const idOrder = new Map(projectIds.map((id, index) => [id, index]));
  let projects = ((rows || []) as unknown as ProjectRowForMapper[])
    .map(mapDbProject)
    .sort(
      (left, right) =>
        (idOrder.get(Number(left.id)) ?? 0) - (idOrder.get(Number(right.id)) ?? 0),
    );

  if (starsRange.legacy) {
    projects = projects.filter((project) => project.difficulty === starsRange.legacy);
  }

  return projects;
}

async function fetchPopularProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ProjectFilters,
  pagination: PaginationOptions,
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const { page = 0, pageSize = 12 } = pagination;
  const from = page * pageSize;
  const useBlend = shouldBlendPopularExplore(filters, pagination);

  if (useBlend) {
    const poolLimit = Math.min(
      pageSize * EXPLORE_POPULAR_BLEND_POOL_MULTIPLIER,
      EXPLORE_POPULAR_BLEND_POOL_MAX,
    );
    const [categoryResults, fallbackResult, countResult] = await Promise.all([
      Promise.all(
        EXPLORE_POPULAR_CATEGORY_BLEND_ORDER.map(async (categoryName) => {
          const { rpcArgs, starsRange } = buildExploreRankingFilterArgs(
            filters,
            poolLimit,
            0,
            categoryName,
          );
          const { data, error } = await callRpc(supabase, "get_popular_project_rankings", rpcArgs);
          if (error) {
            logger.error("Error fetching category popular rankings", { error, categoryName });
            return { rankings: [], starsRange };
          }
          return { rankings: data || [], starsRange };
        }),
      ),
      (async () => {
        const { rpcArgs, starsRange } = buildExploreRankingFilterArgs(filters, poolLimit, 0);
        const { data, error } = await callRpc(supabase, "get_popular_project_rankings", rpcArgs);
        if (error) {
          logger.error("Error fetching fallback popular rankings", { error });
          return { rankings: [], starsRange };
        }
        return { rankings: data || [], starsRange };
      })(),
      (async () => {
        const { rpcArgs, starsRange } = buildExploreRankingFilterArgs(filters, 1, 0);
        const { data, error } = await callRpc(supabase, "get_popular_project_rankings", rpcArgs);
        if (error) {
          logger.error("Error fetching popular rankings count", { error });
          return { rankings: [], starsRange };
        }
        return { rankings: data || [], starsRange };
      })(),
    ]);

    const total = Number(countResult.rankings[0]?.total_count ?? 0);
    const seen = new Set<number>();
    const orderedIds: number[] = [];

    for (const categoryResult of categoryResults) {
      for (const row of categoryResult.rankings) {
        if (seen.has(row.project_id)) continue;
        seen.add(row.project_id);
        orderedIds.push(row.project_id);
      }
    }
    for (const row of fallbackResult.rankings) {
      if (seen.has(row.project_id)) continue;
      seen.add(row.project_id);
      orderedIds.push(row.project_id);
    }

    const starsRange = categoryResults[0]?.starsRange ?? fallbackResult.starsRange;
    const hydrated = await hydrateExploreProjectsByIds(
      supabase,
      orderedIds,
      filters,
      starsRange,
    );
    const diversified = diversifyPopularByCategory(hydrated, hydrated.length);
    const projects = diversified.slice(from, from + pageSize);

    return {
      projects,
      total,
      hasMore: from + pageSize < diversified.length,
    };
  }

  const { rpcArgs, starsRange } = buildExploreRankingFilterArgs(filters, pageSize, from);
  const { data, error } = await callRpc(supabase, "get_popular_project_rankings", rpcArgs);

  if (error) {
    logger.error("Error fetching popular project rankings", { error });
    return { projects: [], total: 0, hasMore: false };
  }

  const rankings = data || [];
  if (rankings.length === 0) {
    return { projects: [], total: 0, hasMore: false };
  }

  const total = Number(rankings[0]?.total_count ?? 0);
  const projectIds = rankings.map((row) => row.project_id);
  const projects = await hydrateExploreProjectsByIds(
    supabase,
    projectIds,
    filters,
    starsRange,
  );

  return {
    projects,
    total,
    hasMore: from + projects.length < total,
  };
}

/**
 * 分页参数
 */
export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: "latest" | "popular" | "weekly";
  /** 无筛选热门列表强制分类混合（含换一批等后续页） */
  blendPopular?: boolean;
}

const EXPLORE_WEEKLY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function getWeeklySinceIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - EXPLORE_WEEKLY_LOOKBACK_MS).toISOString();
}

function resolveDifficultyStarsRange(difficulty: string | undefined): {
  min: number | null;
  max: number | null;
  legacy: string | null;
} {
  if (!difficulty || difficulty === "all") {
    return { min: null, max: null, legacy: null };
  }
  if (["1", "2", "3", "4", "5"].includes(difficulty)) {
    const stars = Number(difficulty);
    return { min: stars, max: stars, legacy: null };
  }
  if (difficulty === "1-2") return { min: 1, max: 2, legacy: null };
  if (difficulty === "3-4") return { min: 3, max: 4, legacy: null };
  if (difficulty === "5-6") return { min: 5, max: 6, legacy: null };
  if (["easy", "medium", "hard"].includes(difficulty)) {
    return { min: null, max: null, legacy: difficulty };
  }
  return { min: null, max: null, legacy: null };
}

function getSmokeWeeklyInteractionScore(project: SmokeProject): number {
  return getSmokeInteractionRawScore(project);
}

async function fetchWeeklyHotProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ProjectFilters,
  pagination: PaginationOptions,
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const { page = 0, pageSize = 12 } = pagination;
  const from = page * pageSize;
  const { rpcArgs, starsRange } = buildExploreRankingFilterArgs(filters, pageSize, from);
  const { data, error } = await callRpc(supabase, "get_weekly_hot_project_rankings", {
    ...rpcArgs,
    p_since: getWeeklySinceIso(),
  });

  if (error) {
    logger.error("Error fetching weekly hot project rankings", { error });
    return { projects: [], total: 0, hasMore: false };
  }

  const rankings = data || [];
  if (rankings.length === 0) {
    return { projects: [], total: 0, hasMore: false };
  }

  const total = Number(rankings[0]?.total_count ?? 0);
  const projectIds = rankings.map((row) => row.project_id);
  const projects = await hydrateExploreProjectsByIds(
    supabase,
    projectIds,
    filters,
    starsRange,
  );

  const hasMore = from + projects.length < total;

  return { projects, total, hasMore };
}

function getSmokeProjects(
  filters: ProjectFilters = {},
  pagination: PaginationOptions = {},
): { projects: Project[]; total: number; hasMore: boolean } {
  const { page = 0, pageSize = 12, sortBy = "popular" } = pagination;

  const filteredProjects = SMOKE_PROJECTS.filter((project) => {
    if (filters.category && filters.category !== "全部" && project.category !== filters.category) {
      return false;
    }

    if (filters.subCategory && project.sub_category !== filters.subCategory) {
      return false;
    }

    if (filters.difficulty && filters.difficulty !== "all") {
      const stars = project.difficulty_stars || 0;
      if (["1", "2", "3", "4", "5"].includes(filters.difficulty) && stars !== Number(filters.difficulty)) return false;
      if (filters.difficulty === "1-2" && (stars < 1 || stars > 2)) return false;
      if (filters.difficulty === "3-4" && (stars < 3 || stars > 4)) return false;
      if (filters.difficulty === "5-6" && (stars < 5 || stars > 6)) return false;
      if (["easy", "medium", "hard"].includes(filters.difficulty) && project.difficulty !== filters.difficulty) {
        return false;
      }
    }

    if (filters.materials?.length) {
      const materials = new Set(project.materials || []);
      if (!filters.materials.some((material) => materials.has(material))) {
        return false;
      }
    }

    if (filters.tags?.length) {
      const tags = new Set(project.tags || []);
      if (!filters.tags.every((tag) => tags.has(tag))) {
        return false;
      }
    }

    if (filters.searchQuery) {
      const keyword = filters.searchQuery.toLowerCase();
      const haystack = `${project.title} ${project.description || ""}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });

  const weeklyScoredProjects = sortBy === "weekly"
    ? filteredProjects
        .map((project) => ({
          project,
          score: getSmokeWeeklyInteractionScore(project),
        }))
        .filter(({ score }) => score > 0)
    : null;

  const sortedProjects = weeklyScoredProjects
    ? weeklyScoredProjects
        .sort((left, right) => {
          const delta = right.score - left.score;
          if (delta !== 0) return delta > 0 ? 1 : delta < 0 ? -1 : 0;
          return Number(right.project.id) - Number(left.project.id);
        })
        .map(({ project }) => project)
    : [...filteredProjects].sort((left, right) => {
        if (sortBy === "popular") {
          const delta = getSmokePopularScore(right) - getSmokePopularScore(left);
          if (delta !== 0) return delta > 0 ? 1 : delta < 0 ? -1 : 0;
          return Number(right.id) - Number(left.id);
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });

  const useBlend = shouldBlendPopularExplore(filters, pagination);
  const from = page * pageSize;
  const to = from + pageSize;
  let pageSlice: SmokeProject[];
  let hasMore = to < sortedProjects.length;

  if (useBlend) {
    const poolSize = Math.min(
      pageSize * EXPLORE_POPULAR_BLEND_POOL_MULTIPLIER,
      sortedProjects.length,
      EXPLORE_POPULAR_BLEND_POOL_MAX,
    );
    const pool = sortedProjects.slice(0, poolSize);
    const diversified = diversifyPopularByCategory(pool, pool.length);
    pageSlice = diversified.slice(from, to);
    hasMore = to < diversified.length;
  } else {
    pageSlice = sortedProjects.slice(from, to);
  }

  const projects = pageSlice.map(({ createdAt: _createdAt, ...project }) => project);

  return {
    projects,
    total: sortedProjects.length,
    hasMore,
  };
}

export async function getExploreFilterOptions(): Promise<ExploreFilterOptions> {
  if (isPlaywrightSmoke()) {
    const smokeExcluded = new Set(SMOKE_CATEGORIES);
    const smokeTagScope = buildTagScope(
      SMOKE_PROJECTS.map((project) => ({
        category: project.category,
        subCategory: project.sub_category,
        tags: project.tags,
      })),
      smokeExcluded,
    );
    const smokePopularTags = rankTagsByPopularity(
      SMOKE_PROJECTS.map((project) => ({ tags: project.tags })),
      smokeExcluded,
    );

    return {
      categories: SMOKE_CATEGORIES,
      availableTags: SMOKE_TAGS,
      popularTags: smokePopularTags,
      tagScope: smokeTagScope,
    };
  }

  const now = Date.now();
  if (cachedExploreFilterOptions && cachedExploreFilterOptions.expiresAt > now) {
    return cachedExploreFilterOptions.data;
  }

  if (exploreFilterOptionsPromise) {
    return exploreFilterOptionsPromise;
  }

  exploreFilterOptionsPromise = (async () => {
    const supabase = await createClient();
    const [{ data: categoriesData }, { data: subCategoriesData }, { data: tagsData }] = await Promise.all([
      supabase.from("categories").select("name").order("sort_order"),
      supabase.from("sub_categories").select("name"),
      supabase
        .from("projects")
        .select("category, tags, sub_categories (name)")
        .eq("status", "approved")
        .not("tags", "is", null),
    ]);

    const categories = ["全部", ...((categoriesData as { name: string }[] | null)?.map((category) => category.name) || [])];
    const excludedNames = new Set([
      ...categories,
      ...(((subCategoriesData as { name: string }[] | null) || []).map((subCategory) => subCategory.name)),
    ]);
    const projectRows =
      (tagsData as {
        category: string | null;
        tags: string[] | null;
        sub_categories: { name: string | null } | { name: string | null }[] | null;
      }[] | null) || [];

    const tagScope = buildTagScope(
      projectRows.map((project) => ({
        category: project.category,
        tags: project.tags,
        subCategory: Array.isArray(project.sub_categories)
          ? (project.sub_categories[0]?.name ?? null)
          : (project.sub_categories?.name ?? null),
      })),
      excludedNames,
    );

    const popularTags = rankTagsByPopularity(
      projectRows.map((project) => ({ tags: project.tags })),
      excludedNames,
    );

    const data = { categories, availableTags: tagScope.all, popularTags, tagScope };
    cachedExploreFilterOptions = {
      data,
      expiresAt: Date.now() + EXPLORE_FILTER_OPTIONS_TTL_MS,
    };
    return data;
  })();

  try {
    return await exploreFilterOptionsPromise;
  } finally {
    exploreFilterOptionsPromise = null;
  }
}

/**
 * 获取已审核通过的项目列表
 *
 * @param filters - 筛选条件
 * @param pagination - 分页参数
 * @returns 项目列表和总数
 */
export async function getProjects(
  filters: ProjectFilters = {},
  pagination: PaginationOptions = {},
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  if (isPlaywrightSmoke()) {
    return getSmokeProjects(filters, pagination);
  }

  const supabase = await createClient();

  const {
    category,
    subCategory,
    difficulty,
    materials,
    tags,
    searchQuery,
  } = filters;
  const sanitizedSearch = searchQuery ? sanitizeSearch(searchQuery) : "";

  const { page = 0, pageSize = 12, sortBy = "popular" } = pagination;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (sortBy === "weekly") {
    return fetchWeeklyHotProjects(supabase, filters, pagination);
  }

  if (sortBy === "popular") {
    return fetchPopularProjects(supabase, filters, pagination);
  }

  const materialsJoin = materials && materials.length > 0
    ? PROJECT_LIST_MATERIALS_FILTER_SELECT
    : PROJECT_LIST_MATERIALS_SELECT;
  const subCategoriesJoin = subCategory
    ? PROJECT_LIST_SUB_CATEGORIES_FILTER_SELECT
    : PROJECT_LIST_SUB_CATEGORIES_SELECT;
  const selectStatement = `
      ${PROJECT_LIST_BASE_SELECT},
      ${PROJECT_LIST_PROFILE_SELECT},
      ${materialsJoin},
      ${PROJECT_LIST_PROJECT_STEPS_SELECT},
      ${subCategoriesJoin}
    `;

  let query = supabase
    .from("projects")
    .select(selectStatement, { count: "exact" })
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (sanitizedSearch) {
    query = query.or(`title.ilike.%${sanitizedSearch}%,description.ilike.%${sanitizedSearch}%`);
  }

  if (category && category !== "全部") {
    query = query.eq("category", category);
  }

  if (subCategory) {
    query = query.eq("sub_categories.name", subCategory);
  }

  if (difficulty && difficulty !== "all") {
    if (["1", "2", "3", "4", "5"].includes(difficulty)) {
      query = query.eq("difficulty_stars", Number(difficulty));
    } else if (difficulty === "1-2") {
      query = query.gte("difficulty_stars", 1).lte("difficulty_stars", 2);
    } else if (difficulty === "3-4") {
      query = query.gte("difficulty_stars", 3).lte("difficulty_stars", 4);
    } else if (difficulty === "5-6") {
      query = query.gte("difficulty_stars", 5).lte("difficulty_stars", 6);
    } else {
      query = query.eq("difficulty", difficulty);
    }
  }

  if (tags && tags.length > 0) {
    query = query.contains("tags", tags);
  }

  if (materials && materials.length > 0) {
    query = query.in("project_materials.material", materials);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Error fetching projects", { error });
    return { projects: [], total: 0, hasMore: false };
  }

  const rows = (data || []) as unknown as ProjectRowForMapper[];
  const projects = rows.map(mapDbProject);
  const total = count || 0;
  const hasMore = total > to + 1;

  return { projects, total, hasMore };
}

export async function getProjectAtIndex(
  filters: ProjectFilters = {},
  index: number,
  pagination: Pick<PaginationOptions, 'sortBy'> = {},
): Promise<Project | null> {
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  const { projects } = await getProjects(filters, {
    page: index,
    pageSize: 1,
    sortBy: pagination.sortBy,
  });

  return projects[0] ?? null;
}

/**
 * 智能推荐项目（首页 popular 使用）
 * 多因子加权：时间衰减热度 + Lv.20+曝光加权 + STEAM偏好亲和 + 年龄适配 + 60/40防霸榜混合
 */
export async function getRecommendedProjects(
  userSteam: Record<string, number> | null,
  ageGroup: string | null,
  pagination: { limit?: number; offset?: number } = {},
  options: { fallbackToPopular?: boolean } = {},
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const supabase = await createClient();
  const { limit = 6, offset = 0 } = pagination;
  const { fallbackToPopular = true } = options;

  const { data, error } = await callRpc(supabase, "get_recommended_projects", {
    p_user_steam: userSteam,
    p_age_group: ageGroup,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    logger.error("Error fetching recommended projects", { error, fallbackToPopular });

    if (!fallbackToPopular) {
      return { projects: [], total: 0, hasMore: false };
    }

    const pageSize = pagination.limit ?? 6;
    const fallbackPage = Math.floor(offset / pageSize);
    return getProjects({}, { page: fallbackPage, pageSize, sortBy: "popular" });
  }

  const rows = data || [];
  const rankedProjectIds = rows.map((row) => row.id);

  if (rankedProjectIds.length === 0) {
    return { projects: [], total: 0, hasMore: false };
  }

  const [{ data: projectData, error: projectError }, { data: countRows, error: countError }] = await Promise.all([
    supabase
      .from("projects")
      .select(`
        ${PROJECT_LIST_BASE_SELECT},
        ${PROJECT_LIST_PROFILE_SELECT},
        ${PROJECT_LIST_SUB_CATEGORIES_SELECT}
      `)
      .in("id", rankedProjectIds),
    supabase.rpc("get_projects_comments_count_batch", {
      p_project_ids: rankedProjectIds,
    }),
  ]);

  if (projectError) {
    logger.error("Error hydrating recommended projects", { error: projectError });
  }

  if (countError) {
    logger.error("Error fetching recommended projects comments count batch", { error: countError });
  }

  const hydratedRows = ((projectData as unknown as ProjectRowForMapper[] | null) || []).map((row) => ({ ...row }));
  const rowByProjectId = new Map(hydratedRows.map((row) => [Number(row.id), row]));
  const countByProjectId = new Map(
    ((countRows as { project_id: number; comment_count: number }[] | null) || []).map((row) => [
      row.project_id,
      row.comment_count,
    ]),
  );

  for (const row of hydratedRows) {
    (row as Record<string, unknown>).comments_count = countByProjectId.get(Number(row.id)) ?? 0;
  }

  const fallbackByProjectId = new Map(rows.map((row) => [row.id, row]));
  const projects: Project[] = rankedProjectIds.map((projectId) => {
    const hydratedRow = rowByProjectId.get(projectId);
    if (hydratedRow) {
      return mapDbProject(hydratedRow);
    }

    const fallbackRow = fallbackByProjectId.get(projectId);
    return {
      id: projectId,
      title: fallbackRow?.title || "",
      author: fallbackRow?.author_display_name || "Unknown",
      author_id: fallbackRow?.author_id || "",
      image: fallbackRow?.image_url || "",
      category: fallbackRow?.category || "",
      likes: fallbackRow?.likes_count || 0,
      comments_count: 0,
      description: fallbackRow?.description || "",
      materials: [],
      steps: [],
      difficulty: (fallbackRow?.difficulty as "easy" | "medium" | "hard") || undefined,
      difficulty_stars: fallbackRow?.difficulty_stars || 3,
      tags: [],
      status: (fallbackRow?.status as "draft" | "pending" | "approved" | "rejected") || "approved",
    };
  });

  return { projects, total: rows.length, hasMore: rows.length >= limit };
}

/**
 * 获取单个项目详情
 *
 * @param id - 项目 ID
 * @returns 项目详情或 null
 */
export const getProjectById = cache(async (id: string | number): Promise<Project | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
    .eq("id", Number(id))
    .single();

  if (error || !data) {
    logger.error("Error fetching project", { error });
    return null;
  }

  return mapDbProject(data as unknown as ProjectRowForMapper);
});

export async function getProjectTotalCoinsReceived(
  projectId: string | number,
  fallback: number = 0,
): Promise<number> {
  const numericProjectId = Number(projectId)
  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    return fallback
  }

  if (isPlaywrightSmoke()) {
    return SMOKE_PROJECTS.find((project) => Number(project.id) === numericProjectId)?.coins_count ?? fallback
  }

  const supabase = supabaseAdmin || await createClient()
  const { data, error } = await callRpc(supabase, 'get_project_total_coins_received', {
    p_project_id: numericProjectId,
  })

  if (error || data == null) {
    logger.error('Error fetching project total coins', { error, projectId: numericProjectId })
    return fallback
  }

  const totalCoins = Number(data)
  return Number.isFinite(totalCoins) ? totalCoins : fallback
}

export async function getProjectCollectionsCount(
  projectId: string | number,
  fallback: number = 0,
): Promise<number> {
  const numericProjectId = Number(projectId)
  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    return fallback
  }

  if (isPlaywrightSmoke()) {
    return fallback
  }

  const supabase = supabaseAdmin || await createClient()
  const { count, error } = await supabase
    .from('collections')
    .select('project_id', { count: 'exact', head: true })
    .eq('project_id', numericProjectId)

  if (error) {
    logger.error('Error fetching project collections count', { error, projectId: numericProjectId })
    return fallback
  }

  return count ?? fallback
}

/**
 * 分页获取项目评论
 *
 * @param projectId - 项目 ID
 * @param page - 页码 (0-indexed)
 * @param pageSize - 每页数量
 * @returns 评论列表和总数
 */
export async function getProjectComments(
  projectId: string | number,
  page: number = 0,
  pageSize: number = 10,
  options?: { userId?: string | null },
): Promise<{
  comments: Comment[];
  total: number;
  hasMore: boolean;
  likedCommentIds: number[];
}> {
  const supabase = await createClient();
  let resolvedUserId = options?.userId ?? null;
  if (!resolvedUserId) {
    const { data } = await supabase.auth.getUser();
    resolvedUserId = data.user?.id ?? null;
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  // Phase 1: fetch root comments (capped) for heat sorting
  const MAX_ROOTS = 500;
  const {
    data: roots,
    error,
    count,
  } = await supabase
    .from("comments")
    .select(
      `
            *,
            profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
        `,
      { count: "exact" },
    )
    .eq("project_id", Number(projectId))
    .is("parent_id", null)
    .order("created_at", { ascending: false })
    .limit(MAX_ROOTS);

  if (error) {
    logger.error("Error fetching project comments", { error });
    return { comments: [], total: 0, hasMore: false, likedCommentIds: [] };
  }

  const rootComments = (roots || []).map(mapDbComment);

  // Lightweight child count for heat sorting (only direct children)
  const rootIds = rootComments.map((c) => Number(c.id)).filter(Number.isFinite);
  const childCountByRoot = new Map<number, number>();
  if (rootIds.length > 0) {
    const { data: countRows } = await supabase
      .from("comments")
      .select("parent_id")
      .eq("project_id", Number(projectId))
      .in("parent_id", rootIds);
    for (const row of countRows || []) {
      const pid = Number(row.parent_id);
      childCountByRoot.set(pid, (childCountByRoot.get(pid) || 0) + 1);
    }
  }

  const getLikeCount = (comment: Comment): number => {
    const raw = comment as Comment & {
      likes_count?: number;
      likes?: number;
      like_count?: number;
      likeCount?: number;
    };
    const value =
      raw.likes_count ?? raw.likes ?? raw.like_count ?? raw.likeCount ?? 0;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : 0;
  };

  const sortedRoots = [...rootComments].sort((a, b) => {
    const heatA = getLikeCount(a) + (childCountByRoot.get(Number(a.id)) || 0);
    const heatB = getLikeCount(b) + (childCountByRoot.get(Number(b.id)) || 0);
    if (heatB !== heatA) return heatB - heatA;
    const t1 = a.created_at ?? "";
    const t2 = b.created_at ?? "";
    if (t2 !== t1) return t2.localeCompare(t1);
    return Number(b.id) - Number(a.id);
  });

  const pagedRoots = sortedRoots.slice(from, to + 1);

  // Phase 2: only fetch replies for the paginated root comments
  const pagedRootIds = pagedRoots.map((c) => Number(c.id)).filter(Number.isFinite);
  let replyComments: Comment[] = [];
  if (pagedRootIds.length > 0) {
    const { data: replies } = await supabase
      .from("comments")
      .select(`
              *,
              profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
          `)
      .eq("project_id", Number(projectId))
      .in("parent_id", pagedRootIds)
      .order("created_at", { ascending: true })
      .limit(200);

    replyComments = (replies || []).map(mapDbComment);
  }

  const responseComments = [...pagedRoots, ...replyComments];

  let likedCommentIds: number[] = [];
  if (resolvedUserId && responseComments.length > 0) {
    const commentIds = responseComments
      .map((c) => Number(c.id))
      .filter((id) => Number.isFinite(id));
    if (commentIds.length > 0) {
      const { data: likes, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", resolvedUserId)
        .in("comment_id", commentIds);
      if (likesError) {
        logger.error("Error fetching comment likes", { error: likesError });
      } else if (likes) {
        likedCommentIds = likes
          .map((row) => row.comment_id)
          .filter((id): id is number => Number.isFinite(Number(id)));
      }
    }
  }

  return {
    comments: responseComments,
    total: count || 0,
    hasMore: (count || 0) > to + 1,
    likedCommentIds,
  };
}

/**
 * 获取相关项目推荐
 *
 * @param projectId - 当前项目 ID
 * @param category - 项目分类
 * @param limit - 返回数量
 * @returns 相关项目列表
 */
export async function getRelatedProjects(
  projectId: string | number,
  category: string,
  limit: number = 3,
): Promise<Project[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
    .eq("category", category)
    .eq("status", "approved")
    .neq("id", Number(projectId))
    .limit(limit);

  if (error || !data) {
    logger.error("Error fetching related projects", { error });
    return [];
  }

  const rows = data as unknown as ProjectRowForMapper[];
  const projectIds = rows.map((project) => project.id);
  if (projectIds.length > 0) {
    const { data: countRows, error: countError } = await supabase.rpc("get_projects_comments_count_batch", {
      p_project_ids: projectIds.map((id) => Number(id)),
    });
    if (countError) {
      logger.error("Error fetching comments count batch (related)", { error: countError });
    }
    const countByProjectId = new Map(
      ((countRows as { project_id: number; comment_count: number }[]) || []).map((row) => [
        row.project_id,
        row.comment_count,
      ]),
    );
    for (const row of rows) {
      (row as Record<string, unknown>).comments_count = countByProjectId.get(Number(row.id)) ?? 0;
    }
  }

  return rows.map(mapDbProject);
}

export type ProjectCompletionSort = "latest" | "featured"

export type GetProjectCompletionsOptions = {
  sortBy?: ProjectCompletionSort
  /** 每位探索者只保留最新一条（用于详情页预览，避免同人多步骤占满横向区） */
  onePerUser?: boolean
}

/** 已按时间倒序时，保留每位 user_id 的首条（即最新记录） */
export function dedupeCompletionRowsByUser<T extends { user_id: string }>(
  rows: T[],
  limit: number,
): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const row of rows) {
    if (seen.has(row.user_id)) continue
    seen.add(row.user_id)
    result.push(row)
    if (result.length >= limit) break
  }

  return result
}

/**
 * 获取项目的探索记录（社区流 / 详情预览）
 */
export async function getProjectCompletions(
  projectId: string | number,
  limit: number = 4,
  options?: GetProjectCompletionsOptions,
): Promise<ProjectCompletion[]> {
  const supabase = await createClient();
  const sortBy = options?.sortBy ?? "latest";
  const onePerUser = options?.onePerUser ?? false;
  const queryLimit = onePerUser ? Math.min(100, Math.max(limit * 12, limit)) : limit;

  let query = supabase
    .from("completed_projects")
    .select("*")
    .eq("project_id", Number(projectId))
    .eq("is_public", true)
    .eq("status", "approved");

  if (sortBy === "featured") {
    query = query.order("likes_count", { ascending: false }).order("completed_at", { ascending: false });
  } else {
    query = query.order("completed_at", { ascending: false });
  }

  const { data: completions, error } = await query.limit(queryLimit);

  if (error || !completions) {
    logger.error("Error fetching completions", { error });
    return [];
  }

  type CompletionRow = { id: number; user_id: string; [key: string]: unknown };
  const rawRows = completions as CompletionRow[];
  const rows = onePerUser ? dedupeCompletionRowsByUser(rawRows, limit) : rawRows;
  const userIds = [...new Set(rows.map((completion) => completion.user_id))];
  const completionIds = rows.map((row) => row.id);

  const [{ data: profiles }, commentCountMap] = await Promise.all([
    userIds.length
      ? supabase
          .from("profiles")
          .select("id, display_name, avatar_url, equipped_avatar_frame_id, xp")
          .in("id", userIds)
      : Promise.resolve({ data: [] as unknown[] }),
    fetchCompletionCommentCounts(supabase, completionIds),
  ]);

  type ProfileRow = {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    equipped_avatar_frame_id: string | null;
    xp: number | null;
  };
  const profilesMap = new Map(((profiles as ProfileRow[]) || []).map((profile) => [profile.id, profile]));

  return rows.map((item) => {
    const profile = profilesMap.get(item.user_id);
    const mapped = mapDbCompletion({
      ...(item as CompletionRowForMapper),
      profiles: profile || null,
    });
    return {
      ...mapped,
      commentsCount: commentCountMap.get(item.id) ?? 0,
    };
  });
}

async function fetchCompletionCommentCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  completionIds: number[],
) {
  const map = new Map<number, number>();
  if (completionIds.length === 0) return map;

  const { data, error } = await supabase.rpc(
    "get_completion_comments_count_batch" as never,
    {
      p_completion_ids: completionIds,
    } as never,
  );

  if (error) {
    logger.error("Error fetching completion comment counts", { error });
    return map;
  }

  for (const row of ((data as unknown) as { completed_project_id: number; comment_count: number }[]) || []) {
    map.set(row.completed_project_id, Number(row.comment_count) || 0);
  }

  return map;
}

/** 获取项目下已公开展示的探索记录总数（过程帖 + 终稿） */
export async function getProjectExplorationRecordsCount(
  projectId: string | number,
  fallback: number = 0,
): Promise<number> {
  const numericProjectId = Number(projectId);
  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    return fallback;
  }

  if (isPlaywrightSmoke()) {
    return 0;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("completed_projects")
    .select("id", { count: "exact", head: true })
    .eq("project_id", numericProjectId)
    .eq("is_public", true)
    .eq("status", "approved");

  if (error) {
    logger.error("Error fetching exploration records count", { error, projectId: numericProjectId });
    return fallback;
  }

  return count ?? fallback;
}

export type CompletionLikeMeta = {
  count: number;
  isLiked: boolean;
};

/** 批量获取探索记录点赞数与当前用户是否已赞 */
export async function fetchCompletionLikesMeta(
  completionIds: number[],
  viewerUserId?: string | null,
): Promise<Map<number, CompletionLikeMeta>> {
  const map = new Map<number, CompletionLikeMeta>();
  if (completionIds.length === 0) return map;

  if (isPlaywrightSmoke()) {
    for (const id of completionIds) {
      map.set(id, { count: 0, isLiked: false });
    }
    return map;
  }

  const supabase = await createClient();

  for (const id of completionIds) {
    map.set(id, { count: 0, isLiked: false });
  }

  const [{ data: completionRows, error: completionError }, viewerLikesResult] = await Promise.all([
    supabase.from("completed_projects").select("id, likes_count").in("id", completionIds),
    viewerUserId
      ? supabase
          .from("completion_likes")
          .select("completed_project_id")
          .eq("user_id", viewerUserId)
          .in("completed_project_id", completionIds)
      : Promise.resolve({ data: [] as { completed_project_id: number }[], error: null }),
  ]);

  if (completionError) {
    logger.error("Error fetching completion likes meta", { error: completionError });
    return map;
  }

  for (const row of (completionRows as { id: number; likes_count?: number | null }[]) || []) {
    map.set(row.id, {
      count: Number(row.likes_count) || 0,
      isLiked: false,
    });
  }

  if (viewerLikesResult.error) {
    logger.error("Error fetching viewer completion likes", { error: viewerLikesResult.error });
    return map;
  }

  for (const row of (viewerLikesResult.data as { completed_project_id: number }[]) || []) {
    const current = map.get(row.completed_project_id) ?? { count: 0, isLiked: false };
    current.isLiked = true;
    map.set(row.completed_project_id, current);
  }

  return map;
}

/** 按 id 拉取单条公开展示的探索记录（用于深链高亮） */
export async function getProjectCompletionById(
  projectId: string | number,
  completionId: number,
): Promise<ProjectCompletion | null> {
  const numericProjectId = Number(projectId);
  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) return null;
  if (!Number.isInteger(completionId) || completionId <= 0) return null;

  if (isPlaywrightSmoke()) {
    return null;
  }

  const supabase = await createClient();
  const { data: completion, error } = await supabase
    .from("completed_projects")
    .select("*")
    .eq("id", completionId)
    .eq("project_id", numericProjectId)
    .eq("is_public", true)
    .eq("status", "approved")
    .maybeSingle();

  if (error || !completion) {
    if (error) logger.error("Error fetching completion by id", { error, completionId });
    return null;
  }

  type CompletionRow = { id: number; user_id: string; [key: string]: unknown };
  const row = completion as CompletionRow;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, equipped_avatar_frame_id, xp")
    .eq("id", row.user_id)
    .maybeSingle();

  const commentCountMap = await fetchCompletionCommentCounts(supabase, [row.id]);
  const mapped = mapDbCompletion({
    ...(row as CompletionRowForMapper),
    profiles: profile || null,
  });

  return {
    ...mapped,
    commentsCount: commentCountMap.get(row.id) ?? 0,
  };
}

/** 确保高亮记录在列表中（置顶且去重） */
export function mergeHighlightCompletion(
  completions: ProjectCompletion[],
  highlight: ProjectCompletion | null,
  limit: number,
): ProjectCompletion[] {
  if (!highlight) return completions;
  const without = completions.filter((item) => item.id !== highlight.id);
  return [highlight, ...without].slice(0, limit);
}

/** 获取项目的终稿完成人数（用于「X 人完成」统计） */
export async function getProjectCompletionsCount(
  projectId: string | number,
  fallback: number = 0,
): Promise<number> {
  const numericProjectId = Number(projectId);
  if (!Number.isInteger(numericProjectId) || numericProjectId <= 0) {
    return fallback;
  }

  if (isPlaywrightSmoke()) {
    return 0;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("completed_projects")
    .select("id", { count: "exact", head: true })
    .eq("project_id", numericProjectId)
    .eq("is_public", true)
    .eq("status", "approved")
    .eq("record_kind", "final");

  if (error) {
    logger.error("Error fetching project completions count", { error, projectId: numericProjectId });
    return fallback;
  }

  return count ?? fallback;
}
