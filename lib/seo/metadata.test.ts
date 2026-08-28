import { describe, expect, it } from "vitest";

import { buildPageMetadata, DEFAULT_SEO_KEYWORDS, DEFAULT_SOCIAL_IMAGE } from "@/lib/seo/metadata";

describe("buildPageMetadata", () => {
  it("provides a large default social image", () => {
    const metadata = buildPageMetadata({
      title: "物种图鉴",
      description: "浏览自然物种图鉴。",
      path: "/nature/species",
    });

    expect(metadata.openGraph?.images).toEqual([{
      url: DEFAULT_SOCIAL_IMAGE,
      width: 1200,
      height: 630,
      alt: "物种图鉴",
    }]);
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [DEFAULT_SOCIAL_IMAGE],
    });
  });

  it("prefers a topical image without claiming unknown dimensions", () => {
    const metadata = buildPageMetadata({
      title: "麻雀",
      description: "麻雀物种档案。",
      path: "/nature/species/passer-montanus",
      image: "/birds/sparrow.webp",
    });

    expect(metadata.openGraph?.images).toEqual([{
      url: "/birds/sparrow.webp",
      alt: "麻雀",
    }]);
  });

  it("leads with high-volume search terms and avoids Valve steam教育", () => {
    expect(DEFAULT_SEO_KEYWORDS).toEqual(
      expect.arrayContaining(["少儿编程", "积木", "观鸟"]),
    );
    expect(DEFAULT_SEO_KEYWORDS).not.toEqual(expect.arrayContaining(["科创", "项目式学习", "少儿STEAM社区"]));
    expect(DEFAULT_SEO_KEYWORDS.join(" ")).not.toContain("乐高");
    expect(DEFAULT_SEO_KEYWORDS.join(" ").toLowerCase()).not.toContain("steam教育");

    const metadata = buildPageMetadata({
      title: "少儿编程 · 积木 · 观鸟",
      description: "STEAMX（史迪姆）给孩子做少儿编程、积木课和观鸟。动手搭、去观察，把项目做成作品。",
      path: "/",
    });

    expect(metadata.title).toBe("少儿编程 · 积木 · 观鸟");
    expect(metadata.description).toContain("STEAMX（史迪姆）给孩子做少儿编程、积木课和观鸟");
    expect(metadata.openGraph).toMatchObject({
      title: "少儿编程 · 积木 · 观鸟",
      description: "STEAMX（史迪姆）给孩子做少儿编程、积木课和观鸟。动手搭、去观察，把项目做成作品。",
    });
  });
});
