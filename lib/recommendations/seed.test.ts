/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildRecommendationShuffleSeed,
  sortByRecommendationShuffleSeed,
} from "@/lib/recommendations/seed";

describe("sortByRecommendationShuffleSeed", () => {
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    title: `item-${index + 1}`,
  }));

  it("is stable for the same seed", () => {
    const seed = buildRecommendationShuffleSeed("user-1", 0, "2026-05-21");
    const first = sortByRecommendationShuffleSeed(items, seed, (item) => item.id);
    const second = sortByRecommendationShuffleSeed(items, seed, (item) => item.id);

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(new Set(first.map((item) => item.id)).size).toBe(items.length);
  });

  it("changes order when batch or date changes", () => {
    const base = buildRecommendationShuffleSeed("user-1", 0, "2026-05-21");
    const nextBatch = buildRecommendationShuffleSeed("user-1", 1, "2026-05-21");
    const nextDay = buildRecommendationShuffleSeed("user-1", 0, "2026-05-22");

    const baseOrder = sortByRecommendationShuffleSeed(items, base, (item) => item.id).map((item) => item.id);
    const batchOrder = sortByRecommendationShuffleSeed(items, nextBatch, (item) => item.id).map((item) => item.id);
    const dayOrder = sortByRecommendationShuffleSeed(items, nextDay, (item) => item.id).map((item) => item.id);

    expect(batchOrder.join(",")).not.toBe(baseOrder.join(","));
    expect(dayOrder.join(",")).not.toBe(baseOrder.join(","));
  });
});
