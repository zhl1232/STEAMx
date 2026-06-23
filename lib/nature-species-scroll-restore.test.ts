import { beforeEach, describe, expect, it } from "vitest";

import {
  buildNatureSpeciesFiltersKey,
  clearNatureSpeciesScrollRestore,
  getNatureSpeciesNextPageForAnchor,
  readNatureSpeciesScrollRestore,
  saveNatureSpeciesScrollRestore,
} from "./nature-species-scroll-restore";

describe("nature-species-scroll-restore", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("builds a stable filters key without pagination or from params", () => {
    const params = new URLSearchParams("q=银杏&topic=plants&status=all&page=3&from=/nature/species");

    expect(buildNatureSpeciesFiltersKey(params)).toBe("q=%E9%93%B6%E6%9D%8F&topic=plants");
  });

  it("calculates the next page needed to include the clicked card", () => {
    expect(getNatureSpeciesNextPageForAnchor(0, 12)).toBe(1);
    expect(getNatureSpeciesNextPageForAnchor(11, 12)).toBe(1);
    expect(getNatureSpeciesNextPageForAnchor(12, 12)).toBe(2);
    expect(getNatureSpeciesNextPageForAnchor(24, 12)).toBe(3);
    expect(getNatureSpeciesNextPageForAnchor(undefined, 12)).toBe(1);
  });

  it("round-trips scroll restore state", () => {
    saveNatureSpeciesScrollRestore({
      filtersKey: "topic=plants&status=unobserved",
      scrollY: 1840,
      nextPage: 4,
      anchorSlug: "ginkgo-biloba",
      anchorTop: 220,
      anchorIndex: 28,
    });

    expect(readNatureSpeciesScrollRestore()).toEqual({
      filtersKey: "topic=plants&status=unobserved",
      scrollY: 1840,
      nextPage: 4,
      anchorSlug: "ginkgo-biloba",
      anchorTop: 220,
      anchorIndex: 28,
    });

    clearNatureSpeciesScrollRestore();
    expect(readNatureSpeciesScrollRestore()).toBeNull();
  });
});
