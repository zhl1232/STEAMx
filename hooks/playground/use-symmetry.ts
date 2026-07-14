import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type SymmetryAxis = "vertical" | "horizontal"
export type SymmetrySourceSide = "left" | "right" | "top" | "bottom"

export type SymmetryLevel = {
    id: string
    name: string
    hint: string
    size: number
    axis: SymmetryAxis
    sourceSide: SymmetrySourceSide
    /** 完整目标图案，1 = 填色 */
    target: number[][]
}

export type SymmetryStats = {
    totalGames: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
    bestStars: Record<string, number>
}

type LastFeedback = {
    row: number
    col: number
    kind: "correct" | "wrong" | "cleared"
}

const STATS_KEY = "symmetry_stats"
const EMPTY_STATS: SymmetryStats = { totalGames: 0, solvedLevels: [], bestTimes: {}, bestStars: {} }

function mirrorCell(r: number, c: number, size: number, axis: SymmetryAxis): { r: number; c: number } {
    if (axis === "vertical") return { r, c: size - 1 - c }
    return { r: size - 1 - r, c }
}

export function isSymmetrySourceCell(level: SymmetryLevel, row: number, col: number): boolean {
    const midpoint = level.size / 2
    if (level.axis === "vertical") {
        return level.sourceSide === "right" ? col >= midpoint : col < midpoint
    }
    return level.sourceSide === "bottom" ? row >= midpoint : row < midpoint
}

export function isSymmetryPlayableCell(level: SymmetryLevel, row: number, col: number): boolean {
    return !isSymmetrySourceCell(level, row, col)
}

export function createSymmetryChallengeGrid(level: SymmetryLevel): number[][] {
    return level.target.map((line, row) =>
        line.map((cell, col) => (isSymmetrySourceCell(level, row, col) && cell === 1 ? 1 : 0)),
    )
}

export function applySymmetryPaint(
    grid: number[][],
    row: number,
    col: number,
    axis: SymmetryAxis,
): number[][] {
    const size = grid.length
    const next = grid.map((line) => [...line])
    const value = next[row][col] === 1 ? 0 : 1
    next[row][col] = value
    const mirrored = mirrorCell(row, col, size, axis)
    next[mirrored.r][mirrored.c] = value
    return next
}

export function applySymmetryGuess(
    grid: number[][],
    row: number,
    col: number,
    level: SymmetryLevel,
): number[][] {
    if (!isSymmetryPlayableCell(level, row, col)) return grid
    const next = grid.map((line) => [...line])
    next[row][col] = next[row][col] === 1 ? 0 : 1
    return next
}

export function isSymmetrySolved(grid: number[][], target: number[][]): boolean {
    if (grid.length !== target.length) return false
    for (let r = 0; r < target.length; r += 1) {
        if (grid[r].length !== target[r].length) return false
        for (let c = 0; c < target[r].length; c += 1) {
            if ((grid[r][c] === 1) !== (target[r][c] === 1)) return false
        }
    }
    return true
}

export function getSymmetryRequiredCount(level: SymmetryLevel): number {
    let total = 0
    for (let r = 0; r < level.target.length; r += 1) {
        for (let c = 0; c < level.target[r].length; c += 1) {
            if (isSymmetryPlayableCell(level, r, c) && level.target[r][c] === 1) total += 1
        }
    }
    return total
}

export function getSymmetryStars(level: SymmetryLevel, moves: number, mistakes: number): number {
    const parMoves = getSymmetryRequiredCount(level)
    const extraMoves = Math.max(0, moves - parMoves)
    const twoStarSlack = Math.max(2, Math.ceil(parMoves * 0.18))
    if (mistakes === 0 && extraMoves === 0) return 3
    if (mistakes <= 1 && extraMoves <= twoStarSlack) return 2
    return 1
}

