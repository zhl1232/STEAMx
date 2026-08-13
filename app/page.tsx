import { HomeShowcase } from "@/components/home/home-showcase";
import { getHomepageShowcaseData } from "@/lib/home/recommendations";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "STEAM 项目式学习与自然观察社区",
  description:
    "STEAM 项目式学习与自然观察社区，围绕科学实验、技术制作、工程搭建、艺术创作、数学思维和鸟类观察，发现、分享并完成真实项目。",
  path: "/",
  keywords: ["STEAM教育平台", "项目式学习平台", "创客社区"],
});

export default async function Home() {
  const {
    works,
    worksNextOffset,
    worksHasMore,
    recentNatureObservations,
    communityFeed,
    categoryTileCounts,
    featuredChallenge,
  } = await getHomepageShowcaseData();

  return (
    <HomeShowcase
      works={works}
      worksNextOffset={worksNextOffset}
      worksHasMore={worksHasMore}
      recentNatureObservations={recentNatureObservations}
      communityFeed={communityFeed}
      categoryTileCounts={categoryTileCounts}
      featuredChallenge={featuredChallenge}
    />
  );
}
