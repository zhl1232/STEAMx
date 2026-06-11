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
    challengesSolved: string[]
    challengeStars: Record<string, number>
}

export type LifeChallengeGoal =
    | { type: "stable"; generations: number; minPopulation: number }
    | { type: "oscillator"; generations: number }
    | { type: "survive"; generations: number; minPopulation: number }
    | { type: "delivery"; generations: number; target: { row: number; col: number; rows: number; cols: number } }
    | { type: "extinction"; generations: number }

export type LifeChallenge = {
    id: string
    name: string
    description: string
    objective: string
    maxCells: number
    starCells: [number, number, number]
    goal: LifeChallengeGoal
    starterCells?: number[][]
}

export type LifeChallengeResult = {
    solved: boolean
    stars: number
    generation: number
    population: number
    message: string
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
    challengesSolved: [],
    challengeStars: {},
}

export const LIFE_CHALLENGES: LifeChallenge[] = [
    {
        id: "block-still-life",
        name: "静物方块",
        description: "用 4 个细胞做出不会变化的 2×2 方块。",
        objective: "4 代后仍保持至少 4 个细胞稳定存活。",
        maxCells: 6,
        starCells: [4, 5, 6],
        goal: { type: "stable", generations: 4, minPopulation: 4 },
    },
    {
        id: "blinker-cycle",
        name: "闪烁器",
        description: "摆出一条 3 格直线，让它每 2 代回到原样。",
        objective: "2 代后图案与初始状态一致。",
        maxCells: 5,
        starCells: [3, 4, 5],
        goal: { type: "oscillator", generations: 2 },
    },
    {
        id: "tiny-colony",
        name: "小型聚落",
        description: "用有限细胞创造一个能延续一段时间的群落。",
        objective: "20 代后仍至少有 6 个活细胞。",
        maxCells: 12,
        starCells: [8, 10, 12],
        goal: { type: "survive", generations: 20, minPopulation: 6 },
    },
    {
        id: "glider-mail",
        name: "滑翔机快递",
        description: "让滑翔机把生命信号送进右下角目标区。",
        objective: "16 代后目标区内至少出现 1 个活细胞。",
        maxCells: 7,
        starCells: [5, 6, 7],
        starterCells: [
            [10, 11],
            [11, 12],
            [12, 10],
            [12, 11],
            [12, 12],
        ],
        goal: { type: "delivery", generations: 16, target: { row: 14, col: 14, rows: 8, cols: 8 } },
    },
    {
        id: "r-pentomino-seed",
        name: "R-五联骨牌",
        description: "观察一个小种子如何持续产生复杂结构。",
        objective: "80 代后仍至少有 20 个活细胞。",
        maxCells: 5,
        starCells: [5, 5, 5],
        starterCells: [
            [18, 29],
            [18, 30],
            [19, 28],
            [19, 29],
            [20, 29],
        ],
        goal: { type: "survive", generations: 80, minPopulation: 20 },
    },
    {
        id: "clean-extinction",
        name: "归零实验",
        description: "设计一个会自行消亡的图案，理解孤独与拥挤。",
        objective: "8 代内所有细胞全部灭绝。",
        maxCells: 10,
        starCells: [4, 7, 10],
        goal: { type: "extinction", generations: 8 },
    },
    {
        id: "pulsar-heart",
        name: "脉冲星心跳",
        description: "用脉冲星观察周期结构的回归。",
        objective: "3 代后图案与初始状态一致。",
        maxCells: 48,
        starCells: [48, 48, 48],
        // 标准脉冲星（周期 3，共 48 格）：横竖各 4 条 6 格短杠
        starterCells: (() => {
            const cells: number[][] = []
            const base = { row: 12, col: 24 }
            const bars = [0, 5, 7, 12]
            const spans = [2, 3, 4, 8, 9, 10]
            for (const bar of bars) {
                for (const span of spans) {
                    cells.push([base.row + bar, base.col + span])
                    cells.push([base.row + span, base.col + bar])
                }
            }
            return cells
        })(),
        goal: { type: "oscillator", generations: 3 },
    },
    {
        id: "long-watch",
        name: "长程观测",
        description: "让随机般的初态熬过更长时间。",
        objective: "120 代后仍至少有 12 个活细胞。",
        maxCells: 30,
        starCells: [16, 22, 30],
        goal: { type: "survive", generations: 120, minPopulation: 12 },
    },
]

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

