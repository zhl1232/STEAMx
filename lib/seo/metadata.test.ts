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
      expect.arrayContaining([
        "STEAMX",
        "史迪姆",
        "STEAMX 史迪姆",
        "少儿STEAM",
        "少儿编程",
        "免费少儿编程",
        "积木",
        "积木课程",
        "科学实践",
        "自然观察",
        "科学小实验",
        "PBL",
        "3-16岁",
      ]),
    );
    expect(DEFAULT_SEO_KEYWORDS).not.toEqual(expect.arrayContaining(["科创", "项目式学习", "少儿STEAM社区"]));
    expect(DEFAULT_SEO_KEYWORDS).not.toEqual(expect.arrayContaining(["观鸟"]));
    expect(DEFAULT_SEO_KEYWORDS.join(" ")).not.toContain("乐高");
    expect(DEFAULT_SEO_KEYWORDS.join(" ").toLowerCase()).not.toContain("steam教育");

    const metadata = buildPageMetadata({
      title: "STEAMX 史迪姆官网 | 积木课程、科学实践与自然观察",
      description: "STEAMX · 史迪姆是面向 3–16 岁孩子、家长和教育者的少儿 STEAM 教育与自然探索平台（非游戏平台），提供积木课程、科学实践、自然观察、少儿编程与 PBL，帮助孩子在动手实践中学习、创造和分享。",
      path: "/",
      absoluteTitle: true,
    });

    expect(metadata.title).toEqual({ absolute: "STEAMX 史迪姆官网 | 积木课程、科学实践与自然观察" });
    expect(metadata.description).toContain("非游戏平台");
    expect(metadata.description).toContain("积木课程");
    expect(metadata.openGraph).toMatchObject({
      title: "STEAMX 史迪姆官网 | 积木课程、科学实践与自然观察",
      description: expect.stringContaining("非游戏平台"),
    });
    expect(metadata.twitter).toMatchObject({
      title: "STEAMX 史迪姆官网 | 积木课程、科学实践与自然观察",
    });
  });
});
