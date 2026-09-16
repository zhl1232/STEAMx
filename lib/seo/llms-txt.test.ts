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
    expect(text).toContain("Primary URL: https://steam.bj.cn");
    expect(text).toContain("少儿 STEAM 教育与自然探索平台");
    expect(text).toContain("非游戏平台");
    expect(text).toContain("## What it is");
    expect(text).toContain("## What it is not");
    expect(text).toContain("Not Valve Steam");
    expect(text).toContain("Chinese kids STEAM education");
    expect(text).toContain("https://steam.bj.cn/explore");
    expect(text).toContain("https://steam.bj.cn/sitemap.xml");
    expect(text).toContain("/api/");
    expect(text).toContain("/admin/");
    expect(text).toContain("/login");
  });
});
