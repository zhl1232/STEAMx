import { beforeEach, describe, expect, it } from "vitest";

import {
  buildNatureSpeciesFiltersKey,
  clearNatureSpeciesScrollRestore,
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

  it("round-trips scroll restore state", () => {
    saveNatureSpeciesScrollRestore({
      filtersKey: "topic=plants&status=unobserved",
      scrollY: 1840,
      anchorSlug: "ginkgo-biloba",
      anchorTop: 220,
    });

    expect(readNatureSpeciesScrollRestore()).toEqual({
      filtersKey: "topic=plants&status=unobserved",
      scrollY: 1840,
      anchorSlug: "ginkgo-biloba",
      anchorTop: 220,
    });

    clearNatureSpeciesScrollRestore();
    expect(readNatureSpeciesScrollRestore()).toBeNull();
  });
});
