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
import {
  buildRecommendationShuffleSeed,
  sortByRecommendationShuffleSeed,
} from "@/lib/recommendations/seed";
import {
  applyPublicClassificationVisibility,
  getContentClassificationSettings,
  normalizeDifficultyParam,
  sortByAgeMatch,
  withoutPublicClassification,
  type PublicClassificationSettings,
} from "@/lib/content-classification";

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
    completions_count: 12,
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
    completions_count: 18,
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
    completions_count: 7,
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
  | { key: string; data: ExploreFilterOptions; expiresAt: number }
  | null = null;
let exploreFilterOptionsPromise:
  | { key: string; promise: Promise<ExploreFilterOptions> }
  | null = null;

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
  difficulty?: "easy" | "medium" | "hard" | "beginner" | "intermediate" | "challenge" | "all" | "1" | "2" | "3" | "4" | "5" | "6" | "1-2" | "3-4" | "5-6";
  /** 精确年龄只影响 reviewed 内容的排序，不排除超出建议年龄的项目。 */
  age?: number;
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
  "description",
  "difficulty",
  "difficulty_stars",
  "tags",
  "status",
  "moderation_state",
  "rejection_reason",
  "challenge_id",
].join(",");
// 列表页只显示卡片，不渲染 steps/materials；它们由详情页 (getProjectById) 单独拉取。
// 仅在 materials 过滤时保留 !inner 用于筛选关联。
const PROJECT_LIST_MATERIALS_FILTER_SELECT = "project_materials!inner (material)";
const PROJECT_LIST_SUB_CATEGORIES_SELECT = "sub_categories (name)";
const PROJECT_LIST_SUB_CATEGORIES_FILTER_SELECT = "sub_categories!inner (name)";
const PROJECT_LIST_PROFILE_SELECT = "profiles:author_id (display_name)";

