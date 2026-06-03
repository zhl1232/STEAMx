import { getProjects, getRecommendedProjects } from "@/lib/api/explore-data";
import { getHomepageCategoryTileCounts, type HomeCategoryTileCounts } from "@/lib/home/category-tiles";
import { getHomepageCommunityFeed, type HomeCommunityFeedItem } from "@/lib/home/community-feed";
import { logger } from "@/lib/logger";
import { getRecommendationViewerKey } from "@/lib/recommendations/viewer";
import { type Project } from "@/lib/mappers/types";
import { callRpc } from "@/lib/supabase/rpc";
import { createClient } from "@/lib/supabase/server";

export type HomepageRecommendationMode = "personalized" | "popular-fallback";

export interface HomepageRecommendationResult {
  projects: Project[];
  nextOffset: number;
  hasMore: boolean;
  mode: HomepageRecommendationMode;
}

export interface HomepageShowcaseData extends HomepageRecommendationResult {
  recentHotProjects: Project[];
  communityFeed: HomeCommunityFeedItem[];
  categoryTileCounts: HomeCategoryTileCounts;
}

type HomepagePreferenceContext = {
  steam: Record<string, number> | null;
  ageGroup: string | null;
  hasPreferences: boolean;
};

type RecommendationBatch = {
  projects: Project[];
  nextOffset: number;
  hasMore: boolean;
};

type RecommendationBatchFetcher = (args: { limit: number; offset: number }) => Promise<RecommendationBatch>;

const HOMEPAGE_HOT_CATEGORIES = ["科学", "技术", "工程", "艺术", "数学"] as const;
const RECENT_HOT_LIMIT = HOMEPAGE_HOT_CATEGORIES.length + 1;
const SIDEBAR_RECOMMENDATION_LIMIT = 8;
const MAX_SCAN_ROUNDS = 6;

function birthDateToAgeGroup(birthDate: string | null): string | null {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();

  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age--;
  }

  if (age >= 16) return "16+";
  if (age >= 13) return "13-15";
  if (age >= 10) return "10-12";
  if (age >= 6) return "6-9";
  return null;
}

function normalizeOffset(offset: number | undefined): number {
  return Number.isFinite(offset) && offset && offset > 0 ? Math.floor(offset) : 0;
}

function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (!Number.isFinite(limit) || !limit) return fallback;
  return Math.max(1, Math.floor(limit));
}

function normalizeProjectId(id: Project["id"] | string | number): string {
  return String(id);
}

function resolveMode(
  requestedMode: HomepageRecommendationMode | undefined,
  hasPreferences: boolean,
): HomepageRecommendationMode {
  if (!hasPreferences) {
    return "popular-fallback";
  }

  return requestedMode === "popular-fallback" ? "popular-fallback" : "personalized";
}

function selectUniqueProjects(
  projects: Project[],
  seenProjectIds: Set<string>,
  limit: number,
): Project[] {
  const accepted: Project[] = [];

  for (const project of projects) {
    const projectId = normalizeProjectId(project.id);
    if (seenProjectIds.has(projectId)) continue;

    seenProjectIds.add(projectId);
    accepted.push(project);

    if (accepted.length >= limit) {
      break;
    }
  }

  return accepted;
}

export function selectCategoryBalancedProjects(args: {
  categoryProjects: Project[];
  fallbackProjects: Project[];
  limit?: number;
}): Project[] {
  const limit = normalizeLimit(args.limit, RECENT_HOT_LIMIT);
  const seenProjectIds = new Set<string>();
  const selected: Project[] = [];

  for (const project of args.categoryProjects) {
    if (selected.length >= limit) break;

    const projectId = normalizeProjectId(project.id);
    if (seenProjectIds.has(projectId)) continue;

    seenProjectIds.add(projectId);
    selected.push(project);
  }

  if (selected.length < limit) {
    selected.push(...selectUniqueProjects(args.fallbackProjects, seenProjectIds, limit - selected.length));
  }

  return selected;
}