export const SYMMETRY_LEVELS: SymmetryLevel[] = [
    {
        id: "butterfly",
        name: "蝴蝶",
        hint: "左半边是样本，在右半边补出对应像素。",
        size: 6,
        axis: "vertical",
        sourceSide: "left",
        target: [
            [0, 1, 0, 0, 1, 0],
            [1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 0],
            [1, 0, 1, 1, 0, 1],
            [0, 1, 0, 0, 1, 0],
            [0, 0, 1, 1, 0, 0],
        ],
    },
    {
        id: "heart",
        name: "对称心",
        hint: "这关从右往左看，别把底部尖角画宽。",
        size: 6,
        axis: "vertical",
        sourceSide: "right",
        target: [
            [0, 1, 0, 0, 1, 0],
            [1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
        ],
    },
    {
        id: "tower",
        name: "镜像塔",
        hint: "上半边是样本，从中轴往下数对应行。",
        size: 6,
        axis: "horizontal",
        sourceSide: "top",
        target: [
            [0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 1],
            [1, 1, 0, 0, 1, 1],
            [0, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 0, 0],
        ],
    },
    {
        id: "gem",
        name: "宝石",
        hint: "8×8 竖轴挑战，斜边错一格会很明显。",
        size: 8,
        axis: "vertical",
        sourceSide: "left",
        target: [
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [0, 1, 1, 0, 0, 1, 1, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "mask",
        name: "面具",
        hint: "右半边给出表情，补左半边时注意眼睛和嘴角。",
        size: 8,
        axis: "vertical",
        sourceSide: "right",
        target: [
            [0, 1, 1, 0, 0, 1, 1, 0],
            [1, 0, 0, 1, 1, 0, 0, 1],
            [1, 0, 1, 0, 0, 1, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 1],
            [0, 1, 0, 0, 0, 0, 1, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "rocket",
        name: "火箭",
        hint: "喷焰和舷窗都有空洞，先找外轮廓再补内部。",
        size: 8,
        axis: "vertical",
        sourceSide: "left",
        target: [
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 1, 1, 0, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [1, 0, 0, 1, 1, 0, 0, 1],
            [0, 0, 1, 0, 0, 1, 0, 0],
        ],
    },
    {
        id: "owl",
        name: "猫头鹰",
        hint: "右半边的眼睛和羽毛纹理要逐行对应回来。",
        size: 8,
        axis: "vertical",
        sourceSide: "right",
        target: [
            [0, 1, 1, 0, 0, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 1, 0, 1],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 1, 0, 1, 1, 0, 1, 0],
            [1, 0, 0, 0, 0, 0, 0, 1],
        ],
    },
    {
        id: "lantern",
        name: "灯笼",
        hint: "上半边是样本，横轴镜像时列不变、行数倒过来。",
        size: 10,
        axis: "horizontal",
        sourceSide: "top",
        target: [
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
        ],
    },
    {
        id: "robot",
        name: "机器人",
        hint: "10×10 复杂轮廓，先补头部，再处理手臂和腿。",
        size: 10,
        axis: "vertical",
        sourceSide: "left",
        target: [
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
            [1, 0, 1, 1, 0, 0, 1, 1, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 0, 1, 0, 0, 1, 0, 1, 1],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
        ],
    },
    {
        id: "totem",
        name: "图腾",
        hint: "底部样本要翻到上方，横轴镜像最容易把行序看反。",
        size: 10,
        axis: "horizontal",
        sourceSide: "bottom",
        target: [
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 0, 0],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
            [0, 1, 1, 1, 0, 0, 1, 1, 1, 0],
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
        ],
    },
]

function loadStats(): SymmetryStats {
    const raw = getPlaygroundItem<Partial<SymmetryStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
        bestStars: raw.bestStars && typeof raw.bestStars === "object" ? raw.bestStars : {},
    }
}

function saveStats(stats: SymmetryStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useSymmetry() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [grid, setGrid] = useState<number[][]>(() => createSymmetryChallengeGrid(SYMMETRY_LEVELS[0]))
    const [time, setTime] = useState(0)
    const [moves, setMoves] = useState(0)
    const [mistakes, setMistakes] = useState(0)
    const [streak, setStreak] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<SymmetryStats>(EMPTY_STATS)
    const [lastFeedback, setLastFeedback] = useState<LastFeedback | null>(null)
    const solvedRecordedRef = useRef(false)
    const level = SYMMETRY_LEVELS[levelIndex]
    const progress = useMemo(() => {
        let correct = 0
        let required = 0
        let wrong = 0
        let filled = 0
        let playable = 0
        for (let r = 0; r < level.target.length; r += 1) {
            for (let c = 0; c < level.target[r].length; c += 1) {
                if (!isSymmetryPlayableCell(level, r, c)) continue
                playable += 1
                const filledCell = grid[r]?.[c] === 1
                const targetCell = level.target[r][c] === 1
                if (targetCell) required += 1
                if (filledCell) filled += 1
                if (filledCell && targetCell) correct += 1
                if (filledCell && !targetCell) wrong += 1
            }
        }
        return { correct, required, wrong, filled, playable, remaining: Math.max(0, required - correct) }
    }, [grid, level])
    const stars = useMemo(() => getSymmetryStars(level, moves, mistakes), [level, mistakes, moves])

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: SymmetryLevel, seconds: number, earnedStars: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousBest = prev.bestTimes[solvedLevel.id]
            const previousStars = prev.bestStars[solvedLevel.id] ?? 0
            const updated: SymmetryStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestTimes: {
                    ...prev.bestTimes,
                    [solvedLevel.id]: previousBest ? Math.min(previousBest, seconds) : seconds,
                },
                bestStars: {
                    ...prev.bestStars,
                    [solvedLevel.id]: Math.max(previousStars, earnedStars),
                },
            }
            saveStats(updated)
            return updated
        })
    }, [])

    const paint = useCallback(
        (row: number, col: number) => {
            if (status === "solved" || !isSymmetryPlayableCell(level, row, col)) return
            const next = applySymmetryGuess(grid, row, col, level)
            const nextValue = next[row]?.[col] ?? 0
            const targetFilled = level.target[row]?.[col] === 1
            const nextMoves = moves + 1
            const nextMistakes = mistakes + (nextValue === 1 && !targetFilled ? 1 : 0)
            const nextStreak = nextValue === 1 && targetFilled ? streak + 1 : 0
            const nextStars = getSymmetryStars(level, nextMoves, nextMistakes)

            setGrid(next)
            setMoves(nextMoves)
            setMistakes(nextMistakes)
            setStreak(nextStreak)
            setLastFeedback({
                row,
                col,
                kind: nextValue === 0 ? "cleared" : targetFilled ? "correct" : "wrong",
            })

            if (isSymmetrySolved(next, level.target)) {
                recordSolve(level, time, nextStars)
            }
        },
        [grid, level, mistakes, moves, recordSolve, status, streak, time],
    )

    const startLevel = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(SYMMETRY_LEVELS.length - 1, index))
        const nextLevel = SYMMETRY_LEVELS[nextIndex]
        solvedRecordedRef.current = false
        setLevelIndex(nextIndex)
        setGrid(createSymmetryChallengeGrid(nextLevel))
        setTime(0)
        setMoves(0)
        setMistakes(0)
        setStreak(0)
        setLastFeedback(null)
        setStatus("playing")
    }, [])

    const clear = useCallback(() => {
        if (status === "solved") return
        setGrid(createSymmetryChallengeGrid(level))
        setMoves(0)
        setMistakes(0)
        setStreak(0)
        setLastFeedback(null)
    }, [level, status])

    return {
        level,
        levelIndex,
        levelCount: SYMMETRY_LEVELS.length,
        grid,
        progress,
        time,
        moves,
        mistakes,
        streak,
        stars,
        status,
        stats,
        lastFeedback,
        paint,
        clear,
        startLevel,
    }
}
