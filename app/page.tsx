import { HomeShowcase } from "@/components/home/home-showcase";
import { JsonLd } from "@/components/seo/json-ld";
import { getHomepageShowcaseData } from "@/lib/home/recommendations";
import { buildWebsiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { SITE_DESCRIPTION } from "@/lib/seo/site";

export const metadata = buildPageMetadata({
  title: "STEAM 项目式学习与自然观察社区",
  description: SITE_DESCRIPTION,
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
    <>
      <JsonLd data={buildWebsiteJsonLd()} />
      <HomeShowcase
        works={works}
        worksNextOffset={worksNextOffset}
        worksHasMore={worksHasMore}
        recentNatureObservations={recentNatureObservations}
        communityFeed={communityFeed}
        categoryTileCounts={categoryTileCounts}
        featuredChallenge={featuredChallenge}
      />
    </>
  );
}
