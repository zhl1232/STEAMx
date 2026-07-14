import { BADGES } from "@/lib/gamification/badges"
import type { UserStats } from "@/lib/gamification/types"
import { supabaseAdmin } from "@/lib/supabase/admin"

export const PLAYGROUND_BADGE_SERIES = new Set(["playground_star", "playground_explorer", "playground_victories"])

const DEFAULT_PLAYGROUND_STATS: UserStats = {
  projectsPublished: 0,
  projectsLiked: 0,
  projectsCompleted: 0,
  commentsCount: 0,
  scienceCompleted: 0,
  techCompleted: 0,
  engineeringCompleted: 0,
  artCompleted: 0,
  mathCompleted: 0,
  likesGiven: 0,
  likesReceived: 0,
  collectionsCount: 0,
  challengesJoined: 0,
  level: 1,
  loginDays: 0,
  consecutiveDays: 0,
  discussionsCreated: 0,
  repliesCount: 0,
  minesweeperWins: 0,
  minesweeperExpertWins: 0,
  minesweeperBestTime: 999,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key]
  return isRecord(value) ? value : {}
}

function getNumber(source: Record<string, unknown>, key: string, fallback = 0): number {
  const value = source[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function getStringArray(source: Record<string, unknown>, key: string): string[] {
  const value = source[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function getNonNegativeTimes(source: Record<string, unknown>): number[] {
  return Object.values(source).flatMap((value) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return []
    return [Math.max(1, value)]
  })
}

function getBestTimeValue(source: Record<string, unknown>, fallback = 999): number {
  const values = getNonNegativeTimes(source)
  if (values.length === 0) return fallback
  return Math.min(...values)
}

function getMaxNumericKey(source: Record<string, unknown>): number {
  let max = 0
  for (const key of Object.keys(source)) {
    const numericKey = Number(key)
    if (Number.isFinite(numericKey) && numericKey > max) {
      max = numericKey
    }
  }
  return max
}

function hasPerfectHanoiSolve(bestMoves: Record<string, unknown>): boolean {
  return Object.entries(bestMoves).some(([diskCount, moves]) => {
    const disks = Number(diskCount)
    return (
      Number.isFinite(disks) &&
      typeof moves === "number" &&
      Number.isFinite(moves) &&
      moves === Math.pow(2, disks) - 1
    )
  })
}

function hasPlayedGame(...signals: number[]): boolean {
  return signals.some((value) => value > 0)
}

function sumRecordCounts(source: Record<string, unknown>): number {
  let sum = 0
  for (const value of Object.values(source)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      sum += Math.floor(value)
    }
  }
  return sum
}

function mergeBestTimeRecords(...sources: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue
      const normalized = Math.max(1, value)
      const current = merged[key]
      merged[key] = typeof current === "number" ? Math.min(current, normalized) : normalized
    }
  }
  return merged
}

function getMinesweeperWins(minesweeperStats: Record<string, unknown>, bestTimes: Record<string, unknown>): number {
  return Math.max(
    getNumber(minesweeperStats, "wins"),
    sumRecordCounts(getRecord(minesweeperStats, "winsByDifficulty")),
    getNonNegativeTimes(bestTimes).length,
  )
}

function getMinesweeperExpertWins(minesweeperStats: Record<string, unknown>, bestTimes: Record<string, unknown>): number {
  const expertTime = bestTimes.expert
  return Math.max(
    getNumber(getRecord(minesweeperStats, "winsByDifficulty"), "expert"),
    typeof expertTime === "number" && Number.isFinite(expertTime) && expertTime >= 0 ? 1 : 0,
  )
}

function countPlaygroundGamesPlayed(args: {
  minesweeperStats: Record<string, unknown>
  minesweeperBestTimes: Record<string, unknown>
  gomoku: Record<string, unknown>
  game2048: Record<string, unknown>
  game24: Record<string, unknown>
  life: Record<string, unknown>
  hanoi: Record<string, unknown>
  hanoiBestMoves: Record<string, unknown>
  sudoku: Record<string, unknown>
  nqueens: Record<string, unknown>
  fifteen: Record<string, unknown>
  memory: Record<string, unknown>
  quickMath: Record<string, unknown>
  maze: Record<string, unknown>
  tangramSolvedLevels: string[]
  nonogramSolvedLevels: string[]
  ballSortSolvedLevels: string[]
  balanceSolvedLevels: string[]
  symmetrySolvedLevels: string[]
}): number {
  let count = 0
  if (hasPlayedGame(getNumber(args.minesweeperStats, "totalGames"), getMinesweeperWins(args.minesweeperStats, args.minesweeperBestTimes))) count++
  if (hasPlayedGame(getNumber(args.gomoku, "wins"), getNumber(args.gomoku, "losses"), getNumber(args.gomoku, "draws"))) count++
  if (hasPlayedGame(getNumber(args.game2048, "wins"), getNumber(args.game2048, "maxTile"), getNumber(args.game2048, "bestScore"))) count++
  if (getNumber(args.game24, "solvedCount") > 0) count++
  if (hasPlayedGame(getNumber(args.life, "totalSessions")) || getStringArray(args.life, "challengesSolved").length > 0) count++
  if (hasPlayedGame(getNumber(args.hanoi, "wins")) || Object.keys(args.hanoiBestMoves).length > 0) count++
  if (getNumber(args.sudoku, "wins") > 0) count++
  if (getNumber(args.nqueens, "manualSolves") > 0) count++
  if (hasPlayedGame(getNumber(args.fifteen, "totalGames"), getNumber(args.fifteen, "wins"))) count++
  if (hasPlayedGame(getNumber(args.memory, "totalGames"), getNumber(args.memory, "wins"))) count++
  if (hasPlayedGame(getNumber(args.quickMath, "bestScore"), getNumber(args.quickMath, "bestStreak"))) count++
  if (hasPlayedGame(getNumber(args.maze, "totalGames"), getNumber(args.maze, "wins"))) count++
  if (args.tangramSolvedLevels.length > 0) count++
  if (args.nonogramSolvedLevels.length > 0) count++
  if (args.ballSortSolvedLevels.length > 0) count++
  if (args.balanceSolvedLevels.length > 0) count++
  if (args.symmetrySolvedLevels.length > 0) count++
  return count
}

