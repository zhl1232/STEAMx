import { describe, expect, it } from "vitest";

import { buildSitemapEntries, STATIC_SITEMAP_ROUTES } from "@/app/sitemap";
import { PLAYGROUND_METADATA_PATHS } from "@/lib/seo/playground-metadata";

describe("sitemap route coverage", () => {
  it("includes canonical public hubs and every playground detail page", () => {
    const staticPaths = STATIC_SITEMAP_ROUTES.map((route) => route.path);

    expect(staticPaths).toEqual(expect.arrayContaining([
      "/about",
      "/nature/birds",
      "/nature/insects",
      "/nature/plants",
    ]));
    expect(staticPaths).toEqual(expect.arrayContaining(PLAYGROUND_METADATA_PATHS));
  });

  it("maps all supported public content types and only emits available parts pages", () => {
    const urls = buildSitemapEntries({
      projects: [{ id: 1, updated_at: "2026-01-01T00:00:00Z" }],
      species: [{ slug: "passer-montanus", updated_at: "2026-01-02T00:00:00Z" }],
      observations: [{ id: 2, updated_at: "2026-01-03T00:00:00Z" }],
      courses: [{ id: 3, updated_at: "2026-01-04T00:00:00Z" }],
      lessons: [
        { id: 4, course_id: 3, updated_at: "2026-01-05T00:00:00Z", hasModelFile: true },
        { id: 5, course_id: 3, updated_at: "2026-01-06T00:00:00Z", hasModelFile: false },
      ],
      works: [{ id: 6, completed_at: "2026-01-07T00:00:00Z" }],
      resources: [{ id: 7, updated_at: "2026-01-08T00:00:00Z" }],
      challenges: [{ id: 8, created_at: "2026-01-09T00:00:00Z" }],
    }).map((entry) => new URL(entry.url).pathname);

    expect(urls).toEqual(expect.arrayContaining([
      "/project/1",
      "/nature/species/passer-montanus",
      "/nature/observations/2",
      "/courses/3",
      "/courses/3/lessons/4",
      "/courses/3/lessons/4/parts",
      "/courses/3/lessons/5",
      "/works/6",
      "/resources/7",
      "/pbl/8",
    ]));
    expect(urls).not.toContain("/courses/3/lessons/5/parts");
  });
});
