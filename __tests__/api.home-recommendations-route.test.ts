/** @vitest-environment node */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { GET } from "@/app/api/home/recommendations/route";
import { getHomepageRecommendations } from "@/lib/home/recommendations";

vi.mock("@/lib/home/recommendations", () => ({
  getHomepageRecommendations: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("GET /api/home/recommendations", () => {
  const getHomepageRecommendationsMock = getHomepageRecommendations as Mock<typeof getHomepageRecommendations>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses limit, offset, mode, and exclude ids", async () => {
    getHomepageRecommendationsMock.mockResolvedValue({
      projects: [],
      nextOffset: 12,
      hasMore: true,
      mode: "popular-fallback",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/home/recommendations?limit=6&offset=8&mode=popular-fallback&excludeIds=1,2,abc") as never,
    );

    expect(getHomepageRecommendationsMock).toHaveBeenCalledWith({
      limit: 6,
      offset: 8,
      mode: "popular-fallback",
      excludeIds: [1, 2, "abc"],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      projects: [],
      nextOffset: 12,
      hasMore: true,
      mode: "popular-fallback",
    });
  });

  it("returns a 500 when recommendation loading fails", async () => {
    getHomepageRecommendationsMock.mockRejectedValue(new Error("boom"));

    const response = await GET(new NextRequest("http://localhost/api/home/recommendations") as never);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch homepage recommendations",
    });
  });
});
