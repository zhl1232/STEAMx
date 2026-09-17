import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomepageCanonicalTags } from "@/components/seo/homepage-canonical";
import { buildAbsoluteUrl } from "@/lib/seo/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("HomepageCanonicalTags", () => {
  it("emits slash-terminated canonical and og:url", () => {
    vi.stubEnv("NODE_ENV", "production");

    const html = renderToStaticMarkup(<HomepageCanonicalTags />);
    const href = buildAbsoluteUrl("/");

    expect(href).toBe("https://steam.bj.cn/");
    expect(html).toContain(`rel="canonical"`);
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain(`property="og:url"`);
    expect(html).toContain(`content="${href}"`);
    expect(html).not.toMatch(/href="https:\/\/steam\.bj\.cn"/);
    expect(html).not.toMatch(/content="https:\/\/steam\.bj\.cn"/);
  });
});
