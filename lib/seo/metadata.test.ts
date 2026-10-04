import { describe, expect, it } from "vitest";

import { buildPageMetadata, DEFAULT_SEO_KEYWORDS, DEFAULT_SOCIAL_IMAGE } from "@/lib/seo/metadata";
import { buildAbsoluteUrl } from "@/lib/seo/site";

describe("buildPageMetadata", () => {
  it("provides a large default social image", () => {
    const metadata = buildPageMetadata({
      title: "物种图鉴",
      description: "浏览自然物种图鉴。",
      path: "/nature/species",
    });

    expect(metadata.openGraph?.images).toEqual([{
      url: buildAbsoluteUrl(DEFAULT_SOCIAL_IMAGE),
      width: 1200,
      height: 630,
      alt: "物种图鉴",
    }]);
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [buildAbsoluteUrl(DEFAULT_SOCIAL_IMAGE)],
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
      url: buildAbsoluteUrl("/api/assets/birds/sparrow.webp"),
      alt: "麻雀",
    }]);
  });

  it("leads with high-volume search terms and avoids Valve steam教育", () => {
    expect(DEFAULT_SEO_KEYWORDS).toEqual(
      expect.arrayContaining([
        "创探空间",
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
      title: "创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程",
      description: "创探空间是面向 3–16 岁孩子的少儿 STEAM 项目式学习平台。兴趣是最好的老师：孩子在积木搭建、科学实验、自然观察和编程项目中动手发现问题、尝试解决、获得成功反馈。",
      path: "/",
      absoluteTitle: true,
    });

    expect(metadata.title).toEqual({ absolute: "创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程" });
    expect(metadata.description).not.toContain("非游戏平台");
    expect(metadata.description).toContain("积木搭建");
    expect(metadata.openGraph).toMatchObject({
      title: "创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程",
      description: expect.stringContaining("少儿 STEAM"),
    });
    expect(metadata.alternates?.canonical).toBe(buildAbsoluteUrl("/"));
    expect(metadata.openGraph?.url).toBe(buildAbsoluteUrl("/"));
    expect(String(metadata.alternates?.canonical).endsWith("/")).toBe(true);
    expect(metadata.twitter).toMatchObject({
      title: "创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程",
    });
  });

  it("can omit metadata canonical/og:url for handwritten homepage tags", () => {
    const metadata = buildPageMetadata({
      title: "创探空间｜少儿 STEAM 项目式学习：积木、科学实验与编程",
      description: "desc",
      path: "/",
      absoluteTitle: true,
      omitCanonical: true,
    });

    expect(metadata.alternates?.canonical).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(String(buildAbsoluteUrl("/")).endsWith("/")).toBe(true);
  });

  it("uses noindex, nofollow by default and noindex, follow when requested", () => {
    const base = { title: "课程", description: "desc", path: "/courses/1" };

    expect(buildPageMetadata(base).robots).toBeUndefined();
    expect(buildPageMetadata({ ...base, noIndex: true }).robots).toEqual({ index: false, follow: false });
    expect(buildPageMetadata({ ...base, noIndex: true, noIndexFollow: true }).robots).toEqual({ index: false, follow: true });
    // noIndexFollow alone never de-indexes a page.
    expect(buildPageMetadata({ ...base, noIndexFollow: true }).robots).toBeUndefined();
  });
});

