import { afterEach, describe, expect, it, vi } from "vitest";

import { buildAbsoluteUrl, getMetadataBase, getSiteUrl } from "@/lib/seo/site";

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
