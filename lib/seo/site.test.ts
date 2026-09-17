import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAbsoluteUrl, getMetadataBase, getSiteUrl, HOME_DOCUMENT_TITLE, HOME_PAGE_TITLE, SITE_DESCRIPTION } from "@/lib/seo/site";

const SITE_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearSiteEnv() {
  SITE_ENV_KEYS.forEach((key) => vi.stubEnv(key, ""));
}

describe("getSiteUrl", () => {
  it("always uses the public canonical origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://10.32.10.214:3000/internal/path");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://steamx.cc");

    expect(getSiteUrl()).toBe("https://steam.bj.cn");
    expect(getMetadataBase().toString()).toBe("https://steam.bj.cn/");
    expect(buildAbsoluteUrl("/nature/birds")).toBe("https://steam.bj.cn/nature/birds");
    expect(buildAbsoluteUrl("/")).toBe("https://steam.bj.cn/");
  });

  it("normalizes official host variants outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://steamx.cc/unexpected/path");

    expect(getSiteUrl()).toBe("https://steam.bj.cn");
  });

  it("keeps custom development origins without trailing slashes", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001/preview///");

    expect(getSiteUrl()).toBe("http://localhost:3001/preview");
  });

  it("falls back to localhost when development candidates are absent", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearSiteEnv();

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("skips malformed development candidates", () => {
    vi.stubEnv("NODE_ENV", "development");
    clearSiteEnv();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "://invalid");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://preview.example.com/");

    expect(getSiteUrl()).toBe("https://preview.example.com");
  });
});

describe("site SEO copy", () => {
  it("uses high-volume search terms instead of jargon keywords", () => {
    expect(HOME_PAGE_TITLE).toBe("积木课程、科学实践与自然观察");
    expect(HOME_PAGE_TITLE).not.toContain("项目式学习");
    expect(HOME_PAGE_TITLE).not.toContain("观鸟");
    expect(HOME_PAGE_TITLE).not.toContain("免费");
    expect(HOME_DOCUMENT_TITLE).toBe("STEAMX 史迪姆官网 | 积木课程、科学实践与自然观察");
    expect(SITE_DESCRIPTION).toContain("STEAMX · 史迪姆");
    expect(SITE_DESCRIPTION).toContain("3–16 岁");
    expect(SITE_DESCRIPTION).toContain("少儿 STEAM 教育与自然探索平台");
    expect(SITE_DESCRIPTION).toContain("非游戏平台");
    expect(SITE_DESCRIPTION).toContain("积木课程");
    expect(SITE_DESCRIPTION).toContain("科学实践");
    expect(SITE_DESCRIPTION).toContain("自然观察");
    expect(SITE_DESCRIPTION).toContain("PBL");
    expect(SITE_DESCRIPTION.toLowerCase()).not.toContain("steam教育");
    expect(SITE_DESCRIPTION).not.toContain("STEAM教育");
    expect(SITE_DESCRIPTION).not.toContain("项目式学习");
  });
});
