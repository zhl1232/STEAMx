import { afterEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("robots", () => {
  it("allows Baiduspider, Bytespider, YisouSpider and GPTBot on public pages", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";

    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const gptBotRule = rules.find((rule) => {
      const userAgent = rule?.userAgent;
      return Array.isArray(userAgent) ? userAgent.includes("GPTBot") : userAgent === "GPTBot";
    });
    const baiduRule = rules.find((rule) => rule?.userAgent === "Baiduspider");
    const cnIndexRule = rules.find((rule) => {
      const userAgent = rule?.userAgent;
      return Array.isArray(userAgent) ? userAgent.includes("Bytespider") : userAgent === "Bytespider";
    });

    expect(baiduRule?.allow).toBe("/");
    expect(cnIndexRule?.allow).toBe("/");
    expect(Array.isArray(cnIndexRule?.userAgent) ? cnIndexRule.userAgent : [cnIndexRule?.userAgent]).toEqual(
      expect.arrayContaining(["Bytespider", "YisouSpider"]),
    );
    expect(baiduRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/admin/", "/login"]));
    expect(gptBotRule?.allow).toBe("/");
    expect(gptBotRule?.disallow).toEqual(expect.arrayContaining(["/api/", "/admin/", "/login"]));
    expect(gptBotRule?.disallow).not.toContain("/");
    expect(result.sitemap).toBe("https://www.steamx.cc/sitemap.xml");
  });
});
