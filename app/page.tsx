import { HomeShowcase } from "@/components/home/home-showcase";
import { getHomepageShowcaseData } from "@/lib/home/recommendations";

export default async function Home() {
  const {
    recentHotProjects,
    communityFeed,
    categoryTileCounts,
    projects: initialRecommendations,
    nextOffset: initialRecommendationNextOffset,
    hasMore: initialRecommendationHasMore,
    mode: initialRecommendationMode,
  } = await getHomepageShowcaseData();

  return (
    <HomeShowcase
      recentHotProjects={recentHotProjects}
      communityFeed={communityFeed}
      categoryTileCounts={categoryTileCounts}
      initialRecommendations={initialRecommendations}
      initialRecommendationMode={initialRecommendationMode}
      initialRecommendationNextOffset={initialRecommendationNextOffset}
      initialRecommendationHasMore={initialRecommendationHasMore}
    />
  );
}
