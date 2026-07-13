import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type MazeSize = 9 | 13 | 17 | 21 | 25
export type MazeAlgorithm = "bfs" | "dfs" | "astar"
export type MazePoint = { row: number; col: number }
/** 0 北 · 1 东 · 2 南 · 3 西 */
export type MazeFacing = 0 | 1 | 2 | 3
export type MazeMoveDirection = "up" | "right" | "down" | "left"

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

export type MazeComplexity = {
    deadEnds: number
    junctions: number
    misleadingBranches: number
    routeJunctions: number
    routeChoices: number
    pathSteps: number
}

const STATS_KEY = "maze_runner_stats"
const EMPTY_STATS: MazeStats = { totalGames: 0, wins: 0, bestSteps: {} }
const DEMO_TICK_MS = 30
const DEMO_CELLS_PER_TICK = 2
const DEFAULT_MAZE_SEED = 20260616

export const FACING_DELTAS: MazePoint[] = [
    { row: -1, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
]

export const MOVE_FACING: Record<MazeMoveDirection, MazeFacing> = {
    up: 0,
    right: 1,
    down: 2,
    left: 3,
}

const DELTAS = FACING_DELTAS

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

function generateBacktrackerMazeCandidate(size: MazeSize, seed: number): boolean[][] {
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

function generatePrimMazeCandidate(size: MazeSize, seed: number): boolean[][] {
    const random = createSeededRandom(seed)
    const maze = Array.from({ length: size }, () => Array(size).fill(true))
    const visited = new Set<string>()
    const frontier: MazePoint[] = []
    const frontierKeys = new Set<string>()

    const addFrontier = (row: number, col: number) => {
        for (const dir of DELTAS) {
            const nextRow = row + dir.row * 2
            const nextCol = col + dir.col * 2
            const nextKey = `${nextRow},${nextCol}`
            if (nextRow <= 0 || nextRow >= size - 1 || nextCol <= 0 || nextCol >= size - 1) continue
            if (visited.has(nextKey) || frontierKeys.has(nextKey)) continue
            frontier.push({ row: nextRow, col: nextCol })
            frontierKeys.add(nextKey)
        }
    }

    const markVisited = (row: number, col: number) => {
        visited.add(`${row},${col}`)
        maze[row][col] = false
        addFrontier(row, col)
    }

    markVisited(1, 1)

    while (frontier.length > 0) {
        const frontierIndex = Math.floor(random() * frontier.length)
        const cell = frontier.splice(frontierIndex, 1)[0]
        frontierKeys.delete(key(cell))

        const connectedNeighbors = DELTAS
            .map((dir) => ({
                row: cell.row + dir.row * 2,
                col: cell.col + dir.col * 2,
            }))
            .filter((neighbor) => visited.has(key(neighbor)))

        if (connectedNeighbors.length === 0) continue
        const neighbor = connectedNeighbors[Math.floor(random() * connectedNeighbors.length)]
        maze[(cell.row + neighbor.row) / 2][(cell.col + neighbor.col) / 2] = false
        markVisited(cell.row, cell.col)
    }

    maze[size - 2][size - 2] = false
    return maze
}

function generateMazeCandidate(size: MazeSize, seed: number, attempt: number): boolean[][] {
    return attempt % 3 === 1
        ? generatePrimMazeCandidate(size, seed)
        : generateBacktrackerMazeCandidate(size, seed)
}

function countOpenings(maze: boolean[][], point: MazePoint): number {
    let openings = 0
    for (const delta of DELTAS) {
        if (maze[point.row + delta.row]?.[point.col + delta.col] === false) openings++
    }
    return openings
}

export function analyzeMazeComplexity(maze: boolean[][]): MazeComplexity {
    let deadEnds = 0
    let junctions = 0
    let misleadingBranches = 0
    let routeJunctions = 0
    let routeChoices = 0
    const path = solveMaze(maze, "bfs")
    const pathSet = new Set(path.map(key))

    for (let row = 1; row < maze.length - 1; row++) {
        for (let col = 1; col < maze.length - 1; col++) {
            if (maze[row][col]) continue
            const point = { row, col }
            const openings = countOpenings(maze, point)
            if (openings === 1) deadEnds++
            if (openings === 1 && !pathSet.has(key(point))) misleadingBranches++
            if (openings >= 3) junctions++
        }
    }

    for (let index = 1; index < path.length - 1; index++) {
        const point = path[index]
        const previous = path[index - 1]
        const next = path[index + 1]
        const wrongTurns = neighbors(point, maze).filter((neighbor) =>
            key(neighbor) !== key(previous) && key(neighbor) !== key(next)
        ).length
        if (wrongTurns > 0) {
            routeJunctions++
            routeChoices += wrongTurns
        }
    }

    return {
        deadEnds,
        junctions,
        misleadingBranches,
        routeJunctions,
        routeChoices,
        pathSteps: Math.max(0, path.length - 1),
    }
}

/**
 * 每一局都会从多张候选迷宫中选择岔路和死胡同更多的一张。
 * Prim 候选带来更密集的短岔路，回溯候选保留长走廊；最终仍是唯一解迷宫。
 */
export function generateMaze(size: MazeSize, seed = Date.now()): boolean[][] {
    const attemptsBySize: Record<MazeSize, number> = {
        9: 12,
        13: 24,
        17: 32,
        21: 44,
        25: 56,
    }
    const attempts = attemptsBySize[size]
    let bestMaze = generateMazeCandidate(size, seed, 0)
    let bestScore = -1

    for (let attempt = 0; attempt < attempts; attempt++) {
        const candidateSeed = seed ^ Math.imul(attempt + 1, 0x9e3779b1)
        const candidate = generateMazeCandidate(size, candidateSeed, attempt)
        const complexity = analyzeMazeComplexity(candidate)
        const minimumRouteSteps = (size - 1) * 2.2
        const directRoutePenalty = Math.max(0, minimumRouteSteps - complexity.pathSteps) * 22
        const score =
            complexity.routeChoices * 34
            + complexity.routeJunctions * 21
            + complexity.misleadingBranches * 5
            + complexity.junctions * 4
            + complexity.pathSteps * 1.8
            - directRoutePenalty
        if (score > bestScore) {
            bestMaze = candidate
            bestScore = score
        }
    }

    return bestMaze
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

function isWall(maze: boolean[][], point: MazePoint): boolean {
    return maze[point.row]?.[point.col] !== false
}

function isGoalCell(maze: boolean[][], point: MazePoint): boolean {
    const goalRow = maze.length - 2
    const goalCol = maze.length - 2
    return point.row === goalRow && point.col === goalCol
}

export function getStartingFacing(maze: boolean[][]): MazeFacing {
    const start = { row: 1, col: 1 }
    const opening = FACING_DELTAS.findIndex((delta) => !isWall(maze, {
        row: start.row + delta.row,
        col: start.col + delta.col,
    }))
    return (opening >= 0 ? opening : 2) as MazeFacing
}

export function getAbsoluteMoves(
    maze: boolean[][],
    player: MazePoint,
): Record<MazeMoveDirection, boolean> {
    const canMove = (direction: MazeMoveDirection) => {
        const delta = FACING_DELTAS[MOVE_FACING[direction]]
        return !isWall(maze, {
            row: player.row + delta.row,
            col: player.col + delta.col,
        })
    }

    return {
        up: canMove("up"),
        right: canMove("right"),
        down: canMove("down"),
        left: canMove("left"),
    }
}

/** 可见格：玩家周围曼哈顿距离 2 以内，保持局部可读但不暴露全图。 */
export function computeVisibleCells(
    maze: boolean[][],
    player: MazePoint,
    _facing: MazeFacing,
): Set<string> {
    const visible = new Set<string>()
    for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
        for (let colOffset = -2; colOffset <= 2; colOffset++) {
            if (Math.abs(rowOffset) + Math.abs(colOffset) > 2) continue
            const row = player.row + rowOffset
            const col = player.col + colOffset
            if (row < 0 || row >= maze.length || col < 0 || col >= maze.length) continue
            visible.add(`${row},${col}`)
        }
    }
    return visible
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

function mergeExplored(previous: Set<string>, visible: Set<string>): Set<string> {
    const next = new Set(previous)
    for (const cell of visible) next.add(cell)
    return next
}

export function useMazeRunner(initialSize: MazeSize = 13) {
    const [initialGame] = useState(() => {
        const initialMaze = generateMaze(initialSize, DEFAULT_MAZE_SEED)
        return {
            maze: initialMaze,
            facing: getStartingFacing(initialMaze),
        }
    })
    const [size, setSize] = useState<MazeSize>(initialSize)
    const [maze, setMaze] = useState<boolean[][]>(initialGame.maze)
    const [player, setPlayer] = useState<MazePoint>({ row: 1, col: 1 })
    const [facing, setFacing] = useState<MazeFacing>(initialGame.facing)
    const [steps, setSteps] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [trail, setTrail] = useState<MazePoint[]>([{ row: 1, col: 1 }])
    const [demo, setDemo] = useState<MazeDemo | null>(null)
    const [stats, setStats] = useState<MazeStats>(() => ({ ...EMPTY_STATS, bestSteps: {} }))
    const [exploredCells, setExploredCells] = useState<Set<string>>(() =>
        computeVisibleCells(initialGame.maze, { row: 1, col: 1 }, initialGame.facing),
    )
    const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    const visibleCells = useMemo(
        () => computeVisibleCells(maze, player, facing),
        [maze, player, facing],
    )

    const absoluteMoves = useMemo(
        () => getAbsoluteMoves(maze, player),
        [maze, player],
    )

    // 最短步数（BFS 路径长 - 1），闯关中不展示
    const optimalSteps = useMemo(() => {
        const path = exploreMaze(maze, "bfs").path
        return path.length > 0 ? path.length - 1 : 0
    }, [maze])

    const algorithmComparison = useMemo(() => compareMazeAlgorithms(maze), [maze])

    useEffect(() => {
        setExploredCells((previous) => mergeExplored(previous, visibleCells))
    }, [visibleCells])

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
            const nextMaze = generateMaze(nextSize, nextSeed)
            const start = { row: 1, col: 1 }
            const startFacing = getStartingFacing(nextMaze)
            clearDemo()
            setSize(nextSize)
            setMaze(nextMaze)
            setPlayer(start)
            setFacing(startFacing)
            setSteps(0)
            setStatus("playing")
            setTrail([start])
            setExploredCells(computeVisibleCells(nextMaze, start, startFacing))
        },
        [clearDemo, size],
    )

    const move = useCallback(
        (direction: MazeMoveDirection) => {
            if (status === "won") return false
            const nextFacing = MOVE_FACING[direction]
            const delta = FACING_DELTAS[nextFacing]
            const next = { row: player.row + delta.row, col: player.col + delta.col }

            setFacing(nextFacing)
            if (isWall(maze, next)) return false

            const nextSteps = steps + 1
            setPlayer(next)
            setSteps(nextSteps)
            setTrail((current) => [...current, next])

            if (isGoalCell(maze, next)) {
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

            return true
        },
        [maze, player, size, status, steps],
    )

    const revealed = status === "won"
    return {
        size,
        maze,
        player,
        facing,
        steps,
        status,
        trail,
        demo,
        optimalSteps,
        algorithmComparison,
        stats,
        visibleCells,
        exploredCells,
        absoluteMoves,
        revealed,
        runDemo,
        clearDemo,
        startNewGame,
        move,
    }
}
