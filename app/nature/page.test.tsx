import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/features/bird-observation/nature-home-map-pair", () => ({
  NatureHomeMapPair: () => <div data-testid="nature-home-map-pair" />,
}));
vi.mock("@/components/layout/mobile-global-header", () => ({ MobileGlobalHeader: () => <div data-testid="mobile-header" /> }));
vi.mock("@/components/seo/json-ld", () => ({ JsonLd: () => null }));
vi.mock("@/lib/seo/json-ld", () => ({ buildBreadcrumbJsonLd: vi.fn(() => ({})) }));
vi.mock("@/lib/seo/metadata", () => ({
  buildPageMetadata: vi.fn((metadata: Record<string, unknown>) => metadata),
}));
vi.mock("@/lib/utils/asset-url", () => ({
  getAssetDisplayUrl: (value: string) => value,
  rewriteAssetUrl: (value: string) => value,
  shouldBypassAssetImageOptimization: () => true,
}));
vi.mock("@/lib/api/nature-observation-data", () => ({ getBirdObservationHomepageData: vi.fn() }));
vi.mock("@/lib/api/nature-observation-atlas", () => ({ getSpeciesAtlasProgress: vi.fn() }));

import NaturePage, { metadata } from "./page";
import { getSpeciesAtlasProgress } from "@/lib/api/nature-observation-atlas";
import { getBirdObservationHomepageData } from "@/lib/api/nature-observation-data";
import type { BirdHomepageData } from "@/lib/api/nature-observation-data";
import type { ObservationEvent } from "@/lib/mappers/types";

function observation(id: number, name: string, location = "湿地公园"): ObservationEvent {
  return {
    id,
    userId: `user-${id}`,
    authorDisplayName: `观察者${id}`,
    observedAt: "2026-09-21T10:00:00Z",
    createdAt: "2026-09-21T10:00:00Z",
    locationName: location,
    latitude: 39.9,
    longitude: 116.4,
    mediaUrls: ["/observation.webp"],
    isPublic: true,
    status: "approved",
    identificationStatus: "community_confirmed",
    likesCount: 0,
    commentsCount: 0,
    species: [{ speciesId: id, commonName: name, behaviorTags: [] }],
  };
}

function homepage(overrides: Partial<BirdHomepageData> = {}): BirdHomepageData {
  return {
    featuredSpecies: [],
    recentObservations: [observation(1, "白鹭")],
    mapObservations: [observation(1, "白鹭")],
    stats: {
      observationCount: 12,
      speciesCount: 34,
      observerCount: 56,
      weeklyObservationCount: 7,
      identifiedRecordCount: 999,
      hotspotLocationCount: 8,
    },
    topicSummaries: [
      { key: "birds", observationCount: 4, speciesCount: 10 },
      { key: "insects", observationCount: 3, speciesCount: 11 },
      { key: "plants", observationCount: 5, speciesCount: 13 },
      { key: "fungi", observationCount: 9, speciesCount: 99 } as BirdHomepageData["topicSummaries"][number],
    ],
    hotspots: [{ locationName: "湿地公园", observationCount: 6, latestObservedAt: "2026-09-21T10:00:00Z" }],
    galleryImages: [],
    ...overrides,
  };
}

const anonymousAtlas: Awaited<ReturnType<typeof getSpeciesAtlasProgress>> = {
  viewer: { authenticated: false, progressState: "anonymous" as const },
  total: 34,
  observedCount: null,
  groups: [
    { key: "birds", label: "鸟类", total: 10, observedCount: null },
    { key: "insects", label: "昆虫", total: 11, observedCount: null },
    { key: "plants", label: "植物", total: 13, observedCount: null },
  ],
};

async function renderPage() {
  return renderToString(await NaturePage());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBirdObservationHomepageData).mockResolvedValue(homepage());
  vi.mocked(getSpeciesAtlasProgress).mockResolvedValue(anonymousAtlas);
});

describe("nature homepage behavior", () => {
  it("renders only bird, insect, and plant topics and excludes fungi from metadata", async () => {
    const html = await renderPage();

    expect(html).toContain("鸟类");
    expect(html).toContain("昆虫");
    expect(html).toContain("植物");
    expect(html).not.toContain("真菌");
    expect(metadata).toMatchObject({ title: "自然观察" });
    expect(String(metadata.description)).not.toContain("真菌");
  });

  it("shows atlas totals anonymously, personal progress when ready, and no fake zero when unavailable", async () => {
    const anonymous = await renderPage();
    expect(anonymous).toContain("图鉴 10 种");
    expect(anonymous).not.toContain("已观察 0 / 10");

    vi.mocked(getSpeciesAtlasProgress).mockResolvedValue({
      ...anonymousAtlas,
      viewer: { authenticated: true, progressState: "ready" },
      groups: anonymousAtlas.groups.map((group, index) => ({ ...group, observedCount: index + 1 })),
    });
    const ready = await renderPage();
    expect(ready).toContain("已观察 1 / 10");
    expect(ready).toContain("已观察 2 / 11");

    vi.mocked(getSpeciesAtlasProgress).mockResolvedValue({
      ...anonymousAtlas,
      viewer: { authenticated: true, progressState: "unavailable" },
    });
    const unavailable = await renderPage();
    expect(unavailable).not.toContain("已观察 0 / 10");
    expect(unavailable).toContain("图鉴 10 种");
  });

  it("uses observerCount for participation and keeps overview latest record aligned with recent first item", async () => {
    const latest = observation(42, "最新记录", "最新地点");
    vi.mocked(getBirdObservationHomepageData).mockResolvedValue(
      homepage({ recentObservations: [latest, observation(43, "更早记录")] }),
    );

    const html = await renderPage();
    expect(html).toContain("参与人数");
    expect(html).toContain(">56<");
    expect(html).not.toContain(">999<");
    expect(html).toContain("最新地点");
    expect(html).toContain("/nature/observations/42");
    expect(html).toContain("近 7 天发布");
  });

  it("keeps publish and topic entry links free of from= tracking params", async () => {
    const html = await renderPage();
    expect(html).toContain('href="/nature/submit"');
    expect(html).not.toMatch(/href="[^"]*[?&](?:amp;)?from=/);
    expect(html).toContain('href="/nature/birds"');
    expect(html).toContain('href="/nature/insects"');
    expect(html).toContain('href="/nature/plants"');
  });
});