function gridsEqual(a: boolean[][], b: boolean[][]): boolean {
    if (a.length !== b.length) return false
    for (let row = 0; row < a.length; row++) {
        if (a[row].length !== b[row].length) return false
        for (let col = 0; col < a[row].length; col++) {
            if (a[row][col] !== b[row][col]) return false
        }
    }
    return true
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

export { countPopulation, createEmptyGrid, nextGeneration }

/** 连续演化若干代，返回最终网格（用于挑战结果回放展示） */
export function evolveGrid(grid: boolean[][], generations: number): boolean[][] {
    let current = grid.map((row) => [...row])
    for (let generation = 0; generation < generations; generation++) {
        current = nextGeneration(current)
    }
    return current
}

export function evaluateLifeChallenge(grid: boolean[][], challenge: LifeChallenge): LifeChallengeResult {
    const initialPopulation = countPopulation(grid)
    if (initialPopulation === 0) {
        return {
            solved: false,
            stars: 0,
            generation: 0,
            population: 0,
            message: "先在网格上放置一些活细胞。",
        }
    }
    if (initialPopulation > challenge.maxCells) {
        return {
            solved: false,
            stars: 0,
            generation: 0,
            population: initialPopulation,
            message: `细胞预算超出 ${initialPopulation - challenge.maxCells} 个，先删掉一些细胞。`,
        }
    }

    let current = grid.map((row) => [...row])
    let previous = current
    for (let generation = 1; generation <= challenge.goal.generations; generation++) {
        previous = current
        current = nextGeneration(current)
    }

    const population = countPopulation(current)
    const solved = (() => {
        switch (challenge.goal.type) {
            case "stable":
                return population >= challenge.goal.minPopulation && gridsEqual(current, previous)
            case "oscillator":
                return gridsEqual(current, grid)
            case "survive":
                return population >= challenge.goal.minPopulation
            case "delivery": {
                const { row, col, rows, cols } = challenge.goal.target
                for (let r = row; r < row + rows; r++) {
                    for (let c = col; c < col + cols; c++) {
                        if (current[r]?.[c]) return true
                    }
                }
                return false
            }
            case "extinction":
                return population === 0
        }
    })()

    const stars = solved
        ? initialPopulation <= challenge.starCells[0]
            ? 3
            : initialPopulation <= challenge.starCells[1]
                ? 2
                : 1
        : 0

    return {
        solved,
        stars,
        generation: challenge.goal.generations,
        population,
        message: solved
            ? `挑战成功：演化 ${challenge.goal.generations} 代后达成目标。`
            : `还没达成：演化 ${challenge.goal.generations} 代后剩余 ${population} 个活细胞。`,
    }
}

// ── Stats persistence ────────────────────────────────────────────────

function loadStats(): GameOfLifeStats {
    const p = getPlaygroundItem<Partial<GameOfLifeStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS }
    return {
        totalSessions: p.totalSessions ?? 0,
        maxGeneration: p.maxGeneration ?? 0,
        maxPopulation: p.maxPopulation ?? 0,
        challengesSolved: Array.isArray(p.challengesSolved) ? p.challengesSolved.filter((id): id is string => typeof id === "string") : [],
        challengeStars: p.challengeStars && typeof p.challengeStars === "object" && !Array.isArray(p.challengeStars)
            ? Object.fromEntries(
                Object.entries(p.challengeStars)
                    .filter(([, value]) => typeof value === "number")
                    .map(([key, value]) => [key, Math.max(0, Math.min(3, Math.floor(value as number)))]),
            )
            : {},
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

    const randomizeWithDensity = useCallback((density: number) => {
        stopInterval()
        const clampedDensity = Math.max(0.05, Math.min(0.6, density))
        const newGrid = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => Math.random() < clampedDensity),
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

    const loadCells = useCallback((cells: number[][]) => {
        stopInterval()
        const newGrid = createEmptyGrid(rows, cols)
        for (const [row, col] of cells) {
            if (row >= 0 && row < rows && col >= 0 && col < cols) {
                newGrid[row][col] = true
            }
        }
        setGrid(newGrid)
        setGeneration(0)
        setStatus("idle")
        sessionCountedRef.current = false
    }, [rows, cols, stopInterval])

    /** 直接展示某个网格状态（如挑战演化结果回放、恢复设计稿） */
    const applyGrid = useCallback((nextGrid: boolean[][], nextGeneration: number) => {
        stopInterval()
        setGrid(nextGrid.map((row) => [...row]))
        setGeneration(nextGeneration)
        setStatus("idle")
    }, [stopInterval])

    const recordChallengeResult = useCallback((challengeId: string, stars: number) => {
        if (stars <= 0) return
        persistStats((prev) => {
            const challengesSolved = prev.challengesSolved.includes(challengeId)
                ? prev.challengesSolved
                : [...prev.challengesSolved, challengeId]
            const previousStars = prev.challengeStars[challengeId] ?? 0
            return {
                ...prev,
                challengesSolved,
                challengeStars: {
                    ...prev.challengeStars,
                    [challengeId]: Math.max(previousStars, stars),
                },
            }
        })
    }, [persistStats])

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
        randomizeWithDensity,
        setSpeed,
        loadPreset,
        loadCells,
        applyGrid,
        recordChallengeResult,
        resetStats,
    }
}
