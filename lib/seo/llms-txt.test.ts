import { afterEach, describe, expect, it } from "vitest";

import { buildLlmsTxt } from "@/lib/seo/llms-txt";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("buildLlmsTxt", () => {
  it("describes the public site and keeps the production sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://steam.bj.cn";

    const text = buildLlmsTxt();

    expect(text).toContain("# STEAMX · 史迪姆");
    expect(text).toContain("STEAM 教育与自然探索平台");
    expect(text).toContain("STEAMX (史迪姆) is a Chinese STEAM education and nature exploration platform");
    expect(text).toContain("https://steam.bj.cn/explore");
    expect(text).toContain("https://steam.bj.cn/sitemap.xml");
    expect(text).toContain("/api/");
    expect(text).toContain("/admin/");
    expect(text).toContain("/login");
  });
});
