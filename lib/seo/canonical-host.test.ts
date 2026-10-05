import { describe, expect, it } from "vitest";

import {
  buildCanonicalHostRedirectUrl,
  getRequestHostname,
  PRIMARY_ORIGIN,
  shouldNoIndexSteamxHost,
} from "@/lib/seo/canonical-host";
import { getSiteUrl } from "@/lib/seo/site";

describe("getRequestHostname", () => {
  it("strips port and lowercases the host", () => {
    expect(getRequestHostname("SteamX.cc:443")).toBe("steamx.cc");
  });

  it("keeps IPv6 literals without the port", () => {
    expect(getRequestHostname("[::1]:3000")).toBe("::1");
  });
});

describe("buildCanonicalHostRedirectUrl", () => {
  it("maps legacy steamx hosts and www.bj to steam.bj.cn with path and query", () => {
    expect(
      buildCanonicalHostRedirectUrl({
        host: "steamx.cc",
        pathname: "/explore",
        search: "?q=bird&sortBy=latest",
      }),
    ).toBe("https://steam.bj.cn/explore?q=bird&sortBy=latest");

    expect(
      buildCanonicalHostRedirectUrl({
        host: "www.steamx.cc",
        pathname: "/project/123",
        search: "?share=1",
      }),
    ).toBe("https://steam.bj.cn/project/123?share=1");

    expect(
      buildCanonicalHostRedirectUrl({
        host: "www.steam.bj.cn",
        pathname: "/",
        search: "",
      }),
    ).toBe("https://steam.bj.cn/");
  });

  it("does not rewrite the primary host, localhost, preview, or unrelated domains", () => {
    const ignoredHosts = [
      "steam.bj.cn",
      "localhost:3000",
      "127.0.0.1:3000",
      "steamx-preview.vercel.app",
      "random-name.trycloudflare.com",
      "dev.steamx.cc",
    ];

    for (const host of ignoredHosts) {
      expect(
        buildCanonicalHostRedirectUrl({
          host,
          pathname: "/explore",
          search: "?q=1",
        }),
      ).toBeNull();
    }
  });
});

describe("getSiteUrl", () => {
  it("normalizes configured production hosts to the primary origin", () => {
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "http://steamx.cc";

    try {
      expect(getSiteUrl()).toBe(PRIMARY_ORIGIN);
    } finally {
      if (previousAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      }
    }
  });
});

describe("shouldNoIndexSteamxHost", () => {
  it("matches only steamx.cc and www.steamx.cc", () => {
    expect(shouldNoIndexSteamxHost("steamx.cc")).toBe(true);
    expect(shouldNoIndexSteamxHost("WWW.steamx.cc:443")).toBe(true);
    expect(shouldNoIndexSteamxHost("www.steam.bj.cn")).toBe(false);
    expect(shouldNoIndexSteamxHost("steam.bj.cn")).toBe(false);
    expect(shouldNoIndexSteamxHost("dev.steamx.cc")).toBe(false);
    expect(shouldNoIndexSteamxHost("assets.steamx.cc")).toBe(false);
    expect(shouldNoIndexSteamxHost("localhost:3000")).toBe(false);
  });
});
