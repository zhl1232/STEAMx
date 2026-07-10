import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type MazeSize = 9 | 13 | 17
export type MazeAlgorithm = "bfs" | "dfs" | "astar"
export type MazePoint = { row: number; col: number }
export type MazeStats = {
    totalGames: number
    wins: number
    bestSteps: Record<string, number>
}

export type MazeDemo = {
    algorithm: MazeAlgorithm
    visited: MazePoint[]
    path: MazePoint[]
    progress: number
    done: boolean
}

export type MazeAlgorithmComparison = {
    algorithm: MazeAlgorithm
    visitedCount: number
    pathSteps: number
    isShortest: boolean
}

const STATS_KEY = "maze_runner_stats"
const EMPTY_STATS: MazeStats = { totalGames: 0, wins: 0, bestSteps: {} }
const DEMO_TICK_MS = 30
const DEMO_CELLS_PER_TICK = 2
const DEFAULT_MAZE_SEED = 20260616
const DELTAS: MazePoint[] = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
]

function key(point: MazePoint): string {
    return `${point.row},${point.col}`
}

function loadStats(): MazeStats {
    const raw = getPlaygroundItem<Partial<MazeStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        wins: typeof raw.wins === "number" ? raw.wins : 0,
        bestSteps: raw.bestSteps && typeof raw.bestSteps === "object" ? raw.bestSteps : {},
    }
}

function saveStats(stats: MazeStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

function createSeededRandom(seed: number) {
    let value = seed >>> 0
    return () => {
        value = (value * 1664525 + 1013904223) >>> 0
        return value / 0x100000000
    }
}

function shuffleWithRandom<T>(items: T[], random: () => number): T[] {
    const shuffled = [...items]
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(random() * (index + 1))
        const current = shuffled[index]
        shuffled[index] = shuffled[swapIndex]
        shuffled[swapIndex] = current
    }
    return shuffled
}

export function generateMaze(size: MazeSize, seed = Date.now()): boolean[][] {
    const random = createSeededRandom(seed)
    const maze = Array.from({ length: size }, () => Array(size).fill(true))
    const carve = (row: number, col: number) => {
        maze[row][col] = false
        const dirs = shuffleWithRandom(DELTAS, random)
        for (const dir of dirs) {
            const nextRow = row + dir.row * 2
            const nextCol = col + dir.col * 2
            if (nextRow <= 0 || nextRow >= size - 1 || nextCol <= 0 || nextCol >= size - 1) continue
            if (!maze[nextRow][nextCol]) continue
            maze[row + dir.row][col + dir.col] = false
            carve(nextRow, nextCol)
        }
    }
    carve(1, 1)
    maze[1][1] = false
    maze[size - 2][size - 2] = false
    return maze
}

function neighbors(point: MazePoint, maze: boolean[][]): MazePoint[] {
    const result: MazePoint[] = []
    for (const delta of DELTAS) {
        const next = { row: point.row + delta.row, col: point.col + delta.col }
        if (!maze[next.row]?.[next.col]) result.push(next)
    }
    return result
}

function heuristic(a: MazePoint, b: MazePoint): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

/** 求解迷宫并记录访问顺序，用于算法可视化（A* 使用 g+h 估价） */
export function exploreMaze(maze: boolean[][], algorithm: MazeAlgorithm): { visited: MazePoint[]; path: MazePoint[] } {
    const start = { row: 1, col: 1 }
    const goal = { row: maze.length - 2, col: maze.length - 2 }
    const frontier: Array<{ point: MazePoint; cost: number }> = [{ point: start, cost: 0 }]
    const cameFrom = new Map<string, string | null>([[key(start), null]])
    const visited: MazePoint[] = []
    const seen = new Set<string>([key(start)])

    while (frontier.length > 0) {
        if (algorithm === "astar") {
            frontier.sort(
                (a, b) => a.cost + heuristic(a.point, goal) - (b.cost + heuristic(b.point, goal)),
            )
        }
        const current = algorithm === "dfs" ? frontier.pop()! : frontier.shift()!
        visited.push(current.point)
        if (key(current.point) === key(goal)) break
        for (const next of neighbors(current.point, maze)) {
            const nextKey = key(next)
            if (seen.has(nextKey)) continue
            seen.add(nextKey)
            cameFrom.set(nextKey, key(current.point))
            frontier.push({ point: next, cost: current.cost + 1 })
        }
    }

    const path: MazePoint[] = []
    let cursor: string | null | undefined = key(goal)
    if (!cameFrom.has(cursor)) return { visited, path: [] }
    while (cursor) {
        const [row, col] = cursor.split(",").map(Number)
        path.push({ row, col })
        cursor = cameFrom.get(cursor)
    }
    return { visited, path: path.reverse() }
}

