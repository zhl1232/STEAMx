import {
  getHomepageRecommendations,
  type HomepageRecommendationMode,
  type HomepageRecommendationResult,
} from "@/lib/home/recommendations";

export const EXPLORE_FOR_YOU_LIMIT = 8;

export type ExploreForYouData = HomepageRecommendationResult;

export async function getExploreForYouRecommendations(args: {
  excludeIds?: Array<string | number>;
  limit?: number;
  offset?: number;
  mode?: HomepageRecommendationMode;
} = {}): Promise<ExploreForYouData> {
  return getHomepageRecommendations({
    limit: args.limit ?? EXPLORE_FOR_YOU_LIMIT,
    offset: args.offset ?? 0,
    excludeIds: args.excludeIds,
    mode: args.mode ?? "popular-fallback",
    blendPopular: true,
  });
}

/** Server-only: public popular recommendations for the explore page rail. */
export async function getExploreForYouInitialData(): Promise<ExploreForYouData | null> {
  const recommendations = await getExploreForYouRecommendations({
    mode: "popular-fallback",
  });

  if (recommendations.projects.length === 0) {
    return null;
  }

  return recommendations;
}
