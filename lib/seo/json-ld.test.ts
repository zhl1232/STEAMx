import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildBreadcrumbJsonLd,
  buildCourseJsonLd,
  buildLearningResourceJsonLd,
  buildLessonJsonLd,
  buildObservationJsonLd,
  buildProjectJsonLd,
  buildSpeciesProfileJsonLd,
  buildWebsiteJsonLd,
  buildWorkJsonLd,
  toAbsoluteMediaUrl,
} from "@/lib/seo/json-ld";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";
});

describe("toAbsoluteMediaUrl", () => {
  it("keeps already-absolute URLs and ignores empty values", () => {
    expect(toAbsoluteMediaUrl("https://cdn.example/cover.webp")).toBe("https://cdn.example/cover.webp");
    expect(toAbsoluteMediaUrl("   ")).toBeUndefined();
  });
});

describe("buildWebsiteJsonLd", () => {
  it("emits WebSite and Organization using the shared site URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";

    const data = buildWebsiteJsonLd();
    const types = data["@graph"].map((item) => item["@type"]);

    expect(types).toEqual(["Organization", "WebSite"]);
    expect(data["@graph"][0]).toMatchObject({
      name: "STEAMX · 史迪姆",
      url: "https://www.steamx.cc",
    });
    expect(data["@graph"][1]).toMatchObject({
      name: "STEAMX · 史迪姆",
      url: "https://www.steamx.cc",
      inLanguage: "zh-CN",
    });
    expect(data["@graph"][1].potentialAction).toMatchObject({
      "@type": "SearchAction",
      "query-input": "required name=search_term_string",
    });
  });
});

describe("page entity JSON-LD", () => {
  it("builds absolute breadcrumb items", () => {
    expect(buildBreadcrumbJsonLd([
      { name: "首页", url: "/" },
      { name: "课程", url: "/courses" },
    ])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "首页", item: "https://www.steamx.cc/" },
        { position: 2, name: "课程", item: "https://www.steamx.cc/courses" },
      ],
    });
  });

  it("describes a course and its real lesson URLs", () => {
    const data = buildCourseJsonLd({
      id: 7,
      title: "五子棋入门",
      description: "从规则到实战，学习五子棋的基本思路。",
      lessons: [
        { id: 21, title: "认识棋盘", summary: "认识横线、竖线和落子位置。", durationMinutes: 8 },
      ],
    });

    expect(data["@graph"][0]).toMatchObject({
      "@type": "Course",
      name: "五子棋入门",
      hasPart: [
        {
          "@type": "LearningResource",
          name: "认识棋盘",
          url: "https://www.steamx.cc/courses/7/lessons/21",
          timeRequired: "PT8M",
        },
      ],
    });
  });

  it("keeps lesson steps and species identity tied to canonical pages", () => {
    const lesson = buildLessonJsonLd({
      id: 21,
      courseId: 7,
      courseTitle: "五子棋入门",
      title: "认识棋盘",
      description: "认识五子棋棋盘和基本落子规则。",
      steps: [{ title: "观察棋盘", description: "找出横线与竖线的交叉点。" }],
    });
    const species = buildSpeciesProfileJsonLd({
      slug: "passer-montanus",
      commonName: "麻雀",
      scientificName: "Passer montanus",
      aliases: ["树麻雀"],
      description: "观察麻雀的识别特征和常见环境。",
      recentObservations: [{ id: 99, title: "校园里的麻雀" }],
    });

    expect(lesson).toMatchObject({
      "@type": "LearningResource",
      url: "https://www.steamx.cc/courses/7/lessons/21",
      hasPart: [{ "@type": "HowToStep", name: "观察棋盘" }],
    });
    expect(species["@graph"][1]).toMatchObject({
      "@type": "Taxon",
      name: "麻雀",
      scientificName: "Passer montanus",
      alternateName: ["树麻雀"],
    });
    expect((species["@graph"][2] as { itemListElement: Array<{ item: { url: string } }> }).itemListElement[0].item.url).toBe(
      "https://www.steamx.cc/nature/observations/99",
    );
  });
});

describe("buildProjectJsonLd", () => {
  it("emits Article only when there are no usable steps", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";

    const data = buildProjectJsonLd({
      id: 12,
      title: "纸杯火箭",
      description: "用纸杯做一枚小火箭",
      image: "https://cdn.example/rocket.webp",
      steps: [{ title: "   ", description: "" }],
    });

    expect(data).toMatchObject({
      "@type": "Article",
      headline: "纸杯火箭",
      description: "用纸杯做一枚小火箭",
      url: "https://www.steamx.cc/project/12",
      image: "https://cdn.example/rocket.webp",
    });
    expect(data).not.toHaveProperty("@graph");
  });

  it("adds HowTo only from real step titles or descriptions", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";

    const data = buildProjectJsonLd({
      id: 12,
      title: "纸杯火箭",
      description: "用纸杯做一枚小火箭",
      image: "/covers/rocket.webp",
      steps: [
        { title: "准备纸杯", description: "选一个干净纸杯", image_url: "/steps/1.webp" },
        { title: "", description: "" },
      ],
    });

    expect(data["@graph"]?.[1]).toMatchObject({
      "@type": "HowTo",
      name: "纸杯火箭",
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "准备纸杯",
          text: "选一个干净纸杯",
          image: "https://www.steamx.cc/steps/1.webp",
        },
      ],
    });
  });
});

describe("public content JSON-LD", () => {
  it("describes a public work as a CreativeWork", () => {
    expect(buildWorkJsonLd({
      id: 12,
      title: "小明的纸杯火箭",
      description: "记录火箭制作和试飞过程。",
      images: ["/works/rocket.webp"],
      author: "小明",
      dateCreated: "2026-08-20T08:00:00Z",
    })).toMatchObject({
      "@type": "CreativeWork",
      url: "https://www.steamx.cc/works/12",
      image: ["https://www.steamx.cc/works/rocket.webp"],
      creator: { "@type": "Person", name: "小明" },
    });
  });

  it("ties an observation to its taxon and content location", () => {
    expect(buildObservationJsonLd({
      id: 99,
      title: "麻雀 · 自然观察记录",
      observedAt: "2026-08-21T09:00:00Z",
      locationName: "校园操场",
      latitude: 39.9,
      longitude: 116.4,
      species: [{
        commonName: "麻雀",
        scientificName: "Passer montanus",
        slug: "passer-montanus",
      }],
    })).toMatchObject({
      "@type": "CreativeWork",
      url: "https://www.steamx.cc/nature/observations/99",
      about: [{
        "@type": "Taxon",
        name: "麻雀",
        url: "https://www.steamx.cc/nature/species/passer-montanus",
      }],
      contentLocation: {
        "@type": "Place",
        name: "校园操场",
        geo: { "@type": "GeoCoordinates", latitude: 39.9, longitude: 116.4 },
      },
    });
  });

  it("describes a published resource as a free LearningResource", () => {
    expect(buildLearningResourceJsonLd({
      id: 7,
      title: "如何记录实验变量",
      description: "学习区分自变量、因变量和控制变量。",
      category: "方法",
      datePublished: "2026-08-01T00:00:00Z",
    })).toMatchObject({
      "@type": "LearningResource",
      url: "https://www.steamx.cc/resources/7",
      learningResourceType: "方法",
      isAccessibleForFree: true,
    });
  });
});
