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
      tangram_stats: {
        solvedLevels: ["classic-square", "mountain", "slide", "mushroom"],
      },
      function_wars_stats: {
        totalGames: 12,
        solvedLevels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        onlineGames: 3,
        onlineWins: 2,
      },
    })

    expect(stats.minesweeperWins).toBe(2)
    expect(stats.minesweeperExpertWins).toBe(1)
    expect(stats.minesweeperBestTime).toBe(45)
    expect(stats.hanoiWins).toBe(2)
    expect(stats.hanoiPerfect).toBe(1)
    expect(stats.hanoiMaxDisksCleared).toBe(8)
    expect(stats.tangramSolved).toBe(4)
    expect(stats.functionWarsSolved).toBe(10)
    expect(stats.functionWarsChallengeSolved).toBe(0)
    expect(stats.functionWarsOnlineWins).toBe(2)
    expect(stats.playgroundGamesPlayed).toBe(4)
    expect(stats.playgroundWinsTotal).toBe(20)
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
      hanoi_stats: {
        wins: 1,
        bestMoves: { 3: 7 },
      },
      tangram_stats: {
        solvedLevels: ["classic-square", "mountain", "slide", "mushroom"],
      },
      function_wars_stats: {
        solvedLevels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
      },
    })

    expect(unlocked).toEqual(
      expect.arrayContaining([
        "minesweeper_speedster",
        "tangram_all",
        "function_wars_all",
        "playground_explorer_bronze",
        "playground_victories_bronze",
      ]),
    )
    expect(unlocked).not.toEqual(expect.arrayContaining(["sorting_first_run", "tangram_first"]))
  })

  test("counts challenge ids separately and unlocks the commander badge", () => {
    const solvedLevels = [
      "grass-01", "grass-02", "grass-03", "canyon-04", "canyon-05",
      "canyon-06", "canyon-07", "space-08", "space-09", "space-10",
      "challenge-11", "challenge-12", "challenge-13", "challenge-14", "challenge-15",
    ]

    const stats = buildPlaygroundUserStats({ function_wars_stats: { solvedLevels } })
    const unlocked = getUnlockedPlaygroundBadgeIds({ function_wars_stats: { solvedLevels } })

    expect(stats.functionWarsSolved).toBe(10)
    expect(stats.functionWarsChallengeSolved).toBe(5)
    expect(unlocked).toEqual(expect.arrayContaining(["function_wars_all", "function_wars_challenge_all"]))
  })
})
