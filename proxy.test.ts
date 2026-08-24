import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { REC_VIEWER_COOKIE } from "@/lib/recommendations/viewer";

function makeRequest(url: string, host: string, cookie?: string) {
  return new NextRequest(url, {
    headers: { host, ...(cookie ? { cookie } : {}) },
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

  it("only creates recommendation identity on routes that consume it", () => {
    const ordinaryPage = proxy(makeRequest("https://www.steamx.cc/about", "www.steamx.cc"));
    const projectDetailApi = proxy(makeRequest("https://www.steamx.cc/api/projects/12", "www.steamx.cc"));
    const explore = proxy(makeRequest("https://www.steamx.cc/explore", "www.steamx.cc"));
    const projectsApi = proxy(makeRequest("https://www.steamx.cc/api/projects", "www.steamx.cc"));
    const homeRecommendations = proxy(makeRequest(
      "https://www.steamx.cc/api/home/recommendations",
      "www.steamx.cc",
    ));
    const exploreRecommendations = proxy(makeRequest(
      "https://www.steamx.cc/api/explore/recommendations",
      "www.steamx.cc",
    ));

    expect(ordinaryPage.cookies.get(REC_VIEWER_COOKIE)).toBeUndefined();
    expect(projectDetailApi.cookies.get(REC_VIEWER_COOKIE)).toBeUndefined();
    expect(explore.cookies.get(REC_VIEWER_COOKIE)?.value).toBeTruthy();
    expect(projectsApi.cookies.get(REC_VIEWER_COOKIE)?.value).toBeTruthy();
    expect(homeRecommendations.cookies.get(REC_VIEWER_COOKIE)?.value).toBeTruthy();
    expect(exploreRecommendations.cookies.get(REC_VIEWER_COOKIE)?.value).toBeTruthy();
  });

  it("does not rewrite an existing recommendation cookie", () => {
    const response = proxy(makeRequest(
      "https://www.steamx.cc/explore",
      "www.steamx.cc",
      `${REC_VIEWER_COOKIE}=existing-viewer`,
    ));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