function sumPlaygroundWins(args: {
  minesweeperStats: Record<string, unknown>
  minesweeperBestTimes: Record<string, unknown>
  gomoku: Record<string, unknown>
  game2048: Record<string, unknown>
  game24: Record<string, unknown>
  hanoi: Record<string, unknown>
  sudoku: Record<string, unknown>
  nqueens: Record<string, unknown>
  fifteen: Record<string, unknown>
  memory: Record<string, unknown>
  maze: Record<string, unknown>
  lifeChallengesSolved: number
  tangramSolved: number
  nonogramSolved: number
  ballSortSolved: number
  balanceSolved: number
  symmetrySolved: number
}): number {
  return (
    getMinesweeperWins(args.minesweeperStats, args.minesweeperBestTimes) +
    getNumber(args.gomoku, "wins") +
    getNumber(args.game2048, "wins") +
    getNumber(args.game24, "solvedCount") +
    getNumber(args.hanoi, "wins") +
    getNumber(args.sudoku, "wins") +
    getNumber(args.nqueens, "manualSolves") +
    getNumber(args.fifteen, "wins") +
    getNumber(args.memory, "wins") +
    getNumber(args.maze, "wins") +
    args.lifeChallengesSolved +
    args.tangramSolved +
    args.nonogramSolved +
    args.ballSortSolved +
    args.balanceSolved +
    args.symmetrySolved
  )
}