export function solveMaze(maze: boolean[][], algorithm: MazeAlgorithm): MazePoint[] {
    return exploreMaze(maze, algorithm).path
}

export function compareMazeAlgorithms(maze: boolean[][]): MazeAlgorithmComparison[] {
    const results = (["bfs", "dfs", "astar"] as MazeAlgorithm[]).map((algorithm) => {
        const result = exploreMaze(maze, algorithm)
        return {
            algorithm,
            visitedCount: result.visited.length,
            pathSteps: Math.max(result.path.length - 1, 0),
            isShortest: false,
        }
    })
    const shortestPath = Math.min(...results.map((result) => result.pathSteps).filter((steps) => steps > 0))

    return results.map((result) => ({
        ...result,
        isShortest: result.pathSteps === shortestPath,
    }))
}

export function useMazeRunner(initialSize: MazeSize = 13) {
    const [size, setSize] = useState<MazeSize>(initialSize)
    const [maze, setMaze] = useState<boolean[][]>(() => generateMaze(initialSize, DEFAULT_MAZE_SEED))
    const [player, setPlayer] = useState<MazePoint>({ row: 1, col: 1 })
    const [steps, setSteps] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [demo, setDemo] = useState<MazeDemo | null>(null)
    const [stats, setStats] = useState<MazeStats>(() => ({ ...EMPTY_STATS, bestSteps: {} }))
    const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    // 最短步数（BFS 路径长 - 1），只展示数字、不暴露路线
    const optimalSteps = useMemo(() => {
        const path = exploreMaze(maze, "bfs").path
        return path.length > 0 ? path.length - 1 : 0
    }, [maze])

    const algorithmComparison = useMemo(() => compareMazeAlgorithms(maze), [maze])

    const stopDemoTimer = useCallback(() => {
        if (demoTimerRef.current !== null) {
            clearInterval(demoTimerRef.current)
            demoTimerRef.current = null
        }
    }, [])

    const clearDemo = useCallback(() => {
        stopDemoTimer()
        setDemo(null)
    }, [stopDemoTimer])

    /** 播放算法探索动画：先按访问顺序点亮，再显示最终路径 */
    const runDemo = useCallback(
        (algorithm: MazeAlgorithm) => {
            stopDemoTimer()
            const { visited, path } = exploreMaze(maze, algorithm)
            setDemo({ algorithm, visited, path, progress: 0, done: false })
            demoTimerRef.current = setInterval(() => {
                setDemo((current) => {
                    if (!current) return current
                    const progress = Math.min(current.visited.length, current.progress + DEMO_CELLS_PER_TICK)
                    if (progress >= current.visited.length) {
                        stopDemoTimer()
                        return { ...current, progress, done: true }
                    }
                    return { ...current, progress }
                })
            }, DEMO_TICK_MS)
        },
        [maze, stopDemoTimer],
    )

    useEffect(() => stopDemoTimer, [stopDemoTimer])

    const startNewGame = useCallback(
        (nextSize: MazeSize = size) => {
            const nextSeed = Date.now()
            clearDemo()
            setSize(nextSize)
            setMaze(generateMaze(nextSize, nextSeed))
            setPlayer({ row: 1, col: 1 })
            setSteps(0)
            setStatus("playing")
        },
        [clearDemo, size],
    )

    const move = useCallback(
        (delta: MazePoint) => {
            if (status === "won") return
            const next = { row: player.row + delta.row, col: player.col + delta.col }
            if (maze[next.row]?.[next.col] !== false) return

            const nextSteps = steps + 1
            setPlayer(next)
            setSteps(nextSteps)

            if (next.row === size - 2 && next.col === size - 2) {
                setStatus("won")
                setStats((prev) => {
                    const updated = {
                        totalGames: prev.totalGames + 1,
                        wins: prev.wins + 1,
                        bestSteps: {
                            ...prev.bestSteps,
                            [size]: prev.bestSteps[size] ? Math.min(prev.bestSteps[size], nextSteps) : nextSteps,
                        },
                    }
                    saveStats(updated)
                    return updated
                })
            }
        },
        [maze, player, size, status, steps],
    )

    return {
        size,
        maze,
        player,
        steps,
        status,
        demo,
        optimalSteps,
        algorithmComparison,
        stats,
        runDemo,
        clearDemo,
        startNewGame,
        move,
    }
}
