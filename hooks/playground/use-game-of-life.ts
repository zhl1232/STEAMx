import { useCallback, useEffect, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export type GameOfLifeStatus = "idle" | "running" | "paused"

export type GameOfLifeSpeed = "slow" | "normal" | "fast"

export type GameOfLifePreset =
    | "glider"
    | "blinker"
    | "pulsar"
    | "gosper-glider-gun"
    | "r-pentomino"

export type GameOfLifeStats = {
    totalSessions: number
    maxGeneration: number
    maxPopulation: number
}

const DEFAULT_ROWS = 40
const DEFAULT_COLS = 60
const STATS_KEY = "game_of_life_stats"

const SPEED_MS: Record<GameOfLifeSpeed, number> = {
    slow: 500,
    normal: 200,
    fast: 50,
}

const EMPTY_STATS: GameOfLifeStats = {
    totalSessions: 0,
    maxGeneration: 0,
    maxPopulation: 0,
}

// ── Grid utilities ───────────────────────────────────────────────────

function createEmptyGrid(rows: number, cols: number): boolean[][] {
    return Array.from({ length: rows }, () => Array(cols).fill(false) as boolean[])
}

function countPopulation(grid: boolean[][]): number {
    let count = 0
    for (const row of grid) {
        for (const cell of row) {
            if (cell) count++
        }
    }
    return count
}

function nextGeneration(grid: boolean[][]): boolean[][] {
    const rows = grid.length
    const cols = grid[0].length
    const next = createEmptyGrid(rows, cols)

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            let neighbors = 0
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue
                    const nr = r + dr
                    const nc = c + dc
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && grid[nr][nc]) {
                        neighbors++
                    }
                }
            }

            if (grid[r][c]) {
                next[r][c] = neighbors === 2 || neighbors === 3
            } else {
                next[r][c] = neighbors === 3
            }
        }
    }

    return next
}

// ── Stats persistence ────────────────────────────────────────────────

function loadStats(): GameOfLifeStats {
    const p = getPlaygroundItem<Partial<GameOfLifeStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS }
    return {
        totalSessions: p.totalSessions ?? 0,
        maxGeneration: p.maxGeneration ?? 0,
        maxPopulation: p.maxPopulation ?? 0,
    }
}

