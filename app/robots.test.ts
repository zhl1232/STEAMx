import { afterEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("robots", () => {
  it("allows Baiduspider, Googlebot, Bytespider, YisouSpider and GPTBot on public pages", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://steam.bj.cn";

    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const gptBotRule = rules.find((rule) => {
      const userAgent = rule?.userAgent;
      return Array.isArray(userAgent) ? userAgent.includes("GPTBot") : userAgent === "GPTBot";
    });
    const baiduRule = rules.find((rule) => rule?.userAgent === "Baiduspider");
    const googleRule = rules.find((rule) => rule?.userAgent === "Googlebot");
    const cnIndexRule = rules.find((rule) => {
      const userAgent = rule?.userAgent;
      return Array.isArray(userAgent) ? userAgent.includes("Bytespider") : userAgent === "Bytespider";
    });

    expect(baiduRule?.allow).toEqual(expect.arrayContaining(["/", "/api/assets/*.webp$", "/api/assets/*.webp?*"]));
    expect(googleRule?.allow).toEqual(expect.arrayContaining(["/", "/api/assets/*.webp$", "/api/assets/*.webp?*"]));
    expect(googleRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/admin/", "/login"]));
    expect(cnIndexRule?.allow).toEqual(expect.arrayContaining(["/", "/api/assets/*.webp$", "/api/assets/*.webp?*"]));
    expect(Array.isArray(cnIndexRule?.userAgent) ? cnIndexRule.userAgent : [cnIndexRule?.userAgent]).toEqual(
      expect.arrayContaining(["Bytespider", "YisouSpider"]),
    );
    expect(baiduRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/admin/", "/login"]));
    expect(gptBotRule?.allow).toEqual(expect.arrayContaining(["/", "/api/assets/*.webp$", "/api/assets/*.webp?*"]));
    expect(gptBotRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/admin/", "/login"]));
    expect(gptBotRule?.disallow).not.toContain("/");
    expect(result.sitemap).toBe("https://steam.bj.cn/sitemap.xml");
  });
});


it("allows public image variants while keeping data endpoints and video assets blocked", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  // Robots matching uses the most specific matching rule, not the first rule.
  const matches = (pattern: string, path: string) => {
    const escaped = pattern.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}`).test(path);
  };
  for (const rule of rules) {
    const allow = [rule.allow ?? []].flat();
    const disallow = [rule.disallow ?? []].flat();
    const allowed = (path: string) => {
      const allowLength = Math.max(0, ...allow.filter((pattern) => matches(pattern, path)).map((pattern) => pattern.length));
      const disallowLength = Math.max(0, ...disallow.filter((pattern) => matches(pattern, path)).map((pattern) => pattern.length));
      return allowLength >= disallowLength;
    };
    expect(allowed("/api/assets/projects/cover.webp")).toBe(true);
    expect(allowed("/api/assets/courses/cover.png?v=2")).toBe(true);
    expect(allowed("/api/projects")).toBe(false);
    expect(allowed("/api/assets/courses/lesson.mp4?exp=123&sig=abc")).toBe(false);
    expect(allowed("/api/assets/courses/lesson.pdf")).toBe(false);
    expect(allowed("/api/assets/courses/model.mpd")).toBe(false);
    expect(allowed("/api/assets/projects/cover.webp/private")).toBe(false);
  }
});
