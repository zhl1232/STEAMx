import { HomeShowcase } from "@/components/home/home-showcase";
import { JsonLd } from "@/components/seo/json-ld";
import { getHomepageShowcaseData } from "@/lib/home/recommendations";
import { HOME_DOCUMENT_TITLE, SITE_DESCRIPTION } from "@/lib/seo/site";
import { buildWebsiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: HOME_DOCUMENT_TITLE,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: ["少儿编程", "免费少儿编程", "积木", "自然观察"],
  absoluteTitle: true,
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
