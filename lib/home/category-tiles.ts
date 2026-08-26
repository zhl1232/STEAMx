import { unstable_cache } from "next/cache";

import { getProjects } from "@/lib/api/explore-data";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { logger } from "@/lib/logger";
import { PLAYGROUND_MINI_GAMES_COUNT } from "@/lib/playground/catalog";
import { isPlaywrightSmoke } from "@/lib/testing/playwright-smoke";
import { createPublicClient } from "@/lib/supabase/server";

export const HOME_STEAM_CATEGORY_KEYS = ["科学", "技术", "工程", "艺术", "数学"] as const;
export type HomeSteamCategoryKey = (typeof HOME_STEAM_CATEGORY_KEYS)[number];

export type HomeCategoryTileCounts = Record<HomeSteamCategoryKey, number> & {
  playgroundGames: number;
};

async function countApprovedProjectsByCategory(enforceReviewed: boolean): Promise<HomeCategoryTileCounts> {
  const supabase = createPublicClient();

  const pairs = await Promise.all(
    HOME_STEAM_CATEGORY_KEYS.map(async (category) => {
      let query = supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .eq("moderation_state", "approved")
        .eq("category", category);
      if (enforceReviewed) {
        query = query.eq("classification_status", "reviewed");
      }
      const { count, error } = await query;

      if (error) {
        logger.error("homepage category tile count failed", { category, error });
        return [category, 0] as const;
      }

      return [category, count ?? 0] as const;
    }),
  );

  const byCategory = Object.fromEntries(pairs) as Record<HomeSteamCategoryKey, number>;

  return {
    ...byCategory,
    playgroundGames: PLAYGROUND_MINI_GAMES_COUNT,
  };
}

async function countSmokeProjectsByCategory(): Promise<HomeCategoryTileCounts> {
  const pairs = await Promise.all(
    HOME_STEAM_CATEGORY_KEYS.map(async (category) => {
      const { total } = await getProjects({ category }, { page: 0, pageSize: 1, sortBy: "latest" });
      return [category, total] as const;
    }),
  );

  return {
    ...(Object.fromEntries(pairs) as Record<HomeSteamCategoryKey, number>),
    playgroundGames: PLAYGROUND_MINI_GAMES_COUNT,
  };
}

const getLiveHomepageCategoryTileCounts = unstable_cache(
  async (enforceReviewed: boolean) => countApprovedProjectsByCategory(enforceReviewed),
  ["homepage-category-tile-counts-v2"],
  { revalidate: 300 },
);

export async function getHomepageCategoryTileCounts(): Promise<HomeCategoryTileCounts> {
  try {
    if (isPlaywrightSmoke()) {
      return countSmokeProjectsByCategory();
    }
    const settings = await getContentClassificationSettings();
    return await getLiveHomepageCategoryTileCounts(settings.enforcementEnabled);
  } catch (error) {
    logger.error("getHomepageCategoryTileCounts failed", { error });
    const zero = Object.fromEntries(HOME_STEAM_CATEGORY_KEYS.map((k) => [k, 0])) as Record<
      HomeSteamCategoryKey,
      number
    >;
    return { ...zero, playgroundGames: PLAYGROUND_MINI_GAMES_COUNT };
  }
}
