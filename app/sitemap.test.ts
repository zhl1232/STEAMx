import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: () => Promise<unknown>) => fn }));
vi.mock("@/lib/supabase/server", () => ({ createPublicClient: vi.fn() }));
vi.mock("@/lib/content-classification", () => ({ getContentClassificationSettings: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/courses/ldraw-bom-source", () => ({ hasLdrawModelFile: vi.fn() }));

import sitemap, { buildSitemapEntries, STATIC_SITEMAP_ROUTES } from "@/app/sitemap";
import { createPublicClient } from "@/lib/supabase/server";
import { getContentClassificationSettings } from "@/lib/content-classification";
import { PLAYGROUND_METADATA_PATHS } from "@/lib/seo/playground-metadata";

describe("sitemap route coverage", () => {
  it("includes canonical public hubs and every playground detail page", () => {
    const staticPaths = STATIC_SITEMAP_ROUTES.map((route) => route.path);

    expect(staticPaths).toEqual(expect.arrayContaining([
      "/about",
      "/learn/blocks",
      "/learn/scratch",
      "/learn/science",
      "/nature/birds",
      "/nature/insects",
      "/nature/plants",
    ]));
    expect(staticPaths).toEqual(expect.arrayContaining(PLAYGROUND_METADATA_PATHS));
  });

  it("maps all supported public content types and only emits available parts pages", () => {
    const urls = buildSitemapEntries({
      projects: [{ id: 1, updated_at: "2026-01-01T00:00:00Z" }],
      species: [{ slug: "passer-montanus", nature_topic: "birds", updated_at: "2026-01-02T00:00:00Z" }],
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

  it("excludes fungi and legacy unclassified species from public detail URLs", () => {
    const urls = buildSitemapEntries({
      projects: [],
      species: [
        { slug: "bird", nature_topic: "birds", updated_at: null },
        { slug: "fungus", nature_topic: "fungi", updated_at: null },
        { slug: "legacy", nature_topic: null, updated_at: null },
      ],
      observations: [], courses: [], lessons: [], works: [], resources: [], challenges: [],
    }).map((entry) => new URL(entry.url).pathname)

    expect(urls).toContain("/nature/species/bird")
    expect(urls).not.toContain("/nature/species/fungus")
    expect(urls).not.toContain("/nature/species/legacy")
  });

  it("uses the latest valid completion or review timestamp for public works", () => {
    const entries = buildSitemapEntries({
      projects: [], species: [], observations: [], courses: [], lessons: [], resources: [], challenges: [],
      works: [
        { id: 1, completed_at: "2026-01-01T00:00:00Z", reviewed_at: "2026-02-01T00:00:00Z" },
        { id: 2, completed_at: "2026-03-01T00:00:00Z", reviewed_at: "2026-02-01T00:00:00Z" },
        { id: 3, completed_at: "invalid", reviewed_at: "2026-02-01T00:00:00Z" },
        { id: 4, completed_at: "2026-01-01T00:00:00Z", reviewed_at: null },
        { id: 5, completed_at: null, reviewed_at: "invalid" },
      ],
    }).filter(({ url }) => new URL(url).pathname.startsWith("/works/"));

    expect(entries.map(({ lastModified }) => lastModified)).toEqual([
      new Date("2026-02-01T00:00:00Z"), new Date("2026-03-01T00:00:00Z"),
      new Date("2026-02-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"), undefined,
    ]);
  });
});

describe("sitemap generation failures", () => {
  beforeEach(() => {
    vi.mocked(getContentClassificationSettings).mockResolvedValue({ enforcementEnabled: false } as Awaited<ReturnType<typeof getContentClassificationSettings>>);
  });

  function mockDatabase(failingTable?: string) {
    const select = vi.fn();
    const from = vi.fn((table: string) => {
      const query = {
        select: (fields: string) => { select(table, fields); return query; },
        eq: () => query,
        in: () => query,
        order: () => query,
        range: async () => ({ data: [], error: table === failingTable ? new Error("upstream unavailable") : null }),
      };
      return query;
    });
    vi.mocked(createPublicClient).mockReturnValue({ from } as unknown as ReturnType<typeof createPublicClient>);
    return select;
  }

  it("rejects instead of returning a static-only success when any content query fails", async () => {
    mockDatabase("completed_projects");
    await expect(sitemap()).rejects.toThrow("upstream unavailable");
  });

  it("allows a genuinely empty database and requests the review timestamp", async () => {
    const select = mockDatabase();
    await expect(sitemap()).resolves.toEqual(buildSitemapEntries());
    expect(select).toHaveBeenCalledWith("completed_projects", "id, completed_at, reviewed_at, project_id, course_lesson_id");
    expect(select).toHaveBeenCalledWith("species", "slug, nature_topic, updated_at");
  });
});
