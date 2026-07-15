import { generateRoomCode, type BaseMatchRow } from "@/lib/playground/online-room"

export { generateRoomCode }

export const RACE_GAME_KEYS = [
    "game24",
    "quickmath",
    "hanoi",
    "nqueens",
    "fifteen",
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
    cardValues?: number[]
    initialBoard?: number[]
    size?: number
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
    cardValues?: number[]
    initialBoard?: number[]
    size?: number
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
const CARD_LABELS: Record<number, string> = {
    1: "A",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
}

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

function cardValuesName(settings: RaceSettings): string {
    return settings.cardValues?.map((value) => CARD_LABELS[value] ?? String(value)).join(" ") ?? "同一组牌"
}

export const RACE_GAME_META: Record<RaceGameKey, RaceGameMeta> = {
    game24: {
        key: "game24",
        label: "24 点",
        shortLabel: "24 点",
        objective: "同一组牌比解题用时，未解出不计胜。",
        settingLabel: cardValuesName,
        resultLabel: (result) =>
            result
                ? result.completed
                    ? formatTime(result.timeSeconds)
                    : "未解出"
                : "等待提交",
    },
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
    fifteen: {
        key: "fifteen",
        label: "数字华容道",
        shortLabel: "华容道",
        objective: "同一初始棋盘复原，步数少者胜，步数相同比用时。",
        settingLabel: (settings) => `${settings.size ?? 4}×${settings.size ?? 4} 固定盘面`,
        resultLabel: (result) =>
            result
                ? `${result.moves ?? 0} 步 · ${formatTime(result.timeSeconds)}`
                : "等待提交",
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

function readIntegerArray(
    value: unknown,
    field: string,
    length: number,
    min: number,
    max: number,
): number[] {
    if (!Array.isArray(value) || value.length !== length) {
        throw new Error(`${field} must contain ${length} numbers`)
    }
    return value.map((item, index) => readInteger(item, `${field}[${index}]`, min, max))
}

function arraysEqual(a: number[] | undefined, b: number[] | undefined): boolean {
    if (a === undefined || b === undefined) return a === b
    if (a.length !== b.length) return false
    return a.every((value, index) => value === b[index])
}

function ensureArrayMatches(
    actual: number[] | undefined,
    expected: number[] | undefined,
    field: string,
) {
    if (expected === undefined) return
    if (!arraysEqual(actual, expected)) throw new Error(`${field} does not match room settings`)
}

function getPermutations(values: number[]): number[][] {
    if (values.length <= 1) return [values]
    const result: number[][] = []
    for (let index = 0; index < values.length; index += 1) {
        const rest = [...values.slice(0, index), ...values.slice(index + 1)]
        for (const permutation of getPermutations(rest)) {
            result.push([values[index], ...permutation])
        }
    }
    return result
}

function apply24Op(a: number, op: string, b: number): number | null {
    switch (op) {
        case "+":
            return a + b
        case "-":
            return a - b
        case "*":
            return a * b
        case "/":
            return b === 0 ? null : a / b
        default:
            return null
    }
}

function has24Solution(values: number[]): boolean {
    const ops = ["+", "-", "*", "/"]
    const epsilon = 1e-9
    for (const [a, b, c, d] of getPermutations(values)) {
        for (const op1 of ops) {
            for (const op2 of ops) {
                for (const op3 of ops) {
                    const r1 = apply24Op(a, op1, b)
                    if (r1 !== null) {
                        const r2 = apply24Op(r1, op2, c)
                        const r3 = r2 === null ? null : apply24Op(r2, op3, d)
                        if (r3 !== null && Math.abs(r3 - 24) < epsilon) return true
                    }

                    const r4 = apply24Op(b, op2, c)
                    if (r4 !== null) {
                        const r5 = apply24Op(a, op1, r4)
                        const r6 = r5 === null ? null : apply24Op(r5, op3, d)
                        if (r6 !== null && Math.abs(r6 - 24) < epsilon) return true
                    }

                    const r7 = apply24Op(a, op1, b)
                    const r8 = apply24Op(c, op3, d)
                    if (r7 !== null && r8 !== null) {
                        const r9 = apply24Op(r7, op2, r8)
                        if (r9 !== null && Math.abs(r9 - 24) < epsilon) return true
                    }

                    const r10 = apply24Op(b, op2, c)
                    if (r10 !== null) {
                        const r11 = apply24Op(r10, op3, d)
                        const r12 = r11 === null ? null : apply24Op(a, op1, r11)
                        if (r12 !== null && Math.abs(r12 - 24) < epsilon) return true
                    }

                    const r13 = apply24Op(c, op3, d)
                    if (r13 !== null) {
                        const r14 = apply24Op(b, op2, r13)
                        const r15 = r14 === null ? null : apply24Op(a, op1, r14)
                        if (r15 !== null && Math.abs(r15 - 24) < epsilon) return true
                    }
                }
            }
        }
    }
    return false
}

function validateFifteenBoard(board: number[], size: number) {
    const expectedLength = size * size
    if (board.length !== expectedLength) {
        throw new Error("initialBoard length does not match size")
    }
    const seen = new Set(board)
    for (let value = 0; value < expectedLength; value += 1) {
        if (!seen.has(value)) throw new Error("initialBoard must contain every tile once")
    }
    if (isSolvedSlidingBoard(board)) {
        throw new Error("initialBoard must not be solved")
    }
    if (!isSolvableSlidingBoard(board, size)) {
        throw new Error("initialBoard must be solvable")
    }
}

function isSolvedSlidingBoard(board: number[]): boolean {
    for (let index = 0; index < board.length - 1; index += 1) {
        if (board[index] !== index + 1) return false
    }
    return board[board.length - 1] === 0
}

function isSolvableSlidingBoard(board: number[], size: number): boolean {
    const values = board.filter((value) => value !== 0)
    let inversions = 0
    for (let left = 0; left < values.length; left += 1) {
        for (let right = left + 1; right < values.length; right += 1) {
            if (values[left] > values[right]) inversions += 1
        }
    }
    if (size % 2 === 1) return inversions % 2 === 0
    const blankRowFromBottom = size - Math.floor(board.indexOf(0) / size)
    return blankRowFromBottom % 2 === 0 ? inversions % 2 === 1 : inversions % 2 === 0
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
        case "game24": {
            const cardValues = readIntegerArray(raw.cardValues, "cardValues", 4, 1, 13)
            if (!has24Solution(cardValues)) {
                throw new Error("cardValues must have at least one 24-point solution")
            }
            return {
                durationSeconds: readInteger(
                    raw.durationSeconds,
                    "durationSeconds",
                    60,
                    60,
                    60,
                ),
                cardValues,
            }
        }
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
        case "fifteen": {
            const size = readInteger(raw.size, "size", 3, 5, 4)
            const initialBoard = readIntegerArray(
                raw.initialBoard,
                "initialBoard",
                size * size,
                0,
                size * size - 1,
            )
            validateFifteenBoard(initialBoard, size)
            return { size, initialBoard }
        }
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
        case "game24": {
            const cardValues =
                raw.cardValues === undefined
                    ? settings.cardValues
                    : readIntegerArray(raw.cardValues, "cardValues", 4, 1, 13)
            ensureArrayMatches(cardValues, settings.cardValues, "cardValues")
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
                cardValues,
                durationSeconds,
                timeSeconds: readInteger(
                    raw.timeSeconds,
                    "timeSeconds",
                    0,
                    durationSeconds,
                    result.completed ? undefined : durationSeconds,
                ),
            }
        }
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
        case "fifteen": {
            const size = readInteger(raw.size, "size", 3, 5, settings.size ?? 4)
            ensureMatches(size, settings.size, "size")
            const initialBoard =
                raw.initialBoard === undefined
                    ? settings.initialBoard
                    : readIntegerArray(
                        raw.initialBoard,
                        "initialBoard",
                        size * size,
                        0,
                        size * size - 1,
                    )
            ensureArrayMatches(initialBoard, settings.initialBoard, "initialBoard")
            return {
                ...result,
                size,
                initialBoard,
                moves: readInteger(raw.moves, "moves", 1, 100_000),
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
        case "game24":
            if (!a.completed && !b.completed) return 0
            return compareLower(a.timeSeconds, b.timeSeconds)
        case "quickmath":
            return firstNonDraw([
                compareHigher(a.score, b.score),
                compareHigher(a.streak, b.streak),
            ])
        case "hanoi":
        case "ballsort":
        case "fifteen":
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
