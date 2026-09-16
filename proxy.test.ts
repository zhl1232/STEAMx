import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import { REC_VIEWER_COOKIE } from "@/lib/recommendations/viewer";

function makeRequest(url: string, host: string, cookie?: string) {
  return new NextRequest(url, {
    headers: { host, ...(cookie ? { cookie } : {}) },
  });
}

describe("proxy canonical host redirect", () => {
  it("301s legacy steamx hosts to steam.bj.cn with path and query", () => {
    const apex = proxy(makeRequest("https://steamx.cc/explore?q=bird", "steamx.cc"));
    const www = proxy(makeRequest("https://www.steamx.cc/explore?q=bird", "www.steamx.cc"));

    expect(apex.status).toBe(301);
    expect(www.status).toBe(301);
    expect(apex.headers.get("location")).toBe("https://steam.bj.cn/explore?q=bird");
    expect(www.headers.get("location")).toBe("https://steam.bj.cn/explore?q=bird");
  });

  it("does not redirect localhost or the primary host", () => {
    const local = proxy(makeRequest("http://localhost:3000/explore", "localhost:3000"));
    const primary = proxy(makeRequest("https://steam.bj.cn/explore", "steam.bj.cn"));

    expect(local.status).not.toBe(301);
    expect(primary.status).not.toBe(301);
    expect(local.headers.get("location")).toBeNull();
    expect(primary.headers.get("location")).toBeNull();
  });

  it("keeps crawler discovery files free of recommendation cookies", () => {
    const sitemap = proxy(makeRequest("https://steam.bj.cn/sitemap.xml", "steam.bj.cn"));
    const robots = proxy(makeRequest("https://steam.bj.cn/robots.txt", "steam.bj.cn"));

    expect(sitemap.status).toBe(200);
    expect(robots.status).toBe(200);
    expect(sitemap.headers.get("set-cookie")).toBeNull();
    expect(robots.headers.get("set-cookie")).toBeNull();
  });

  it("only creates recommendation identity on routes that consume it", () => {
    const ordinaryPage = proxy(makeRequest("https://steam.bj.cn/about", "steam.bj.cn"));
    const projectDetailApi = proxy(makeRequest("https://steam.bj.cn/api/projects/12", "steam.bj.cn"));
    const explore = proxy(makeRequest("https://steam.bj.cn/explore", "steam.bj.cn"));
    const projectsApi = proxy(makeRequest("https://steam.bj.cn/api/projects", "steam.bj.cn"));
    const homeRecommendations = proxy(makeRequest(
      "https://steam.bj.cn/api/home/recommendations",
      "steam.bj.cn",
    ));
    const exploreRecommendations = proxy(makeRequest(
      "https://steam.bj.cn/api/explore/recommendations",
      "steam.bj.cn",
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
      "https://steam.bj.cn/explore",
      "steam.bj.cn",
      `${REC_VIEWER_COOKIE}=existing-viewer`,
    ));

    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