async function getCategoryBalancedHotProjects(): Promise<Project[]> {
  const categoryResults = await Promise.all(
    HOMEPAGE_HOT_CATEGORIES.map((category) =>
      getProjects({ category }, { page: 0, pageSize: 1, sortBy: "popular" }),
    ),
  );

  const categoryProjects = categoryResults.flatMap((result) => result.projects.slice(0, 1));
  const fallbackProjects: Project[] = [];

  for (let page = 0; page < MAX_SCAN_ROUNDS && categoryProjects.length + fallbackProjects.length < RECENT_HOT_LIMIT; page += 1) {
    const result = await getProjects({}, { page, pageSize: RECENT_HOT_LIMIT, sortBy: "popular" });
    fallbackProjects.push(...result.projects);

    if (!result.hasMore) break;
  }

  return selectCategoryBalancedProjects({
    categoryProjects,
    fallbackProjects,
    limit: RECENT_HOT_LIMIT,
  });
}

async function getHomepageUserPreferences(): Promise<HomepagePreferenceContext> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { steam: null, ageGroup: null, hasPreferences: false };
    }

    const [profileRes, radarRes] = await Promise.all([
      supabase.from("profiles").select("birth_date").eq("id", user.id).single(),
      callRpc(supabase, "calculate_steam_radar", { target_user_id: user.id }),
    ]);

    const birthDate = (profileRes.data as { birth_date: string | null } | null)?.birth_date ?? null;
    const ageGroup = birthDateToAgeGroup(birthDate);

    const radarData = radarRes.data as Record<string, { display: number }> | null;
    let steam: Record<string, number> | null = null;

    if (radarData) {
      const scores: Record<string, number> = {};
      for (const dimension of ["S", "T", "E", "A", "M"]) {
        scores[dimension] = radarData[dimension]?.display ?? 0;
      }

      steam = Object.values(scores).some((score) => score > 0) ? scores : null;
    }

    const hasPreferences = steam !== null || ageGroup !== null;
    return { steam, ageGroup, hasPreferences };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE"
    ) {
      return { steam: null, ageGroup: null, hasPreferences: false };
    }

    logger.error("Failed to get user preferences for homepage recommendations", { error });
    return { steam: null, ageGroup: null, hasPreferences: false };
  }
}

async function fetchPersonalizedBatch(
  context: HomepagePreferenceContext,
  args: { limit: number; offset: number },
  shuffleSeed: string,
): Promise<RecommendationBatch> {
  const result = await getRecommendedProjects(
    context.steam,
    context.ageGroup,
    { limit: args.limit, offset: args.offset },
    { fallbackToPopular: false, shuffleSeed, shuffleBatch: 0 },
  );

  return {
    projects: result.projects,
    nextOffset: args.offset + result.projects.length,
    hasMore: result.hasMore,
  };
}

async function fetchPopularBatch(
  args: { limit: number; offset: number },
  blendPopular: boolean,
  shuffleSeed: string,
): Promise<RecommendationBatch> {
  const pageSize = normalizeLimit(args.limit, SIDEBAR_RECOMMENDATION_LIMIT);
  const offset = normalizeOffset(args.offset);
  const page = Math.floor(offset / pageSize);
  const result = await getProjects({}, {
    page,
    pageSize,
    sortBy: "popular",
    blendPopular,
    shuffleSeed,
    shuffleBatch: 0,
  });

  // 热门走的是页级分页，按整页推进 cursor；用 result.projects.length 会在 hydrate
  // 丢条目时让下一轮回到同一页（dedup 仍正确，但白白多一次 RPC）。
  return {
    projects: result.projects,
    nextOffset: (page + 1) * pageSize,
    hasMore: result.hasMore,
  };
}

