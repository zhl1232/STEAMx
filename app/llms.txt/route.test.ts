import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/llms.txt/route";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("GET /llms.txt", () => {
  it("returns plain text for crawlers", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://steam.bj.cn";

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/plain/);
    await expect(response.text()).resolves.toContain("https://steam.bj.cn/sitemap.xml");
  });
});
