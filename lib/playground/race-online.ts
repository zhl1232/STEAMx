import { generateRoomCode, type BaseMatchRow } from "@/lib/playground/online-room"

export { generateRoomCode }

export const RACE_GAME_KEYS = [
    "quickmath",
    "hanoi",
    "nqueens",
    "nonogram",
    "ballsort",
    "balance",
    "symmetry",
    "tangram",
] as const

export type RaceGameKey = (typeof RACE_GAME_KEYS)[number]
export type RaceRole = "host" | "guest"
export type RaceWinner = RaceRole | "draw" | null

export type RaceSettings = {
    durationSeconds?: number
    diskCount?: number
    n?: number
    levelId?: string
    levelIndex?: number
}

export type RaceResult = {
    completed: boolean
    score?: number
    streak?: number
    moves?: number
    timeSeconds?: number
    mistakes?: number
    stars?: number
    weighings?: number
    durationSeconds?: number
    diskCount?: number
    n?: number
    levelId?: string
    levelIndex?: number
}

export type RaceMatchRow = BaseMatchRow & {
    game_key: RaceGameKey
    settings: RaceSettings
    host_result: RaceResult | null
    guest_result: RaceResult | null
    winner: RaceWinner
    last_activity_at: string
}

export type RaceGameMeta = {
    key: RaceGameKey
    label: string
    shortLabel: string
    objective: string
    settingLabel: (settings: RaceSettings) => string
    resultLabel: (result: RaceResult | null) => string
}

const FALLBACK_LEVEL_LABEL = "当前关卡"