export async function collectHomepageRecommendations(args: {
  limit?: number;
  offset?: number;
  excludeIds?: Array<string | number>;
  mode: HomepageRecommendationMode;
  fetchPersonalized: RecommendationBatchFetcher;
  fetchPopular: RecommendationBatchFetcher;
}): Promise<HomepageRecommendationResult> {
  const limit = normalizeLimit(args.limit, SIDEBAR_RECOMMENDATION_LIMIT);
  const seenProjectIds = new Set((args.excludeIds || []).map((projectId) => normalizeProjectId(projectId)));
  const collected: Project[] = [];

  if (args.mode === "personalized") {
    let offset = normalizeOffset(args.offset);
    let hasMore = false;

    for (let round = 0; round < MAX_SCAN_ROUNDS && collected.length < limit; round += 1) {
      const batch = await args.fetchPersonalized({ limit, offset });
      const accepted = selectUniqueProjects(batch.projects, seenProjectIds, limit - collected.length);
      collected.push(...accepted);
      offset = batch.nextOffset;
      hasMore = batch.hasMore;

      if (!batch.hasMore) {
        break;
      }
    }

    if (collected.length >= limit || hasMore) {
      return {
        projects: collected,
        nextOffset: offset,
        hasMore,
        mode: "personalized",
      };
    }
  }

  let offset = args.mode === "popular-fallback" ? normalizeOffset(args.offset) : 0;
  let hasMore = false;

  for (let round = 0; round < MAX_SCAN_ROUNDS && collected.length < limit; round += 1) {
    const batch = await args.fetchPopular({ limit, offset });
    const accepted = selectUniqueProjects(batch.projects, seenProjectIds, limit - collected.length);
    collected.push(...accepted);
    offset = batch.nextOffset;
    hasMore = batch.hasMore;

    if (!batch.hasMore) {
      break;
    }
  }

  if (collected.length < limit && (args.excludeIds?.length || 0) > 0) {
    const relaxedSeenProjectIds = new Set(collected.map((project) => normalizeProjectId(project.id)));
    let relaxedOffset = 0;

    for (let round = 0; round < MAX_SCAN_ROUNDS && collected.length < limit; round += 1) {
      const batch = await args.fetchPopular({ limit, offset: relaxedOffset });
      const accepted = selectUniqueProjects(batch.projects, relaxedSeenProjectIds, limit - collected.length);
      collected.push(...accepted);
      relaxedOffset = batch.nextOffset;

      if (!batch.hasMore) {
        break;
      }
    }
  }

  return {
    projects: collected,
    nextOffset: offset,
    hasMore,
    mode: "popular-fallback",
  };
}

export async function getHomepageRecommendations(args: {
  limit?: number;
  offset?: number;
  excludeIds?: Array<string | number>;
  mode?: HomepageRecommendationMode;
  preferenceContext?: HomepagePreferenceContext;
  blendPopular?: boolean;
  shuffleSeed?: string;
} = {}): Promise<HomepageRecommendationResult> {
  const preferenceContext = args.preferenceContext ?? (await getHomepageUserPreferences());
  const mode = resolveMode(args.mode, preferenceContext.hasPreferences);
  const blendPopular = args.blendPopular ?? false;
  const shuffleSeed = args.shuffleSeed ?? (await getRecommendationViewerKey());

  return collectHomepageRecommendations({
    limit: args.limit,
    offset: args.offset,
    excludeIds: args.excludeIds,
    mode,
    fetchPersonalized: (batchArgs) => fetchPersonalizedBatch(preferenceContext, batchArgs, shuffleSeed),
    fetchPopular: (batchArgs) => fetchPopularBatch(batchArgs, blendPopular, shuffleSeed),
  });
}

export async function getHomepageShowcaseData(): Promise<HomepageShowcaseData> {
  const [recentHotProjects, preferenceContext, communityFeed, categoryTileCounts] = await Promise.all([
    getCategoryBalancedHotProjects(),
    getHomepageUserPreferences(),
    getHomepageCommunityFeed(),
    getHomepageCategoryTileCounts(),
  ]);

  const recommendations = await getHomepageRecommendations({
    limit: SIDEBAR_RECOMMENDATION_LIMIT,
    offset: 0,
    excludeIds: recentHotProjects.map((project) => project.id),
    preferenceContext,
  });

  return {
    recentHotProjects,
    communityFeed,
    categoryTileCounts,
    ...recommendations,
  };
}
