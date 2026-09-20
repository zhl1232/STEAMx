import type { Metadata } from "next";

import { HomeShowcase } from "@/components/home/home-showcase";
import { HomepageCanonicalTags } from "@/components/seo/homepage-canonical";
import { JsonLd } from "@/components/seo/json-ld";
import { getHomepageShowcaseData } from "@/lib/home/recommendations";
import { buildWebsiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { HOME_DOCUMENT_TITLE, SITE_DESCRIPTION } from "@/lib/seo/site";

export const revalidate = 300;

const homePageMetadata = buildPageMetadata({
  title: HOME_DOCUMENT_TITLE,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: ["创探空间", "积木课程", "科学实践", "少儿STEAM", "3-16岁", "PBL"],
  absoluteTitle: true,
  omitCanonical: true,
});

export const metadata: Metadata = {
  ...homePageMetadata,
  // Clear any inherited canonical/og:url so only HomepageCanonicalTags remain.
  // Next Metadata API strips the trailing slash on `/`.
  alternates: {
    canonical: null,
  },
  openGraph: {
    ...homePageMetadata.openGraph,
    url: null,
  },
};

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
      <HomepageCanonicalTags />
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
