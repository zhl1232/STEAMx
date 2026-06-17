import { getPlaygroundItem } from "@/lib/playground/storage"

export const MINESWEEPER_STATS_KEY = "minesweeper_stats"
export const MINESWEEPER_BEST_TIMES_KEY = "minesweeper_best_times"

export type MinesweeperBestTimes = Record<string, number>

export type MinesweeperStats = {
  totalGames: number
  wins: number
  winsByDifficulty: Record<string, number>
  bestTimes: MinesweeperBestTimes
}

const DIFFICULTY_KEYS = ["beginner", "intermediate", "expert"] as const

function createEmptyWinsByDifficulty(): Record<string, number> {
  return DIFFICULTY_KEYS.reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0
    return acc
  }, {})
}

export function createEmptyMinesweeperStats(): MinesweeperStats {
  return {
    totalGames: 0,
    wins: 0,
    winsByDifficulty: createEmptyWinsByDifficulty(),
    bestTimes: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function normalizeBestTimes(value: unknown): MinesweeperBestTimes {
  if (!isRecord(value)) return {}

  const result: MinesweeperBestTimes = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
      result[key] = Math.max(1, Math.floor(raw))
    }
  }
  return result
}

function normalizeCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}

  const result: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    const count = toCount(raw)
    if (count > 0) {
      result[key] = count
    }
  }
  return result
}

function mergeBestTimes(a: MinesweeperBestTimes, b: MinesweeperBestTimes): MinesweeperBestTimes {
  const merged = { ...a }
  for (const [key, time] of Object.entries(b)) {
    const current = merged[key]
    merged[key] = current === undefined ? time : Math.min(current, time)
  }
  return merged
}

function buildStatsFromLegacyBestTimes(bestTimes: MinesweeperBestTimes): MinesweeperStats {
  const winsByDifficulty = createEmptyWinsByDifficulty()
  for (const key of Object.keys(bestTimes)) {
    winsByDifficulty[key] = Math.max(winsByDifficulty[key] ?? 0, 1)
  }

  const wins = Object.keys(bestTimes).length
  return {
    totalGames: wins,
    wins,
    winsByDifficulty,
    bestTimes,
  }
}

/** Merge structured stats with legacy best-time records from localStorage. */
export function readMergedMinesweeperStats(): MinesweeperStats {
  const legacyBestTimes = normalizeBestTimes(getPlaygroundItem<MinesweeperBestTimes>(MINESWEEPER_BEST_TIMES_KEY))
  const legacyStats = buildStatsFromLegacyBestTimes(legacyBestTimes)
  const rawStats = getPlaygroundItem<MinesweeperStats>(MINESWEEPER_STATS_KEY)

  if (!isRecord(rawStats)) return legacyStats

  const rawBestTimes = normalizeBestTimes(rawStats.bestTimes)
  const bestTimes = mergeBestTimes(legacyStats.bestTimes, rawBestTimes)
  const rawWinsByDifficulty = normalizeCounts(rawStats.winsByDifficulty)
  const winsByDifficulty = { ...createEmptyWinsByDifficulty(), ...rawWinsByDifficulty }

  for (const key of Object.keys(legacyStats.winsByDifficulty)) {
    winsByDifficulty[key] = Math.max(winsByDifficulty[key] ?? 0, legacyStats.winsByDifficulty[key] ?? 0)
  }

  const winsFromDifficulty = Object.values(winsByDifficulty).reduce((sum, value) => sum + value, 0)
  const wins = Math.max(toCount(rawStats.wins), legacyStats.wins, winsFromDifficulty)
  const totalGames = Math.max(toCount(rawStats.totalGames), legacyStats.totalGames, wins)

  return {
    totalGames,
    wins,
    winsByDifficulty,
    bestTimes,
  }
}