function saveStats(stats: GameOfLifeStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

// ── Preset patterns ──────────────────────────────────────────────────
// Each preset is an array of [row, col] offsets relative to center placement.

const PRESETS: Record<GameOfLifePreset, number[][]> = {
    glider: [
        [0, 1],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
    ],
    blinker: [
        [0, 0],
        [0, 1],
        [0, 2],
    ],
    pulsar: (() => {
        const offsets: number[][] = []
        const rows = [1, 2, 3, 8, 9, 10]
        const cols = [5, 11]
        for (const r of rows) {
            for (const c of cols) {
                offsets.push([r, c])
            }
        }
        const cols2 = [1, 2, 3, 8, 9, 10]
        const rows2 = [5, 11]
        for (const r of rows2) {
            for (const c of cols2) {
                offsets.push([r, c])
            }
        }
        return offsets
    })(),
    "gosper-glider-gun": [
        [0, 24],
        [1, 22], [1, 24],
        [2, 12], [2, 13], [2, 20], [2, 21], [2, 34], [2, 35],
        [3, 11], [3, 15], [3, 20], [3, 21], [3, 34], [3, 35],
        [4, 0], [4, 1], [4, 10], [4, 16], [4, 20], [4, 21],
        [5, 0], [5, 1], [5, 10], [5, 14], [5, 16], [5, 17], [5, 22], [5, 24],
        [6, 10], [6, 16], [6, 24],
        [7, 11], [7, 15],
        [8, 12], [8, 13],
    ],
    "r-pentomino": [
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
        [2, 1],
    ],
}

// ── React Hook ───────────────────────────────────────────────────────

export function useGameOfLife(rows = DEFAULT_ROWS, cols = DEFAULT_COLS) {
    const [grid, setGrid] = useState<boolean[][]>(() => createEmptyGrid(rows, cols))
    const [generation, setGeneration] = useState(0)
    const [status, setStatus] = useState<GameOfLifeStatus>("idle")
    const [speed, setSpeedState] = useState<GameOfLifeSpeed>("normal")
    const [stats, setStats] = useState<GameOfLifeStats>(() => loadStats())

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const speedRef = useRef<GameOfLifeSpeed>(speed)
    const gridRef = useRef(grid)
    const generationRef = useRef(generation)
    const sessionCountedRef = useRef(false)

    gridRef.current = grid
    generationRef.current = generation
    speedRef.current = speed

    const population = countPopulation(grid)

    const persistStats = useCallback((updater: (prev: GameOfLifeStats) => GameOfLifeStats) => {
        setStats((prev) => {
            const next = updater(prev)
            saveStats(next)
            return next
        })
    }, [])

    const updateMaxStats = useCallback(
        (gen: number, pop: number) => {
            persistStats((prev) => {
                if (gen <= prev.maxGeneration && pop <= prev.maxPopulation) return prev
                return {
                    ...prev,
                    maxGeneration: Math.max(prev.maxGeneration, gen),
                    maxPopulation: Math.max(prev.maxPopulation, pop),
                }
            })
        },
        [persistStats],
    )

    const stopInterval = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    const stepOnce = useCallback(() => {
        setGrid((prev) => {
            const next = nextGeneration(prev)
            const pop = countPopulation(next)
            const gen = generationRef.current + 1
            setGeneration(gen)
            updateMaxStats(gen, pop)
            return next
        })
    }, [updateMaxStats])

    const startInterval = useCallback(() => {
        stopInterval()
        intervalRef.current = setInterval(() => {
            stepOnce()
        }, SPEED_MS[speedRef.current])
    }, [stepOnce, stopInterval])

    const toggleCell = useCallback(
        (row: number, col: number) => {
            if (status === "running") return
            setGrid((prev) => {
                const next = prev.map((r) => [...r])
                next[row][col] = !next[row][col]
                return next
            })
        },
        [status],
    )

    const start = useCallback(() => {
        if (!sessionCountedRef.current) {
            persistStats((prev) => ({
                ...prev,
                totalSessions: prev.totalSessions + 1,
            }))
            sessionCountedRef.current = true
        }
        setStatus("running")
        startInterval()
    }, [persistStats, startInterval])

    const pause = useCallback(() => {
        setStatus("paused")
        stopInterval()
    }, [stopInterval])

    const step = useCallback(() => {
        if (status === "running") return
        if (!sessionCountedRef.current) {
            persistStats((prev) => ({
                ...prev,
                totalSessions: prev.totalSessions + 1,
            }))
            sessionCountedRef.current = true
        }
        if (status === "idle") setStatus("paused")
        stepOnce()
    }, [status, persistStats, stepOnce])

    const clear = useCallback(() => {
        stopInterval()
        setGrid(createEmptyGrid(rows, cols))
        setGeneration(0)
        setStatus("idle")
        sessionCountedRef.current = false
    }, [rows, cols, stopInterval])

    const randomize = useCallback(() => {
        stopInterval()
        const newGrid = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => Math.random() < 0.3),
        )
        setGrid(newGrid)
        setGeneration(0)
        setStatus("idle")
        sessionCountedRef.current = false
    }, [rows, cols, stopInterval])

    const setSpeed = useCallback(
        (newSpeed: GameOfLifeSpeed) => {
            setSpeedState(newSpeed)
            speedRef.current = newSpeed
            if (status === "running") {
                startInterval()
            }
        },
        [status, startInterval],
    )

    const loadPreset = useCallback(
        (preset: GameOfLifePreset) => {
            stopInterval()
            const newGrid = createEmptyGrid(rows, cols)
            const pattern = PRESETS[preset]

            const patternRows = Math.max(...pattern.map(([r]) => r)) + 1
            const patternCols = Math.max(...pattern.map(([, c]) => c)) + 1
            const offsetR = Math.floor((rows - patternRows) / 2)
            const offsetC = Math.floor((cols - patternCols) / 2)

            for (const [r, c] of pattern) {
                const nr = offsetR + r
                const nc = offsetC + c
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    newGrid[nr][nc] = true
                }
            }

            setGrid(newGrid)
            setGeneration(0)
            setStatus("idle")
            sessionCountedRef.current = false
        },
        [rows, cols, stopInterval],
    )

    const resetStats = useCallback(() => {
        const fresh = { ...EMPTY_STATS }
        setStats(fresh)
        saveStats(fresh)
    }, [])

    useEffect(() => {
        return () => stopInterval()
    }, [stopInterval])

    return {
        grid,
        generation,
        population,
        status,
        speed,
        stats,
        toggleCell,
        start,
        pause,
        step,
        clear,
        randomize,
        setSpeed,
        loadPreset,
        resetStats,
    }
}
