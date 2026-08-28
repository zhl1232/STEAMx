import { afterEach, describe, expect, it } from "vitest";

import { buildLlmsTxt } from "@/lib/seo/llms-txt";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("buildLlmsTxt", () => {
  it("describes the public site and keeps the production sitemap", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.steamx.cc";

    const text = buildLlmsTxt();

    expect(text).toContain("# STEAMX · 史迪姆");
    expect(text).toContain("STEAMX（史迪姆）给孩子做少儿编程、积木课和自然观察");
    expect(text).toContain("STEAMX is a Chinese children's platform for coding, brick building, and nature observation. Kids build with their hands, go observe, and turn projects into works.");
    expect(text).toContain("https://www.steamx.cc/explore");
    expect(text).toContain("https://www.steamx.cc/sitemap.xml");
    expect(text).toContain("/api/");
    expect(text).toContain("/admin/");
    expect(text).toContain("/login");
  });
});
