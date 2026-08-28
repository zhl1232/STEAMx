import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAbsoluteUrl, getMetadataBase, getSiteUrl, HOME_PAGE_TITLE, SITE_DESCRIPTION } from "@/lib/seo/site";

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

    expect(getSiteUrl()).toBe("https://www.steamx.cc");
    expect(getMetadataBase().toString()).toBe("https://www.steamx.cc/");
    expect(buildAbsoluteUrl("/nature/birds")).toBe("https://www.steamx.cc/nature/birds");
  });

  it("normalizes official host variants outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://steamx.cc/unexpected/path");

    expect(getSiteUrl()).toBe("https://www.steamx.cc");
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
  it("uses the approved children STEAM community blurb", () => {
    expect(HOME_PAGE_TITLE).toBe("少儿STEAM社区 · 项目式学习与科创");
    expect(SITE_DESCRIPTION).toBe(
      "STEAMX（史迪姆）是少儿STEAM社区，做项目式学习和科创。上积木课、做自然观察和鸟类观察，把真实项目做成作品。",
    );
    expect(SITE_DESCRIPTION.toLowerCase()).not.toContain("steam教育");
  });
});
