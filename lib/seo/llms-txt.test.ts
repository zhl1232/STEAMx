import { afterEach, describe, expect, it } from "vitest";

import { buildLlmsTxt } from "@/lib/seo/llms-txt";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("buildLlmsTxt", () => {
  it("describes the public site and keeps the production sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://steam.bj.cn";

    const text = buildLlmsTxt();

    expect(text).toContain("# 创探空间");
    expect(text).toContain("Primary URL: https://steam.bj.cn");
    expect(text).toContain("帮助家长陪孩子找到感兴趣的动手项目");
    expect(text).not.toContain("非游戏平台");
    expect(text).toContain("## What it is");
    expect(text).not.toContain("## What it is not");
    expect(text).not.toContain("Not Valve Steam");
    expect(text).toContain("helps parents find hands-on activities to do with their children");
    expect(text).toContain("https://steam.bj.cn/explore");
    expect(text).toContain("https://steam.bj.cn/sitemap.xml");
    expect(text).toContain("/courses?course=<课程ID>");
    expect(text).toContain("/courses/<课程ID>/lessons/<课时ID>");
    expect(text).toContain("未列出的历史课程不作为推荐入口");
    expect(text).toContain("/api/");
    expect(text).toContain("/admin/");
    expect(text).toContain("/login");
  });
});
