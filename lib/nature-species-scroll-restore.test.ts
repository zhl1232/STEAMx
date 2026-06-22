import { beforeEach, describe, expect, it } from "vitest"

import {
  buildNatureSpeciesFiltersKey,
  clearNatureSpeciesScrollRestore,
  readNatureSpeciesScrollRestore,
  saveNatureSpeciesScrollRestore,
} from "./nature-species-scroll-restore"

describe("nature-species-scroll-restore", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("builds a stable filters key without pagination params", () => {
    const params = new URLSearchParams("q=蝶&topic=insects&page=2&from=/nature/species&status=observed")
    expect(buildNatureSpeciesFiltersKey(params)).toBe("q=%E8%9D%B6&topic=insects&status=observed")
  })

  it("round-trips scroll restore state", () => {
    saveNatureSpeciesScrollRestore({
      filtersKey: "topic=insects",
      scrollY: 960,
      nextPage: 3,
    })

    expect(readNatureSpeciesScrollRestore()).toEqual({
      filtersKey: "topic=insects",
      scrollY: 960,
      nextPage: 3,
    })

    clearNatureSpeciesScrollRestore()
    expect(readNatureSpeciesScrollRestore()).toBeNull()
  })
})
