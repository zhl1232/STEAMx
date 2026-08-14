import { afterEach, describe, expect, it } from "vitest";

import { buildProjectJsonLd, buildWebsiteJsonLd, toAbsoluteMediaUrl } from "@/lib/seo/json-ld";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
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
      name: "STEAM 探索",
      url: "https://www.steamx.cc",
    });
    expect(data["@graph"][1]).toMatchObject({
      name: "STEAM 探索",
      url: "https://www.steamx.cc",
      inLanguage: "zh-CN",
    });
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
