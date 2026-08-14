import { describe, expect, it } from "vitest";

import { buildApexToWwwRedirectUrl, getRequestHostname } from "@/lib/seo/canonical-host";

describe("getRequestHostname", () => {
  it("strips port and lowercases the host", () => {
    expect(getRequestHostname("SteamX.cc:443")).toBe("steamx.cc");
  });

  it("keeps IPv6 literals without the port", () => {
    expect(getRequestHostname("[::1]:3000")).toBe("::1");
  });
});

describe("buildApexToWwwRedirectUrl", () => {
  it("permanently maps only steamx.cc to the matching www path and query", () => {
    expect(
      buildApexToWwwRedirectUrl({
        host: "steamx.cc",
        pathname: "/explore",
        search: "?q=bird&sortBy=latest",
      }),
    ).toBe("https://www.steamx.cc/explore?q=bird&sortBy=latest");
  });

  it("does not rewrite www, localhost, preview, tunnel, or a future second domain", () => {
    const ignoredHosts = [
      "www.steamx.cc",
      "localhost:3000",
      "127.0.0.1:3000",
      "steamx-preview.vercel.app",
      "random-name.trycloudflare.com",
      "future-second-domain.example",
    ];

    for (const host of ignoredHosts) {
      expect(
        buildApexToWwwRedirectUrl({
          host,
          pathname: "/explore",
          search: "?q=1",
        }),
      ).toBeNull();
    }
  });
});