function formatTime(seconds: number | undefined): string {
    if (typeof seconds !== "number" || !Number.isFinite(seconds)) return "--:--"
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function levelName(settings: RaceSettings): string {
    if (settings.levelId) return settings.levelId
    if (typeof settings.levelIndex === "number") return `第 ${settings.levelIndex + 1} 关`
    return FALLBACK_LEVEL_LABEL
}

export const RACE_GAME_META: Record<RaceGameKey, RaceGameMeta> = {
    quickmath: {
        key: "quickmath",
        label: "速算闪电战",
        shortLabel: "速算",
        objective: "同样 60 秒内比得分，得分相同比最长连击。",
        settingLabel: (settings) => `${settings.durationSeconds ?? 60} 秒`,
        resultLabel: (result) =>
            result
                ? `${result.score ?? 0} 分 · 连击 ${result.streak ?? 0}`
                : "等待提交",
    },
    hanoi: {
        key: "hanoi",
        label: "汉诺塔",
        shortLabel: "汉诺塔",
        objective: "同盘数通关，步数少者胜，步数相同比用时。",
        settingLabel: (settings) => `${settings.diskCount ?? 3} 个圆盘`,
        resultLabel: (result) =>
            result
                ? `${result.moves ?? 0} 步 · ${formatTime(result.timeSeconds)}`
                : "等待提交",
    },
    nqueens: {
        key: "nqueens",
        label: "N 皇后",
        shortLabel: "N 皇后",
        objective: "同样棋盘规模手动解题，用时少者胜。",
        settingLabel: (settings) => `${settings.n ?? 8} 皇后`,
        resultLabel: (result) =>
            result ? `${formatTime(result.timeSeconds)}` : "等待提交",
    },
    nonogram: {
        key: "nonogram",
        label: "数织",
        shortLabel: "数织",
        objective: "同一关卡通关，用时少者胜。",
        settingLabel: levelName,
        resultLabel: (result) =>
            result
                ? `${formatTime(result.timeSeconds)} · 误点 ${result.mistakes ?? 0}`
                : "等待提交",
    },
    ballsort: {
        key: "ballsort",
        label: "球排序",
        shortLabel: "球排序",
        objective: "同一关卡通关，步数少者胜，步数相同比用时。",
        settingLabel: levelName,
        resultLabel: (result) =>
            result
                ? `${result.moves ?? 0} 步 · ${formatTime(result.timeSeconds)}`
                : "等待提交",
    },
    balance: {
        key: "balance",
        label: "天平称重",
        shortLabel: "天平",
        objective: "同一关卡找出假币，称量次数少者胜，次数相同比用时。",
        settingLabel: levelName,
        resultLabel: (result) =>
            result
                ? `${result.weighings ?? 0} 次 · ${formatTime(result.timeSeconds)}`
                : "等待提交",
    },
    symmetry: {
        key: "symmetry",
        label: "像素对称",
        shortLabel: "对称",
        objective: "同一关卡通关，星级高者胜，再比误点、步数和用时。",
        settingLabel: levelName,
        resultLabel: (result) =>
            result
                ? `${result.stars ?? 0} 星 · ${result.moves ?? 0} 步 · ${formatTime(result.timeSeconds)}`
                : "等待提交",
    },
    tangram: {
        key: "tangram",
        label: "七巧板",
        shortLabel: "七巧板",
        objective: "同一关卡完成拼图，用时少者胜。",
        settingLabel: levelName,
        resultLabel: (result) =>
            result ? `${formatTime(result.timeSeconds)}` : "等待提交",
    },
}

export function isRaceGameKey(value: unknown): value is RaceGameKey {
    return typeof value === "string" && RACE_GAME_KEYS.includes(value as RaceGameKey)
}

function readObject(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
}

function readInteger(
    value: unknown,
    field: string,
    min: number,
    max: number,
    fallback?: number,
): number {
    const candidate = value === undefined || value === null || value === "" ? fallback : value
    const numberValue = typeof candidate === "string" ? Number(candidate) : candidate
    if (
        typeof numberValue !== "number" ||
        !Number.isInteger(numberValue) ||
        numberValue < min ||
        numberValue > max
    ) {
        throw new Error(`${field} must be an integer between ${min} and ${max}`)
    }
    return numberValue
}

function readLevelSettings(raw: Record<string, unknown>): RaceSettings {
    const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
    if (!levelId || levelId.length > 80) {
        throw new Error("levelId is required")
    }
    const levelIndex =
        raw.levelIndex === undefined
            ? undefined
            : readInteger(raw.levelIndex, "levelIndex", 0, 200)
    return { levelId, levelIndex }
}

export function normalizeRaceSettings(
    gameKey: RaceGameKey,
    value: unknown,
): RaceSettings {
    const raw = readObject(value)
    switch (gameKey) {
        case "quickmath":
            return {
                durationSeconds: readInteger(
                    raw.durationSeconds,
                    "durationSeconds",
                    60,
                    60,
                    60,
                ),
            }
        case "hanoi":
            return { diskCount: readInteger(raw.diskCount, "diskCount", 3, 8, 3) }
        case "nqueens":
            return { n: readInteger(raw.n, "n", 4, 12, 8) }
        case "nonogram":
        case "ballsort":
        case "balance":
        case "symmetry":
        case "tangram":
            return readLevelSettings(raw)
    }
}

function ensureMatches(
    actual: string | number | undefined,
    expected: string | number | undefined,
    field: string,
) {
    if (expected === undefined) return
    if (actual !== expected) throw new Error(`${field} does not match room settings`)
}

function baseResult(raw: Record<string, unknown>): RaceResult {
    return { completed: raw.completed !== false }
}

export function normalizeRaceResult(
    gameKey: RaceGameKey,
    value: unknown,
    settings: RaceSettings,
): RaceResult {
    const raw = readObject(value)
    const result = baseResult(raw)

    switch (gameKey) {
        case "quickmath": {
            const durationSeconds = readInteger(
                raw.durationSeconds,
                "durationSeconds",
                60,
                60,
                settings.durationSeconds ?? 60,
            )
            ensureMatches(durationSeconds, settings.durationSeconds, "durationSeconds")
            return {
                ...result,
                durationSeconds,
                score: readInteger(raw.score, "score", 0, 100_000),
                streak: readInteger(raw.streak, "streak", 0, 10_000, 0),
            }
        }
        case "hanoi": {
            const diskCount = readInteger(raw.diskCount, "diskCount", 3, 8)
            ensureMatches(diskCount, settings.diskCount, "diskCount")
            return {
                ...result,
                diskCount,
                moves: readInteger(raw.moves, "moves", 1, 100_000),
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
        case "nqueens": {
            const n = readInteger(raw.n, "n", 4, 12)
            ensureMatches(n, settings.n, "n")
            return {
                ...result,
                n,
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
        case "nonogram": {
            const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
            ensureMatches(levelId, settings.levelId, "levelId")
            return {
                ...result,
                levelId,
                levelIndex: settings.levelIndex,
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
                mistakes: readInteger(raw.mistakes, "mistakes", 0, 100, 0),
            }
        }
        case "ballsort": {
            const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
            ensureMatches(levelId, settings.levelId, "levelId")
            return {
                ...result,
                levelId,
                levelIndex: settings.levelIndex,
                moves: readInteger(raw.moves, "moves", 1, 10_000),
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
        case "balance": {
            const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
            ensureMatches(levelId, settings.levelId, "levelId")
            return {
                ...result,
                levelId,
                levelIndex: settings.levelIndex,
                weighings: readInteger(raw.weighings, "weighings", 0, 100),
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
        case "symmetry": {
            const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
            ensureMatches(levelId, settings.levelId, "levelId")
            return {
                ...result,
                levelId,
                levelIndex: settings.levelIndex,
                stars: readInteger(raw.stars, "stars", 0, 3, 0),
                mistakes: readInteger(raw.mistakes, "mistakes", 0, 1_000, 0),
                moves: readInteger(raw.moves, "moves", 1, 10_000),
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
        case "tangram": {
            const levelId = typeof raw.levelId === "string" ? raw.levelId.trim() : ""
            ensureMatches(levelId, settings.levelId, "levelId")
            return {
                ...result,
                levelId,
                levelIndex: settings.levelIndex,
                timeSeconds: readInteger(raw.timeSeconds, "timeSeconds", 0, 86_400),
            }
        }
    }
}

function compareHigher(a: number | undefined, b: number | undefined): -1 | 0 | 1 {
    const left = a ?? 0
    const right = b ?? 0
    if (left === right) return 0
    return left > right ? -1 : 1
}

function compareLower(a: number | undefined, b: number | undefined): -1 | 0 | 1 {
    const left = a ?? Number.POSITIVE_INFINITY
    const right = b ?? Number.POSITIVE_INFINITY
    if (left === right) return 0
    return left < right ? -1 : 1
}

function firstNonDraw(values: Array<-1 | 0 | 1>): -1 | 0 | 1 {
    return values.find((value) => value !== 0) ?? 0
}

export function compareRaceResults(
    gameKey: RaceGameKey,
    a: RaceResult,
    b: RaceResult,
): -1 | 0 | 1 {
    if (a.completed !== b.completed) return a.completed ? -1 : 1

    switch (gameKey) {
        case "quickmath":
            return firstNonDraw([
                compareHigher(a.score, b.score),
                compareHigher(a.streak, b.streak),
            ])
        case "hanoi":
        case "ballsort":
            return firstNonDraw([
                compareLower(a.moves, b.moves),
                compareLower(a.timeSeconds, b.timeSeconds),
            ])
        case "nqueens":
        case "nonogram":
        case "tangram":
            return compareLower(a.timeSeconds, b.timeSeconds)
        case "balance":
            return firstNonDraw([
                compareLower(a.weighings, b.weighings),
                compareLower(a.timeSeconds, b.timeSeconds),
            ])
        case "symmetry":
            return firstNonDraw([
                compareHigher(a.stars, b.stars),
                compareLower(a.mistakes, b.mistakes),
                compareLower(a.moves, b.moves),
                compareLower(a.timeSeconds, b.timeSeconds),
            ])
    }
}

export function decideRaceWinner(
    gameKey: RaceGameKey,
    hostResult: RaceResult | null,
    guestResult: RaceResult | null,
): RaceWinner {
    if (!hostResult || !guestResult) return null
    const comparison = compareRaceResults(gameKey, hostResult, guestResult)
    if (comparison < 0) return "host"
    if (comparison > 0) return "guest"
    return "draw"
}

export function oppositeRaceRole(role: RaceRole): RaceRole {
    return role === "host" ? "guest" : "host"
}
