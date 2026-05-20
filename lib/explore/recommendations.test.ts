/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getHomepageRecommendations = vi.fn();

vi.mock("@/lib/home/recommendations", () => ({
  getHomepageRecommendations: (...args: unknown[]) => getHomepageRecommendations(...args),
}));

describe("getExploreForYouInitialData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public popular recommendations for anonymous users", async () => {
    getHomepageRecommendations.mockResolvedValue({
      projects: [{ id: 10 }],
      nextOffset: 8,
      hasMore: true,
      mode: "popular-fallback",
    });

    const { getExploreForYouInitialData } = await import("./recommendations");
    const result = await getExploreForYouInitialData();

    expect(getHomepageRecommendations).toHaveBeenCalledWith({
      limit: 8,
      offset: 0,
      excludeIds: undefined,
      mode: "popular-fallback",
      blendPopular: true,
    });
    expect(result?.projects).toEqual([{ id: 10 }]);
  });

  it("returns null when there are no public recommendations", async () => {
    getHomepageRecommendations.mockResolvedValue({
      projects: [],
      nextOffset: 0,
      hasMore: false,
      mode: "popular-fallback",
    });

    const { getExploreForYouInitialData } = await import("./recommendations");
    const result = await getExploreForYouInitialData();

    expect(result).toBeNull();
  });

  it("defaults direct recommendation requests to popular fallback", async () => {
    getHomepageRecommendations.mockResolvedValue({
      projects: [{ id: 10 }],
      nextOffset: 8,
      hasMore: true,
      mode: "personalized",
    });

    const { getExploreForYouRecommendations } = await import("./recommendations");
    await getExploreForYouRecommendations();

    expect(getHomepageRecommendations).toHaveBeenCalledWith({
      limit: 8,
      offset: 0,
      excludeIds: undefined,
      mode: "popular-fallback",
      blendPopular: true,
    });
  });
});
