import { unstable_rethrow } from "next/navigation";

import { getProjects, getRecommendedProjects } from "@/lib/api/explore-data";
import { getRecentNatureObservationsForMap } from "@/lib/api/nature-observation-homepage";
import { getFeaturedPblChallenge, type FeaturedPblChallenge } from "@/lib/api/pbl-challenges";
import { getHomepageCategoryTileCounts, type HomeCategoryTileCounts } from "@/lib/home/category-tiles";
import { getHomepageCommunityFeed, type HomeCommunityFeedItem } from "@/lib/home/community-feed";
import { logger } from "@/lib/logger";
import { getRecommendationViewerKey } from "@/lib/recommendations/viewer";
import { type ObservationEvent, type Project, type Work } from "@/lib/mappers/types";
import { callRpc } from "@/lib/supabase/rpc";
import { createClient } from "@/lib/supabase/server";
import { getTrendingWorks } from "@/lib/works/data";

export type HomepageRecommendationMode = "personalized" | "popular-fallback";

export interface HomepageRecommendationResult {
  projects: Project[];
  nextOffset: number;
  hasMore: boolean;
  mode: HomepageRecommendationMode;
}

export interface HomepageShowcaseData {
  works: Work[];
  worksNextOffset: number;
  worksHasMore: boolean;
  recentNatureObservations: ObservationEvent[];
  communityFeed: HomeCommunityFeedItem[];
  categoryTileCounts: HomeCategoryTileCounts;
  featuredChallenge: FeaturedPblChallenge | null;
}

type HomepagePreferenceContext = {
  userId: string;
  steam: Record<string, number> | null;
  age: number | null;
  hasPreferences: boolean;
};

type RecommendationBatch = {
  projects: Project[];
  nextOffset: number;
  hasMore: boolean;
};

type RecommendationBatchFetcher = (args: { limit: number; offset: number }) => Promise<RecommendationBatch>;

const RECENT_HOT_LIMIT = 6;
const SIDEBAR_RECOMMENDATION_LIMIT = 8;
const MAX_SCAN_ROUNDS = 6;

/**
 * Convert a profile birth date to the exact recommendation age without
 * retaining or logging the original date. Ages outside the product's
 * 3–16-year content range intentionally produce no preference.
 */
export function birthDateToExactAge(
  birthDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;

  const [year, month, day] = birthDate.split("-").map(Number);
  const parsedBirthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedBirthDate.getUTCFullYear() !== year ||
    parsedBirthDate.getUTCMonth() !== month - 1 ||
    parsedBirthDate.getUTCDate() !== day
  ) {
    return null;
  }

  let age = now.getFullYear() - year;
  if (
    now.getMonth() + 1 < month ||
    (now.getMonth() + 1 === month && now.getDate() < day)
  ) {
    age -= 1;
  }

  return age >= 3 && age <= 16 ? age : null;
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

async function getHomepageUserPreferences(): Promise<HomepagePreferenceContext> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { userId: "", steam: null, age: null, hasPreferences: false };
    }

    const [profileRes, radarRes] = await Promise.all([
      supabase.from("profiles").select("birth_date").eq("id", user.id).single(),
      callRpc(supabase, "calculate_steam_radar", { target_user_id: user.id }),
    ]);

    const birthDate = (profileRes.data as { birth_date: string | null } | null)?.birth_date ?? null;
    const age = birthDateToExactAge(birthDate);

    const radarData = radarRes.data as Record<string, { display: number }> | null;
    let steam: Record<string, number> | null = null;

    if (radarData) {
      const scores: Record<string, number> = {};
      for (const dimension of ["S", "T", "E", "A", "M"]) {
        scores[dimension] = radarData[dimension]?.display ?? 0;
      }

      steam = Object.values(scores).some((score) => score > 0) ? scores : null;
    }

    const hasPreferences = steam !== null || age !== null;
    return { userId: user.id, steam, age, hasPreferences };
  } catch (error) {
    unstable_rethrow(error);
    logger.error("Failed to get user preferences for homepage recommendations", { error });
    return { userId: "", steam: null, age: null, hasPreferences: false };
  }
}

async function fetchPersonalizedBatch(
  context: HomepagePreferenceContext,
  args: { limit: number; offset: number },
  shuffleSeed: string,
): Promise<RecommendationBatch> {
  const result = await getRecommendedProjects(
    context.steam,
    context.age,
    { limit: args.limit, offset: args.offset },
    {
      fallbackToPopular: false,
      shuffleSeed,
      shuffleBatch: 0,
      userId: context.userId,
    },
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
  const [worksResult, recentNatureObservations, communityFeed, categoryTileCounts, featuredChallenge] = await Promise.all([
    getTrendingWorks(4).catch((error) => {
      unstable_rethrow(error);
      logger.warn("Failed to load homepage works", { error });
      return { works: [], nextOffset: 0, hasMore: false };
    }),
    getRecentNatureObservationsForMap(3),
    getHomepageCommunityFeed(),
    getHomepageCategoryTileCounts(),
    getFeaturedPblChallenge(),
  ]);

  return {
    works: worksResult.works,
    worksNextOffset: worksResult.nextOffset,
    worksHasMore: worksResult.hasMore,
    recentNatureObservations,
    communityFeed,
    categoryTileCounts,
    featuredChallenge,
  };
}
