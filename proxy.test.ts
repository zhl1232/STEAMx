import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

function makeRequest(url: string, host: string) {
  return new NextRequest(url, {
    headers: { host },
  });
}

describe("proxy apex host redirect", () => {
  it("301s steamx.cc to the matching www path and query", () => {
    const response = proxy(makeRequest("https://steamx.cc/explore?q=bird", "steamx.cc"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://www.steamx.cc/explore?q=bird");
  });

  it("does not redirect localhost or www", () => {
    const local = proxy(makeRequest("http://localhost:3000/explore", "localhost:3000"));
    const www = proxy(makeRequest("https://www.steamx.cc/explore", "www.steamx.cc"));

    expect(local.status).not.toBe(301);
    expect(www.status).not.toBe(301);
    expect(local.headers.get("location")).toBeNull();
    expect(www.headers.get("location")).toBeNull();
  });

  it("keeps crawler discovery files free of recommendation cookies", () => {
    const sitemap = proxy(makeRequest("https://www.steamx.cc/sitemap.xml", "www.steamx.cc"));
    const robots = proxy(makeRequest("https://www.steamx.cc/robots.txt", "www.steamx.cc"));

    expect(sitemap.status).toBe(200);
    expect(robots.status).toBe(200);
    expect(sitemap.headers.get("set-cookie")).toBeNull();
    expect(robots.headers.get("set-cookie")).toBeNull();
  });
});