// difficulty 不在这里拦截：它会被下推到每类的 popular RPC，类别 round-robin 在过滤后做，
// 这样「新手推荐」preset（difficulty=1-2 + sortBy=popular）也能拿到 5 类交错而不是单一类聚集。
// category/subCategory/tags/search/materials 仍然 return false——这些是单类/单话题语义，
// 强行类别均衡会和用户意图冲突。
export function shouldBlendPopularExplore(filters: ProjectFilters, pagination: PaginationOptions): boolean {
  const { page = 0, sortBy = "popular", blendPopular = false } = pagination;
  if (sortBy !== "popular") return false;
  if (!blendPopular && page !== 0) return false;
  const { category, subCategory, materials, tags, searchQuery } = filters;
  if (category && category !== "全部") return false;
  if (subCategory) return false;
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

function applyPopularListShuffle<T extends { id: string | number }>(
  rows: T[],
  pagination: Pick<PaginationOptions, "shuffleSeed" | "shuffleBatch">,
): T[] {
  const { shuffleSeed, shuffleBatch = 0 } = pagination;
  if (!shuffleSeed || rows.length <= 1) {
    return rows;
  }

  const batch = shuffleBatch;
  const seed = buildRecommendationShuffleSeed(shuffleSeed, batch);
  return sortByRecommendationShuffleSeed(rows, seed, (row) => row.id);
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
    (project.completions_count ?? 0) * 2 +
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

function buildExploreSelectStatement(
  filters: Pick<ProjectFilters, "materials" | "subCategory">,
  includeClassification = false,
): string {
  const subCategoriesJoin = filters.subCategory
    ? PROJECT_LIST_SUB_CATEGORIES_FILTER_SELECT
    : PROJECT_LIST_SUB_CATEGORIES_SELECT;
  const materialsFilterJoin = filters.materials && filters.materials.length > 0
    ? `,\n      ${PROJECT_LIST_MATERIALS_FILTER_SELECT}`
    : "";
  return `
      ${PROJECT_LIST_BASE_SELECT}${includeClassification ? `,
      recommended_min_age,
      recommended_max_age,
      support_level,
      classification_status,
      classification_source,
      classification_reviewed_at,
      classification_reviewed_by,
      classification_revision` : ""},
      ${PROJECT_LIST_PROFILE_SELECT},
      ${subCategoriesJoin}${materialsFilterJoin}
    `;
}

async function enrichProjectsWithCompletionCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projects: Project[],
): Promise<Project[]> {
  const projectIds = [...new Set(
    projects
      .map((project) => Number(project.id))
      .filter((projectId) => Number.isInteger(projectId) && projectId > 0),
  )];
  if (projectIds.length === 0) return projects;

  const { data, error } = await supabase.rpc("get_project_completion_counts_batch", {
    p_project_ids: projectIds,
  });
  if (error) {
    logger.error("Error fetching project completion counts batch", { error, projectIds });
    return projects;
  }

  const countByProjectId = new Map(
    (data || []).map((row) => [Number(row.project_id), Number(row.completion_count) || 0]),
  );

  return projects.map((project) => ({
    ...project,
    completions_count: countByProjectId.get(Number(project.id)) ?? 0,
  }));
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
  settings: PublicClassificationSettings,
): Promise<Project[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const includeClassification = settings.publicV1Enabled || settings.enforcementEnabled;
  let projectQuery = supabase
    .from("projects")
    .select(buildExploreSelectStatement(filters, includeClassification))
    .eq("status", "approved")
    .eq("moderation_state", "approved")
    .in("id", projectIds);

  if (settings.enforcementEnabled) {
    projectQuery = projectQuery.eq("classification_status", "reviewed");
  }

  const { data: rows, error: hydrateError } = await projectQuery;

  if (hydrateError) {
    logger.error("Error hydrating explore projects", { error: hydrateError });
    return [];
  }

  const idOrder = new Map(projectIds.map((id, index) => [id, index]));
  let projects = await enrichProjectsWithCompletionCounts(
    supabase,
    ((rows || []) as unknown as ProjectRowForMapper[]).map((row) => mapDbProject(row)),
  );
  projects = projects.sort(
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
  settings: PublicClassificationSettings,
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const { page = 0, pageSize = 12, shuffleSeed, shuffleBatch = 0 } = pagination;
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
      settings,
    );
    // shuffle 必须在 diversify 之前：先按 seed 打乱决定「每类挑哪些项目」，
    // 再做类别 round-robin 才能保证前几位类别交错。反过来会被全局 hash 打散，
    // 导致前 8 位偶发集中在同一类别。
    const shuffled = applyPopularListShuffle(hydrated, { shuffleSeed, shuffleBatch });
    const diversified = diversifyPopularByCategory(shuffled, shuffled.length);
    const projects = diversified.slice(from, from + pageSize);
    const poolSize = diversified.length;

    return {
      projects,
      total,
      // blend 池是一次性抓的（page=0 才走这里），翻页越界后即使 total 更大也没有数据，
      // 不能用 `from + pageSize < total` 兜底，否则会触发空页死循环。
      hasMore: from + pageSize < poolSize,
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
  let projects = await hydrateExploreProjectsByIds(
    supabase,
    projectIds,
    filters,
    starsRange,
    settings,
  );

  // 在 RPC 分页返回的当页结果里做稳定打乱：保留完整可翻页性，避免把热门排序压缩到固定池里
  // （此前的方案会让用户最多只能看到 ~48 条热门项目）。
  if (shuffleSeed) {
    projects = applyPopularListShuffle(projects, { shuffleSeed, shuffleBatch });
  }

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
  /** 观众标识（用户 id 或 anon:uuid），用于按日/批次打乱热门顺序 */
  shuffleSeed?: string;
  /** 显式换一批时递增；分页加载应固定为 0，靠 page 切片 */
  shuffleBatch?: number;
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
  const band = normalizeDifficultyParam(difficulty);
  if (band === "beginner") return { min: 1, max: 2, legacy: null };
  if (band === "intermediate") return { min: 3, max: 4, legacy: null };
  if (band === "challenge") return { min: 5, max: 6, legacy: null };
  return { min: null, max: null, legacy: null };
}

function getSmokeWeeklyInteractionScore(project: SmokeProject): number {
  return getSmokeInteractionRawScore(project);
}

async function fetchWeeklyHotProjects(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: ProjectFilters,
  pagination: PaginationOptions,
  settings: PublicClassificationSettings,
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
    settings,
  );

  const hasMore = from + projects.length < total;

  return { projects, total, hasMore };
}

function getSmokeProjects(
  filters: ProjectFilters = {},
  pagination: PaginationOptions = {},
): { projects: Project[]; total: number; hasMore: boolean } {
  const { page = 0, pageSize = 12, sortBy = "popular", shuffleSeed, shuffleBatch = 0 } = pagination;

  const filteredProjects = SMOKE_PROJECTS.filter((project) => {
    if (filters.category && filters.category !== "全部" && project.category !== filters.category) {
      return false;
    }

    if (filters.subCategory && project.sub_category !== filters.subCategory) {
      return false;
    }

    if (filters.difficulty && filters.difficulty !== "all") {
      const stars = project.difficulty_stars || 0;
      const starsRange = resolveDifficultyStarsRange(filters.difficulty);
      if (starsRange.min !== null && (stars < starsRange.min || stars > (starsRange.max ?? starsRange.min))) return false;
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
    const shuffled = applyPopularListShuffle(pool, { shuffleSeed, shuffleBatch });
    const diversified = diversifyPopularByCategory(shuffled, shuffled.length);
    pageSlice = diversified.slice(from, to);
    hasMore = to < diversified.length;
  } else if (shuffleSeed) {
    pageSlice = applyPopularListShuffle(
      sortedProjects.slice(from, to),
      { shuffleSeed, shuffleBatch },
    );
  } else {
    pageSlice = sortedProjects.slice(from, to);
  }

  const projects = pageSlice.map(({ createdAt: _createdAt, difficulty_stars: _difficultyStars, ...project }) => project);

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

  const classificationSettings = await getContentClassificationSettings();
  const cacheKey = `classification:${classificationSettings.publicV1Enabled ? "v1" : "legacy"}:${classificationSettings.enforcementEnabled ? "reviewed" : "all"}`;
  const now = Date.now();
  if (
    cachedExploreFilterOptions
    && cachedExploreFilterOptions.key === cacheKey
    && cachedExploreFilterOptions.expiresAt > now
  ) {
    return cachedExploreFilterOptions.data;
  }

  if (exploreFilterOptionsPromise?.key === cacheKey) {
    return exploreFilterOptionsPromise.promise;
  }

  const promise = (async () => {
    const supabase = await createClient();
    let projectTagsQuery = supabase
      .from("projects")
      .select("category, tags, sub_categories (name)")
      .eq("status", "approved")
      .eq("moderation_state", "approved")
      .not("tags", "is", null);
    if (classificationSettings.enforcementEnabled) {
      projectTagsQuery = projectTagsQuery.eq("classification_status", "reviewed");
    }

    const [{ data: categoriesData }, { data: subCategoriesData }, { data: tagsData }] = await Promise.all([
      supabase.from("categories").select("name").order("sort_order"),
      supabase.from("sub_categories").select("name"),
      projectTagsQuery,
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
      key: cacheKey,
      data,
      expiresAt: Date.now() + EXPLORE_FILTER_OPTIONS_TTL_MS,
    };
    return data;
  })();
  exploreFilterOptionsPromise = { key: cacheKey, promise };

  try {
    return await promise;
  } finally {
    if (exploreFilterOptionsPromise?.promise === promise) {
      exploreFilterOptionsPromise = null;
    }
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
  const classificationSettings = await getContentClassificationSettings();
  const includeClassification = classificationSettings.publicV1Enabled || classificationSettings.enforcementEnabled;

  const {
    category,
    subCategory,
    difficulty,
    materials,
    tags,
    searchQuery,
    age,
  } = filters;
  const sanitizedSearch = searchQuery ? sanitizeSearch(searchQuery) : "";

  const { page = 0, pageSize = 12, sortBy = "popular" } = pagination;

  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (sortBy === "weekly") {
    const result = await fetchWeeklyHotProjects(supabase, filters, pagination, classificationSettings);
    const visibleProjects = applyPublicClassificationVisibility(result.projects, classificationSettings);
    return {
      ...result,
      projects: classificationSettings.publicV1Enabled
        ? sortByAgeMatch(visibleProjects, Number.isInteger(age) ? age! : null)
        : visibleProjects,
    };
  }

  if (sortBy === "popular") {
    const result = await fetchPopularProjects(supabase, filters, pagination, classificationSettings);
    const visibleProjects = applyPublicClassificationVisibility(result.projects, classificationSettings);
    return {
      ...result,
      projects: classificationSettings.publicV1Enabled
        ? sortByAgeMatch(visibleProjects, Number.isInteger(age) ? age! : null)
        : visibleProjects,
    };
  }

  const selectStatement = buildExploreSelectStatement({ materials, subCategory }, includeClassification);

  let query = supabase
    .from("projects")
    .select(selectStatement, { count: "exact" })
    .eq("status", "approved")
    .eq("moderation_state", "approved")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (classificationSettings.enforcementEnabled) {
    query = query.eq("classification_status", "reviewed");
  }

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
    const starsRange = resolveDifficultyStarsRange(difficulty);
    if (starsRange.min !== null) {
      query = query.gte("difficulty_stars", starsRange.min).lte("difficulty_stars", starsRange.max ?? starsRange.min);
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
  const projects = await enrichProjectsWithCompletionCounts(supabase, rows.map((row) => mapDbProject(row)));
  const total = count || 0;
  const hasMore = total > to + 1;
  const visibleProjects = applyPublicClassificationVisibility(projects, classificationSettings);

  return {
    projects: classificationSettings.publicV1Enabled
      ? sortByAgeMatch(visibleProjects, Number.isInteger(age) ? age! : null)
      : visibleProjects,
    total,
    hasMore,
  };
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
  age: number | null,
  pagination: { limit?: number; offset?: number } = {},
  options: {
    fallbackToPopular?: boolean;
    shuffleSeed?: string;
    shuffleBatch?: number;
    userId?: string | null;
  } = {},
): Promise<{ projects: Project[]; total: number; hasMore: boolean }> {
  const supabase = await createClient();
  const classificationSettings = await getContentClassificationSettings();
  const includeClassification = classificationSettings.publicV1Enabled || classificationSettings.enforcementEnabled;
  const { limit = 6, offset = 0 } = pagination;
  const {
    fallbackToPopular = true,
    shuffleSeed,
    shuffleBatch = 0,
    userId = null,
  } = options;

  const { data, error } = await callRpc(supabase, "get_recommended_projects_v2", {
    p_user_id: userId,
    p_age: Number.isInteger(age) && age! >= 3 && age! <= 16 ? age : null,
    p_steam: userSteam,
    p_limit: limit,
    p_offset: offset,
  });

  const payload = data && typeof data === "object" && !Array.isArray(data)
    ? data as {
        projects?: unknown;
        total?: unknown;
        hasMore?: unknown;
      }
    : null;
  const rows = payload && Array.isArray(payload.projects)
    ? payload.projects.filter((row): row is { id: number } => (
        typeof row === "object" &&
        row !== null &&
        Number.isInteger((row as { id?: unknown }).id)
      ))
    : [];

  if (error || !payload) {
    logger.error("Error fetching recommended projects", { error, fallbackToPopular });

    if (!fallbackToPopular) {
      return { projects: [], total: 0, hasMore: false };
    }

    const pageSize = pagination.limit ?? 6;
    const fallbackPage = Math.floor(offset / pageSize);
    return getProjects({}, {
      page: fallbackPage,
      pageSize,
      sortBy: "popular",
      shuffleSeed,
      shuffleBatch,
    });
  }

  const rankedProjectIds = rows.map((row) => row.id);

  if (rankedProjectIds.length === 0) {
    return {
      projects: [],
      total: typeof payload.total === "number" ? payload.total : 0,
      hasMore: payload.hasMore === true,
    };
  }

  /*
   * The v2 RPC deliberately returns only ranked ids and scores. Hydration
   * still uses the normal public query, so moderation and classification
   * visibility cannot be bypassed by a stale ranking result.
   */
  let recommendedProjectQuery = supabase
    .from("projects")
    .select(`
      ${PROJECT_LIST_BASE_SELECT}${includeClassification ? `,
      recommended_min_age,
      recommended_max_age,
      support_level,
      classification_status,
      classification_source,
      classification_reviewed_at,
      classification_reviewed_by,
      classification_revision` : ""},
      ${PROJECT_LIST_PROFILE_SELECT},
      ${PROJECT_LIST_SUB_CATEGORIES_SELECT}
    `)
    .eq("status", "approved")
    .eq("moderation_state", "approved")
    .in("id", rankedProjectIds);

  let hydratedQuery = recommendedProjectQuery;
  if (classificationSettings.enforcementEnabled) {
    hydratedQuery = hydratedQuery.eq("classification_status", "reviewed");
  }

  const { data: projectData, error: projectError } = await hydratedQuery;

  if (projectError) {
    logger.error("Error hydrating recommended projects", { error: projectError });
  }

  const hydratedRows = ((projectData as unknown as ProjectRowForMapper[] | null) || []).map((row) => ({ ...row }));
  const rowByProjectId = new Map(hydratedRows.map((row) => [Number(row.id), row]));

  let projects: Project[] = rankedProjectIds.flatMap((projectId) => {
    const hydratedRow = rowByProjectId.get(projectId);
    if (hydratedRow) {
      return [mapDbProject(hydratedRow)];
    }
    return [];
  });

  projects = await enrichProjectsWithCompletionCounts(supabase, projects);
  projects = applyPublicClassificationVisibility(projects, classificationSettings);

  if (shuffleSeed) {
    projects = applyPopularListShuffle(projects, { shuffleSeed, shuffleBatch });
  }

  return {
    projects,
    total: typeof payload.total === "number" ? payload.total : rows.length,
    hasMore: payload.hasMore === true,
  };
}

/**
 * 获取单个项目详情
 *
 * @param id - 项目 ID
 * @returns 项目详情或 null
 */
export const getProjectById = cache(async (id: string | number): Promise<Project | null> => {
  const numericId = typeof id === "number" ? id : Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  const supabase = await createClient();
  const classificationSettings = await getContentClassificationSettings();

  let projectQuery = supabase
    .from("projects")
    .select(`
      *,
      profiles:author_id (display_name),
      project_materials (*),
      project_steps (*),
      sub_categories (name)
    `)
    .eq("id", numericId)
    .eq("status", "approved")
    .eq("moderation_state", "approved");
  if (classificationSettings.enforcementEnabled) {
    projectQuery = projectQuery.eq("classification_status", "reviewed");
  }
  const { data, error } = await projectQuery.maybeSingle();

  if (error) {
    logger.error("Error fetching project", { error, projectId: numericId });
    return null;
  }

  if (!data) {
    return null;
  }

  const project = mapDbProject(data as unknown as ProjectRowForMapper);
  return classificationSettings.publicV1Enabled ? project : (withoutPublicClassification(project) as Project);
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
    .eq("moderation_state", "approved")
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
      .eq("moderation_state", "approved")
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
      .eq("moderation_state", "approved")
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
  const classificationSettings = await getContentClassificationSettings();

  let projectQuery = supabase
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
    .eq("moderation_state", "approved")
    .neq("id", Number(projectId))
  if (classificationSettings.enforcementEnabled) {
    projectQuery = projectQuery.eq("classification_status", "reviewed");
  }
  const { data, error } = await projectQuery.limit(limit);

  if (error || !data) {
    logger.error("Error fetching related projects", { error });
    return [];
  }

  const projects = await enrichProjectsWithCompletionCounts(
    supabase,
    (data as unknown as ProjectRowForMapper[]).map((row) => mapDbProject(row)),
  );
  return applyPublicClassificationVisibility(projects, classificationSettings);
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
    .eq("status", "approved")
    .eq("moderation_state", "approved");

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
    .eq("status", "approved")
    .eq("moderation_state", "approved");

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
    supabase
      .from("completed_projects")
      .select("id, likes_count")
      .eq("moderation_state", "approved")
      .in("id", completionIds),
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
    .eq("moderation_state", "approved")
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
    .eq("moderation_state", "approved")
    .eq("record_kind", "final");

  if (error) {
    logger.error("Error fetching project completions count", { error, projectId: numericProjectId });
    return fallback;
  }

  return count ?? fallback;
}
