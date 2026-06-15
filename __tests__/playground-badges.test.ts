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

  test("prefers structured minesweeper wins while keeping legacy best time fallback", () => {
    const stats = buildPlaygroundUserStats({
      minesweeper_best_times: { beginner: 45 },
      minesweeper_stats: {
        totalGames: 12,
        wins: 7,
        winsByDifficulty: { beginner: 4, expert: 3 },
        bestTimes: { expert: 120 },
      },
    })

    expect(stats.minesweeperWins).toBe(7)
    expect(stats.minesweeperExpertWins).toBe(3)
    expect(stats.minesweeperBestTime).toBe(45)
    expect(stats.playgroundGamesPlayed).toBe(1)
    expect(stats.playgroundWinsTotal).toBe(7)
  })

  test("does not treat a missing expert best time as an expert win", () => {
    const stats = buildPlaygroundUserStats({
      minesweeper_stats: {
        totalGames: 2,
        wins: 2,
        winsByDifficulty: { beginner: 2 },
        bestTimes: { beginner: 20 },
      },
    })

    expect(stats.minesweeperExpertWins).toBe(0)
    expect(stats.minesweeperBestTime).toBe(20)
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
