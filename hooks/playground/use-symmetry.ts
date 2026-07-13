import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type SymmetryAxis = "vertical" | "horizontal"

export type SymmetryLevel = {
    id: string
    name: string
    hint: string
    size: number
    axis: SymmetryAxis
    /** 完整目标图案，1 = 填色 */
    target: number[][]
}

export type SymmetryStats = {
    totalGames: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
}

const STATS_KEY = "symmetry_stats"
const EMPTY_STATS: SymmetryStats = { totalGames: 0, solvedLevels: [], bestTimes: {} }

function mirrorCell(r: number, c: number, size: number, axis: SymmetryAxis): { r: number; c: number } {
    if (axis === "vertical") return { r, c: size - 1 - c }
    return { r: size - 1 - r, c }
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

export const SYMMETRY_LEVELS: SymmetryLevel[] = [
    {
        id: "butterfly",
        name: "蝴蝶",
        hint: "点左边，右边会镜像同步。先画翅膀外轮廓。",
        size: 6,
        axis: "vertical",
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
        hint: "心形左右对称，注意底部尖角只占中间两列。",
        size: 6,
        axis: "vertical",
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
        hint: "上下对称：画上半，下半自动出现。",
        size: 6,
        axis: "horizontal",
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
        hint: "8×8 竖轴对称，先铺中间十字再补斜边。",
        size: 8,
        axis: "vertical",
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
        hint: "眼睛和嘴都对称，别漏掉脸颊两笔。",
        size: 8,
        axis: "vertical",
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
]

function emptyGrid(size: number): number[][] {
    return Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
}

function loadStats(): SymmetryStats {
    const raw = getPlaygroundItem<Partial<SymmetryStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: SymmetryStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useSymmetry() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [grid, setGrid] = useState<number[][]>(() => emptyGrid(SYMMETRY_LEVELS[0].size))
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<SymmetryStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const level = SYMMETRY_LEVELS[levelIndex]
    const progress = useMemo(() => {
        let matched = 0
        let total = 0
        for (let r = 0; r < level.target.length; r += 1) {
            for (let c = 0; c < level.target[r].length; c += 1) {
                if (level.target[r][c] === 1) {
                    total += 1
                    if (grid[r]?.[c] === 1) matched += 1
                }
            }
        }
        return { matched, total }
    }, [grid, level.target])

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: SymmetryLevel, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousBest = prev.bestTimes[solvedLevel.id]
            const updated: SymmetryStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestTimes: {
                    ...prev.bestTimes,
                    [solvedLevel.id]: previousBest ? Math.min(previousBest, seconds) : seconds,
                },
            }
            saveStats(updated)
            return updated
        })
    }, [])

    const paint = useCallback(
        (row: number, col: number) => {
            if (status === "solved") return
            setGrid((prev) => {
                const next = applySymmetryPaint(prev, row, col, level.axis)
                if (isSymmetrySolved(next, level.target)) {
                    recordSolve(level, time)
                }
                return next
            })
        },
        [level, recordSolve, status, time],
    )

    const startLevel = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(SYMMETRY_LEVELS.length - 1, index))
        solvedRecordedRef.current = false
        setLevelIndex(nextIndex)
        setGrid(emptyGrid(SYMMETRY_LEVELS[nextIndex].size))
        setTime(0)
        setStatus("playing")
    }, [])

    const clear = useCallback(() => {
        if (status === "solved") return
        setGrid(emptyGrid(level.size))
    }, [level.size, status])

    return {
        level,
        levelIndex,
        levelCount: SYMMETRY_LEVELS.length,
        grid,
        progress,
        time,
        status,
        stats,
        paint,
        clear,
        startLevel,
    }
}
