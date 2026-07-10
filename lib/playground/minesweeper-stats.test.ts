import { beforeEach, describe, expect, it } from "vitest"

import {
  MINESWEEPER_BEST_TIMES_KEY,
  MINESWEEPER_STATS_KEY,
  readMergedMinesweeperStats,
} from "@/lib/playground/minesweeper-stats"
import {
  clearPlaygroundMemoryStore,
  setPlaygroundItem,
} from "@/lib/playground/storage"

describe("readMergedMinesweeperStats", () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearPlaygroundMemoryStore()
  })

  it("returns legacy best-time records when structured stats are missing", () => {
    setPlaygroundItem(
      MINESWEEPER_BEST_TIMES_KEY,
      { beginner: 45, expert: 120 },
    )

    expect(readMergedMinesweeperStats()).toMatchObject({
      totalGames: 2,
      wins: 2,
      winsByDifficulty: { beginner: 1, expert: 1 },
      bestTimes: { beginner: 45, expert: 120 },
    })
  })

  it("merges structured stats with legacy best-time records", () => {
    setPlaygroundItem(MINESWEEPER_STATS_KEY, {
      totalGames: 5,
      wins: 3,
      winsByDifficulty: { beginner: 2 },
      bestTimes: { beginner: 60 },
    })
    setPlaygroundItem(MINESWEEPER_BEST_TIMES_KEY, { expert: 120 })

    expect(readMergedMinesweeperStats()).toMatchObject({
      totalGames: 5,
      wins: 3,
      winsByDifficulty: { beginner: 2, expert: 1 },
      bestTimes: { beginner: 60, expert: 120 },
    })
  })
})