export function buildPlaygroundUserStats(playgroundStats: unknown): UserStats {
  const source = isRecord(playgroundStats) ? playgroundStats : {}

  const minesweeperStats = getRecord(source, "minesweeper_stats")
  const minesweeperBestTimes = mergeBestTimeRecords(
    getRecord(source, "minesweeper_best_times"),
    getRecord(minesweeperStats, "bestTimes"),
  )
  const gomoku = getRecord(source, "gomoku_records")
  const game2048 = getRecord(source, "game_2048_stats")
  const game24 = getRecord(source, "game_24_stats")
  const life = getRecord(source, "game_of_life_stats")
  const hanoi = getRecord(source, "hanoi_stats")
  const hanoiBestMoves = getRecord(hanoi, "bestMoves")
  const sudoku = getRecord(source, "sudoku_stats")
  const sudokuWinsByDifficulty = getRecord(sudoku, "winsByDifficulty")
  const nqueens = getRecord(source, "nqueens_stats")
  const fifteen = getRecord(source, "fifteen_puzzle_stats")
  const memory = getRecord(source, "memory_match_stats")
  const quickMath = getRecord(source, "quick_math_stats")
  const maze = getRecord(source, "maze_runner_stats")
  const tangram = getRecord(source, "tangram_stats")
  const nonogram = getRecord(source, "nonogram_stats")
  const ballSort = getRecord(source, "ball_sort_stats")
  const balance = getRecord(source, "balance_stats")
  const symmetry = getRecord(source, "symmetry_stats")

  const game24BestTime = game24.bestTime
  const tangramSolvedLevels = getStringArray(tangram, "solvedLevels")
  const nonogramSolvedLevels = getStringArray(nonogram, "solvedLevels")
  const ballSortSolvedLevels = getStringArray(ballSort, "solvedLevels")
  const balanceSolvedLevels = getStringArray(balance, "solvedLevels")
  const symmetrySolvedLevels = getStringArray(symmetry, "solvedLevels")
  const lifeChallengesSolved = getStringArray(life, "challengesSolved").length
  const playgroundGamesPlayed = countPlaygroundGamesPlayed({
    minesweeperStats,
    minesweeperBestTimes,
    gomoku,
    game2048,
    game24,
    life,
    hanoi,
    hanoiBestMoves,
    sudoku,
    nqueens,
    fifteen,
    memory,
    quickMath,
    maze,
    tangramSolvedLevels,
    nonogramSolvedLevels,
    ballSortSolvedLevels,
    balanceSolvedLevels,
    symmetrySolvedLevels,
  })
  const playgroundWinsTotal = sumPlaygroundWins({
    minesweeperStats,
    minesweeperBestTimes,
    gomoku,
    game2048,
    game24,
    hanoi,
    sudoku,
    nqueens,
    fifteen,
    memory,
    maze,
    lifeChallengesSolved,
    tangramSolved: tangramSolvedLevels.length,
    nonogramSolved: nonogramSolvedLevels.length,
    ballSortSolved: ballSortSolvedLevels.length,
    balanceSolved: balanceSolvedLevels.length,
    symmetrySolved: symmetrySolvedLevels.length,
  })

  return {
    ...DEFAULT_PLAYGROUND_STATS,
    minesweeperWins: getMinesweeperWins(minesweeperStats, minesweeperBestTimes),
    minesweeperExpertWins: getMinesweeperExpertWins(minesweeperStats, minesweeperBestTimes),
    minesweeperBestTime: getBestTimeValue(minesweeperBestTimes),
    gomokuWins: getNumber(gomoku, "wins"),
    gomokuPvEWins: getNumber(gomoku, "gomokuPvEWins"),
    game2048BestScore: getNumber(game2048, "bestScore"),
    game2048MaxTile: getNumber(game2048, "maxTile"),
    game2048Wins: getNumber(game2048, "wins"),
    game24Solved: getNumber(game24, "solvedCount"),
    game24BestStreak: getNumber(game24, "bestStreak"),
    game24BestTime: typeof game24BestTime === "number" && Number.isFinite(game24BestTime) ? game24BestTime : null,
    gameOfLifeSessions: getNumber(life, "totalSessions"),
    gameOfLifeMaxGen: getNumber(life, "maxGeneration"),
    gameOfLifeChallengesSolved: getStringArray(life, "challengesSolved").length,
    hanoiWins: getNumber(hanoi, "wins"),
    hanoiPerfect: hasPerfectHanoiSolve(hanoiBestMoves) ? 1 : 0,
    hanoiMaxDisksCleared: getMaxNumericKey(hanoiBestMoves),
    sudokuWins: getNumber(sudoku, "wins"),
    sudokuHardWins: getNumber(sudokuWinsByDifficulty, "hard"),
    nqueensManualSolves: getNumber(nqueens, "manualSolves"),
    fifteenWins: getNumber(fifteen, "wins"),
    memoryWins: getNumber(memory, "wins"),
    quickMathBestScore: getNumber(quickMath, "bestScore"),
    quickMathBestStreak: getNumber(quickMath, "bestStreak"),
    mazeWins: getNumber(maze, "wins"),
    tangramSolved: tangramSolvedLevels.length,
    nonogramSolved: nonogramSolvedLevels.length,
    ballSortSolved: ballSortSolvedLevels.length,
    balanceSolved: balanceSolvedLevels.length,
    symmetrySolved: symmetrySolvedLevels.length,
    playgroundGamesPlayed,
    playgroundWinsTotal,
  }
}

export function getUnlockedPlaygroundBadgeIds(playgroundStats: unknown): string[] {
  const stats = buildPlaygroundUserStats(playgroundStats)
  return BADGES.filter((badge) => badge.seriesKey && PLAYGROUND_BADGE_SERIES.has(badge.seriesKey) && badge.condition(stats)).map(
    (badge) => badge.id,
  )
}

export async function syncPlaygroundBadges(userId: string) {
  if (!supabaseAdmin) {
    throw new Error("服务暂时不可用")
  }

  const { data, error } = await supabaseAdmin
    .from("playground_stats")
    .select("stats")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const unlockedBadgeIds = getUnlockedPlaygroundBadgeIds(data?.stats ?? {})

  if (unlockedBadgeIds.length === 0) {
    return { unlockedBadgeIds, inserted: 0 }
  }

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId)
    .in("badge_id", unlockedBadgeIds)

  if (existingError) {
    throw existingError
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.badge_id))
  const badgeIdsToInsert = unlockedBadgeIds.filter((badgeId) => !existingIds.has(badgeId))

  if (badgeIdsToInsert.length === 0) {
    return { unlockedBadgeIds, inserted: 0 }
  }

  const { error: insertError } = await supabaseAdmin.from("user_badges").upsert(
    badgeIdsToInsert.map((badgeId) => ({
      user_id: userId,
      badge_id: badgeId,
      unlocked_at: new Date().toISOString(),
    })) as never[],
    { onConflict: "user_id,badge_id", ignoreDuplicates: true },
  )

  if (insertError) {
    throw insertError
  }

  return { unlockedBadgeIds, inserted: badgeIdsToInsert.length }
}
