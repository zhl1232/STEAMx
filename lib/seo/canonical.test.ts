import { describe, expect, it } from "vitest";

import { buildCanonicalUrl, buildPageMetadata } from "@/lib/seo/metadata";
import { buildAbsoluteUrl } from "@/lib/seo/site";

describe("canonical URLs", () => {
  it("strips tracking params and fragments", () => {
    expect(buildCanonicalUrl("/project/348?from=explore&sourceIndex=3")).toBe(buildAbsoluteUrl("/project/348"));
    expect(buildCanonicalUrl("/nature/species/osmoderma-barnabita?from=%2Fnature%2Fspecies")).toBe(
      buildAbsoluteUrl("/nature/species/osmoderma-barnabita"),
    );
    expect(buildCanonicalUrl("/playground/sudoku?utm_source=wechat&utm_medium=share#top")).toBe(
      buildAbsoluteUrl("/playground/sudoku"),
    );
    expect(buildCanonicalUrl("/project/1?from=explore-for-you")).toBe(buildAbsoluteUrl("/project/1"));
  });

  it("keeps deliberate pagination params chosen by the page", () => {
    expect(buildCanonicalUrl("/explore?sortBy=latest&page=1&from=explore")).toBe(
      buildAbsoluteUrl("/explore?sortBy=latest&page=1"),
    );
  });

  it("buildPageMetadata canonical and og:url are parameter-free for detail paths", () => {
    const metadata = buildPageMetadata({
      title: "凹背臭斑金龟",
      description: "d",
      path: "/nature/species/osmoderma-barnabita?from=/nature&sourceIndex=2",
    });
    expect(metadata.alternates?.canonical).toBe(buildAbsoluteUrl("/nature/species/osmoderma-barnabita"));
    expect(metadata.openGraph?.url).toBe(buildAbsoluteUrl("/nature/species/osmoderma-barnabita"));
  });
});
