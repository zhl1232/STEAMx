import { beforeEach, describe, expect, it } from "vitest"

import {
  MINESWEEPER_BEST_TIMES_KEY,
  MINESWEEPER_STATS_KEY,
  readMergedMinesweeperStats,
} from "@/lib/playground/minesweeper-stats"

describe("readMergedMinesweeperStats", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("returns legacy best-time records when structured stats are missing", () => {
    window.localStorage.setItem(
      MINESWEEPER_BEST_TIMES_KEY,
      JSON.stringify({ beginner: 45, expert: 120 }),
    )

    expect(readMergedMinesweeperStats()).toMatchObject({
      totalGames: 2,
      wins: 2,
      winsByDifficulty: { beginner: 1, expert: 1 },
      bestTimes: { beginner: 45, expert: 120 },
    })
  })

  it("merges structured stats with legacy best-time records", () => {
    window.localStorage.setItem(
      MINESWEEPER_STATS_KEY,
      JSON.stringify({
        totalGames: 5,
        wins: 3,
        winsByDifficulty: { beginner: 2 },
        bestTimes: { beginner: 60 },
      }),
    )
    window.localStorage.setItem(
      MINESWEEPER_BEST_TIMES_KEY,
      JSON.stringify({ expert: 120 }),
    )

    expect(readMergedMinesweeperStats()).toMatchObject({
      totalGames: 5,
      wins: 3,
      winsByDifficulty: { beginner: 2, expert: 1 },
      bestTimes: { beginner: 60, expert: 120 },
    })
  })
})
