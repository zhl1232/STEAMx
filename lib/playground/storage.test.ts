import { beforeEach, describe, expect, it } from "vitest"
import {
  clearPlaygroundLocalStorage,
  clearPlaygroundMemoryStore,
  collectAllStats,
  getPlaygroundItem,
  mergeCloudWithLocal,
  peekLegacyLocalPlaygroundStats,
  setPlaygroundItem,
} from "@/lib/playground/storage"

describe("playground storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearPlaygroundMemoryStore()
  })

  it("stores stats in memory instead of localStorage", () => {
    setPlaygroundItem("gomoku_records", { totalGames: 3, wins: 2 })

    expect(getPlaygroundItem("gomoku_records")).toEqual({ totalGames: 3, wins: 2 })
    expect(window.localStorage.getItem("gomoku_records")).toBeNull()
  })

  it("collectAllStats reads from memory and ignores invalid legacy local values", () => {
    window.localStorage.setItem("game_24_stats", JSON.stringify(24))
    setPlaygroundItem("gomoku_records", { totalGames: 3, wins: 2 })

    expect(collectAllStats()).toEqual({
      gomoku_records: { totalGames: 3, wins: 2 },
    })
    expect(peekLegacyLocalPlaygroundStats()).toEqual({})
  })

  it("merges cloud with legacy localStorage into memory and clears localStorage", () => {
    window.localStorage.setItem(
      "gomoku_records",
      JSON.stringify({ totalGames: 2, wins: 1 }),
    )

    const merged = mergeCloudWithLocal({
      game_24_stats: 24,
      gomoku_records: { totalGames: 5, wins: 3 },
    })

    expect(merged).toEqual({
      gomoku_records: { totalGames: 5, wins: 3 },
    })
    expect(getPlaygroundItem("gomoku_records")).toEqual({ totalGames: 5, wins: 3 })
    expect(window.localStorage.getItem("gomoku_records")).toBeNull()
    expect(window.localStorage.getItem("game_24_stats")).toBeNull()
  })

  it("clearPlaygroundLocalStorage removes registered keys", () => {
    window.localStorage.setItem("sudoku_stats", JSON.stringify({ totalGames: 1 }))
    clearPlaygroundLocalStorage()
    expect(window.localStorage.getItem("sudoku_stats")).toBeNull()
  })

  it("keeps the lower shot record when function wars stats are merged", () => {
    window.localStorage.setItem(
      "function_wars_stats",
      JSON.stringify({ bestShots: { "grassland-1": 4, "canyon-1": 5 } }),
    )

    const merged = mergeCloudWithLocal({
      function_wars_stats: { bestShots: { "grassland-1": 6, "space-1": 3 } },
    })

    expect(merged.function_wars_stats).toEqual({
      bestShots: { "grassland-1": 4, "canyon-1": 5, "space-1": 3 },
    })
  })
})
