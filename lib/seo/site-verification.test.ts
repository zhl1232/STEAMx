import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HARDCODED_SITE_VERIFICATION_OTHER,
  buildSiteVerificationMetadata,
} from "@/lib/seo/site-verification";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildSiteVerificationMetadata", () => {
  it("keeps hardcoded shenma/bytedance tokens without requiring env", () => {
    vi.stubEnv("BING_SITE_VERIFICATION", " ");
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", "");
    vi.stubEnv("BAIDU_SITE_VERIFICATION", "   ");

    expect(buildSiteVerificationMetadata()).toEqual({
      other: { ...HARDCODED_SITE_VERIFICATION_OTHER },
    });
  });

  it("wires optional Google, Baidu and Bing verification tokens from env", () => {
    vi.stubEnv("GOOGLE_SITE_VERIFICATION", " google-token ");
    vi.stubEnv("BAIDU_SITE_VERIFICATION", "baidu-token");
    vi.stubEnv("BING_SITE_VERIFICATION", " bing-token ");

    expect(buildSiteVerificationMetadata()).toEqual({
      google: "google-token",
      other: {
        ...HARDCODED_SITE_VERIFICATION_OTHER,
        "baidu-site-verification": "baidu-token",
        "msvalidate.01": "bing-token",
      },
    });
  });
});
