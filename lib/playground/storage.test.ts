import { beforeEach, describe, expect, it } from "vitest"
import {
  collectAllStats,
  getPlaygroundItem,
  mergeCloudWithLocal,
  setPlaygroundItem,
} from "@/lib/playground/storage"

describe("playground storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("clears corrupted local payloads instead of keeping dirty data", () => {
    window.localStorage.setItem("gomoku_records", "{broken")

    expect(getPlaygroundItem("gomoku_records")).toBeNull()
    expect(window.localStorage.getItem("gomoku_records")).toBeNull()
  })

  it("collectAllStats omits invalid top-level values", () => {
    window.localStorage.setItem("game_24_stats", JSON.stringify(24))
    setPlaygroundItem("gomoku_records", { totalGames: 3, wins: 2 })

    expect(collectAllStats()).toEqual({
      gomoku_records: { totalGames: 3, wins: 2 },
    })
    expect(window.localStorage.getItem("game_24_stats")).toBeNull()
  })

  it("drops invalid cloud payloads during merge", () => {
    const merged = mergeCloudWithLocal({
      game_24_stats: 24,
      gomoku_records: { totalGames: 5, wins: 3 },
    })

    expect(merged).toEqual({
      gomoku_records: { totalGames: 5, wins: 3 },
    })
    expect(window.localStorage.getItem("game_24_stats")).toBeNull()
    expect(window.localStorage.getItem("gomoku_records")).toBe(
      JSON.stringify({ totalGames: 5, wins: 3 }),
    )
  })
})
