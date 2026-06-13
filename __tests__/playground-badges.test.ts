import { describe, expect, test } from "vitest"

import { buildPlaygroundUserStats, getUnlockedPlaygroundBadgeIds } from "@/lib/gamification/playground-badges"

describe("playground badge stats", () => {
  test("builds badge stats from the playground cloud blob", () => {
    const stats = buildPlaygroundUserStats({
      minesweeper_best_times: { beginner: 45, expert: 120 },
      hanoi_stats: {
        wins: 2,
        bestMoves: { 3: 7, 8: 300 },
      },
      sorting_race_stats: {
        totalRuns: 5,
        algorithmsUsed: { bubble: 1, selection: 1, insertion: 1, merge: 1, quick: 1 },
      },
      tangram_stats: {
        solvedLevels: ["classic-square", "mountain", "slide", "mushroom"],
      },
    })

    expect(stats.minesweeperWins).toBe(2)
    expect(stats.minesweeperExpertWins).toBe(1)
    expect(stats.minesweeperBestTime).toBe(45)
    expect(stats.hanoiWins).toBe(2)
    expect(stats.hanoiPerfect).toBe(1)
    expect(stats.hanoiMaxDisksCleared).toBe(8)
    expect(stats.sortingRuns).toBe(5)
    expect(stats.sortingAlgorithmsUsed).toBe(5)
    expect(stats.tangramSolved).toBe(4)
    expect(stats.playgroundGamesPlayed).toBe(4)
    expect(stats.playgroundWinsTotal).toBe(8)
  })

  test("returns unlocked playground badge ids from cloud stats", () => {
    const unlocked = getUnlockedPlaygroundBadgeIds({
      minesweeper_best_times: { beginner: 45, expert: 120 },
      sorting_race_stats: {
        totalRuns: 5,
        algorithmsUsed: { bubble: 1, selection: 1, insertion: 1, merge: 1, quick: 1 },
      },
      tangram_stats: {
        solvedLevels: ["classic-square", "mountain", "slide", "mushroom"],
      },
    })

    expect(unlocked).toEqual(
      expect.arrayContaining([
        "minesweeper_speedster",
        "tangram_all",
        "playground_explorer_bronze",
        "playground_victories_bronze",
      ]),
    )
    expect(unlocked).not.toEqual(expect.arrayContaining(["sorting_first_run", "tangram_first"]))
  })
})
