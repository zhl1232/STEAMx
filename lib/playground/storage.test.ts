import { beforeEach, describe, expect, it } from "vitest"
import {
  clearPlaygroundLocalStorage,
  clearPlaygroundMemoryStore,
  collectAllStats,
  getPlaygroundItem,
  mergeGameStats,
  mergeCloudWithLocal,
  peekLegacyLocalPlaygroundStats,
  setPlaygroundItem,
} from "@/lib/playground/storage"

describe("playground storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearPlaygroundMemoryStore()
  })

  it("discards retired stats from local storage and cloud while preserving active games", () => {
    const retiredStats = {
      game_2048_stats: { wins: 8, maxTile: 8192 },
      fifteen_puzzle_stats: { wins: 12 },
      quick_math_stats: { bestScore: 100 },
    }
    for (const [key, value] of Object.entries(retiredStats)) {
      window.localStorage.setItem(key, JSON.stringify(value))
      setPlaygroundItem(key, value)
    }
    window.localStorage.setItem("hanoi_stats", JSON.stringify({ wins: 2 }))

    expect(peekLegacyLocalPlaygroundStats()).toEqual({ hanoi_stats: { wins: 2 } })
    for (const key of Object.keys(retiredStats)) {
      expect(window.localStorage.getItem(key)).toBeNull()
      expect(getPlaygroundItem(key)).toBeNull()
    }
    expect(mergeCloudWithLocal({ ...retiredStats, hanoi_stats: { wins: 3 } })).toEqual({
      hanoi_stats: { wins: 3 },
    })
    expect(collectAllStats()).toEqual({ hanoi_stats: { wins: 3 } })
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

  it.each([
    { localStars: 3, cloudStars: 2, localShots: 2, cloudShots: 1 },
    { localStars: 3, cloudStars: 3, localShots: 1, cloudShots: 2 },
  ])("keeps the complete better run when syncing $localStars stars/$localShots shots against $cloudStars stars/$cloudShots shots", ({ localStars, cloudStars, localShots, cloudShots }) => {
    const localRun = { stars: localStars, shots: localShots, steps: Array.from({ length: localShots }, () => ({ expression: "0.25*x", weaponId: "standard" })) }
    const cloudRun = { stars: cloudStars, shots: cloudShots, steps: Array.from({ length: cloudShots }, () => ({ expression: "0", weaponId: "standard" })) }
    const local = { bestStars: { "grass-02": localStars }, bestSolutions: { "grass-02": localRun } }
    const cloud = { bestStars: { "grass-02": cloudStars }, bestSolutions: { "grass-02": cloudRun } }
    for (const [first, second] of [[local, cloud], [cloud, local]]) {
      expect(mergeGameStats(first, second)).toEqual({ bestStars: { "grass-02": localStars }, bestSolutions: { "grass-02": localRun } })
    }
  })

  it("keeps a valid saved run when the other device has malformed solution steps", () => {
    const run = { stars: 2, shots: 1, steps: [{ expression: "0", weaponId: "standard" }] }
    expect(mergeGameStats({ bestSolutions: { "grass-01": run } }, { bestSolutions: { "grass-01": { stars: 3, shots: 1, steps: [] } } })).toEqual({ bestSolutions: { "grass-01": run } })
  })
})
