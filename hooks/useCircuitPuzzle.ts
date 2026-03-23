import { useState, useCallback, useEffect, useRef } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

// ── Types ─────────────────────────────────────────────────────────────

export type Direction = "top" | "right" | "bottom" | "left"

const OPPOSITE: Record<Direction, Direction> = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right",
}

const DIR_DELTA: Record<Direction, [number, number]> = {
    top: [-1, 0],
    right: [0, 1],
    bottom: [1, 0],
    left: [0, -1],
}

export type ComponentType =
    | "empty"
    | "wire_straight"
    | "wire_corner"
    | "wire_tee"
    | "wire_cross"
    | "battery"
    | "bulb"
    | "switch"
    | "resistor"
    | "and_gate"
    | "or_gate"
    | "not_gate"

export interface CellComponent {
    type: ComponentType
    rotation: number
    fixed: boolean
}

export interface CircuitCell {
    row: number
    col: number
    component: CellComponent
    powered: boolean
}

export interface CircuitLevel {
    id: string
    name: string
    description: string
    rows: number
    cols: number
    grid: CellComponent[][]
    difficulty: "easy" | "medium" | "hard"
    hasLogicGate: boolean
}

export type CircuitStatus = "idle" | "playing" | "solved"

export interface CircuitStats {
    totalGames: number
    solvedCount: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
}

interface CircuitProgress {
    levelIndex: number
    grid: CellComponent[][]
    status: CircuitStatus
    moves: number
    time: number
}

interface StoredCircuitData extends CircuitStats {
    progress?: string | CircuitProgress | null
}

// ── Component connectivity definitions ────────────────────────────────

/** Returns which directions a component connects to, given its rotation (0/90/180/270) */
function getConnections(type: ComponentType, rotation: number): Set<Direction> {
    const dirs: Direction[] = ["top", "right", "bottom", "left"]
    const rotate = (base: Direction[]): Set<Direction> => {
        const steps = (rotation / 90) % 4
        return new Set(base.map((d) => dirs[(dirs.indexOf(d) + steps) % 4]))
    }

    switch (type) {
        case "wire_straight":
        case "resistor":
            return rotate(["top", "bottom"])
        case "wire_corner":
            return rotate(["top", "right"])
        case "wire_tee":
            return rotate(["top", "right", "bottom"])
        case "wire_cross":
            return new Set(["top", "right", "bottom", "left"])
        case "battery":
            return rotate(["top", "bottom"])
        case "bulb":
            return rotate(["top", "bottom"])
        case "switch":
            return rotate(["top", "bottom"])
        case "and_gate":
        case "or_gate":
            return rotate(["top", "right", "bottom"])
        case "not_gate":
            return rotate(["top", "bottom"])
        default:
            return new Set()
    }
}

export { getConnections }

// ── Levels ────────────────────────────────────────────────────────────

function e(): CellComponent { return { type: "empty", rotation: 0, fixed: false } }
function ws(r = 0, fixed = false): CellComponent { return { type: "wire_straight", rotation: r, fixed } }
function wc(r = 0, fixed = false): CellComponent { return { type: "wire_corner", rotation: r, fixed } }
function wt(r = 0, fixed = false): CellComponent { return { type: "wire_tee", rotation: r, fixed } }
function bat(r = 0): CellComponent { return { type: "battery", rotation: r, fixed: true } }
function blb(r = 0): CellComponent { return { type: "bulb", rotation: r, fixed: true } }
function sw(r = 0, fixed = false): CellComponent { return { type: "switch", rotation: r, fixed } }
function res(r = 0, fixed = false): CellComponent { return { type: "resistor", rotation: r, fixed } }
function andG(r = 0, fixed = false): CellComponent { return { type: "and_gate", rotation: r, fixed } }
function orG(r = 0, fixed = false): CellComponent { return { type: "or_gate", rotation: r, fixed } }
function notG(r = 0, fixed = false): CellComponent { return { type: "not_gate", rotation: r, fixed } }

export const LEVELS: CircuitLevel[] = [
    {
        id: "simple_series",
        name: "初识电路",
        description: "旋转导线连通电池和灯泡",
        rows: 3,
        cols: 3,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [e(),      bat(),  e()     ],
            [e(),      ws(0),  e()     ],
            [e(),      blb(),  e()     ],
        ],
    },
    {
        id: "corner_turn",
        name: "拐弯前行",
        description: "使用弯角导线连通电路",
        rows: 3,
        cols: 3,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [bat(),    ws(90), e()     ],
            [e(),      e(),    e()     ],
            [e(),      ws(90), blb()   ],
        ],
    },
    {
        id: "l_shape",
        name: "L 形回路",
        description: "用弯角和直线组合一条 L 形路径",
        rows: 3,
        cols: 4,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [bat(),    ws(90), ws(90), wc(90) ],
            [e(),      e(),    e(),    ws()   ],
            [e(),      e(),    e(),    blb()  ],
        ],
    },
    {
        id: "resistor_intro",
        name: "认识电阻",
        description: "电阻不影响连通——旋转导线使电路导通",
        rows: 4,
        cols: 3,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [e(),      bat(),  e()      ],
            [e(),      res(),  e()      ],
            [e(),      ws(),   e()      ],
            [e(),      blb(),  e()      ],
        ],
    },
    {
        id: "tee_split",
        name: "三通分流",
        description: "使用 T 形导线让电路分支",
        rows: 3,
        cols: 3,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [blb(),   wt(180), blb(90) ],
            [e(),      ws(),    e()     ],
            [e(),      bat(),   e()     ],
        ],
    },
    {
        id: "parallel_circuit",
        name: "并联电路",
        description: "连接并联回路，两个灯泡都要亮",
        rows: 4,
        cols: 4,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [e(),      bat(),  e(),     e()     ],
            [wc(0),   ws(90), ws(90),  wc(90)  ],
            [blb(),    e(),    e(),     blb()   ],
            [wc(270), ws(90), ws(90),  wc(180) ],
        ],
    },
    {
        id: "switch_gate",
        name: "开关控制",
        description: "旋转开关导通电路",
        rows: 4,
        cols: 3,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [e(),     bat(),   e()    ],
            [e(),     sw(),    e()    ],
            [e(),     ws(),    e()    ],
            [e(),     blb(),   e()    ],
        ],
    },
    {
        id: "and_gate_intro",
        name: "与门入门",
        description: "AND 门需要两个输入都连通才输出",
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [bat(),   e(),     bat()   ],
            [ws(),    e(),     ws()    ],
            [wc(0),  andG(90), wc(270)],
            [e(),     blb(),   e()     ],
        ],
    },
    {
        id: "or_gate_intro",
        name: "或门入门",
        description: "OR 门只需一个输入连通即可输出",
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [bat(),   e(),     e()     ],
            [ws(),    e(),     e()     ],
            [wc(0),  orG(90),  wc(270)],
            [e(),     blb(),   e()     ],
        ],
    },
    {
        id: "not_gate_intro",
        name: "非门入门",
        description: "NOT 门反转信号——没有输入时灯泡反而亮",
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),     bat(),   e()    ],
            [e(),     notG(),  e()    ],
            [e(),     ws(),    e()    ],
            [e(),     blb(),   e()    ],
        ],
    },
]

// ── Circuit simulation (BFS) ──────────────────────────────────────────

function simulateCircuit(
    grid: CellComponent[][],
    rows: number,
    cols: number,
): boolean[][] {
    const powered: boolean[][] = Array.from({ length: rows }, () =>
        Array(cols).fill(false),
    )

    const queue: [number, number][] = []

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].type === "battery") {
                powered[r][c] = true
                queue.push([r, c])
            }
        }
    }

    while (queue.length > 0) {
        const [r, c] = queue.shift()!
        const cell = grid[r][c]
        const conns = getConnections(cell.type, cell.rotation)

        for (const dir of conns) {
            const [dr, dc] = DIR_DELTA[dir]
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
            if (powered[nr][nc]) continue

            const neighbor = grid[nr][nc]
            if (neighbor.type === "empty") continue

            const neighborConns = getConnections(neighbor.type, neighbor.rotation)
            if (!neighborConns.has(OPPOSITE[dir])) continue

            powered[nr][nc] = true
            queue.push([nr, nc])
        }
    }

    return powered
}

function checkAllBulbsLit(
    grid: CellComponent[][],
    powered: boolean[][],
    rows: number,
    cols: number,
): boolean {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].type === "bulb" && !powered[r][c]) {
                return false
            }
        }
    }
    return true
}

export { simulateCircuit }

// ── Stats persistence ─────────────────────────────────────────────────

const STATS_KEY = "circuit_stats"
const VALID_ROTATIONS = new Set([0, 90, 180, 270])

const EMPTY_STATS: CircuitStats = {
    totalGames: 0,
    solvedCount: 0,
    solvedLevels: [],
    bestTimes: {},
}

type CircuitInitialState = CircuitProgress & {
    stats: CircuitStats
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toSafeCount(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return 0
    }
    return Math.floor(value)
}

function normalizeStats(raw: unknown): CircuitStats {
    if (!isRecord(raw)) return { ...EMPTY_STATS }

    const validLevelIds = new Set(LEVELS.map((level) => level.id))
    const solvedLevels = Array.isArray(raw.solvedLevels)
        ? raw.solvedLevels.filter((levelId): levelId is string => typeof levelId === "string" && validLevelIds.has(levelId))
        : []

    const bestTimes = isRecord(raw.bestTimes)
        ? Object.fromEntries(
            Object.entries(raw.bestTimes)
                .filter(([levelId, value]) => validLevelIds.has(levelId) && typeof value === "number" && Number.isFinite(value) && value >= 0)
                .map(([levelId, value]) => [levelId, Math.floor(value)]),
        )
        : {}

    return {
        totalGames: toSafeCount(raw.totalGames),
        solvedCount: toSafeCount(raw.solvedCount),
        solvedLevels,
        bestTimes,
    }
}

function parseStoredProgress(raw: unknown): CircuitProgress | null {
    const parsed = typeof raw === "string"
        ? (() => {
            try {
                return JSON.parse(raw) as unknown
            } catch {
                return null
            }
        })()
        : raw

    if (!isRecord(parsed)) return null

    const levelIndex = toSafeCount(parsed.levelIndex)
    const level = LEVELS[levelIndex]
    if (!level) return null

    if (!Array.isArray(parsed.grid) || parsed.grid.length !== level.rows) {
        return null
    }

    const grid: CellComponent[][] = []

    for (let rowIndex = 0; rowIndex < level.rows; rowIndex++) {
        const storedRow = parsed.grid[rowIndex]
        if (!Array.isArray(storedRow) || storedRow.length !== level.cols) {
            return null
        }

        const nextRow: CellComponent[] = []

        for (let colIndex = 0; colIndex < level.cols; colIndex++) {
            const storedCell = storedRow[colIndex]
            const templateCell = level.grid[rowIndex][colIndex]

            if (!isRecord(storedCell)) return null
            if (storedCell.type !== templateCell.type) return null
            if (storedCell.fixed !== templateCell.fixed) return null
            if (typeof storedCell.rotation !== "number") return null

            const normalizedRotation = ((storedCell.rotation % 360) + 360) % 360
            if (!VALID_ROTATIONS.has(normalizedRotation)) return null
            if ((templateCell.fixed || templateCell.type === "empty") && normalizedRotation !== templateCell.rotation) {
                return null
            }

            nextRow.push({
                ...templateCell,
                rotation: normalizedRotation,
            })
        }

        grid.push(nextRow)
    }

    const status = parsed.status
    if (status !== "idle" && status !== "playing" && status !== "solved") {
        return null
    }

    return {
        levelIndex,
        grid,
        status,
        moves: toSafeCount(parsed.moves),
        time: toSafeCount(parsed.time),
    }
}

function buildPoweredGrid(level: CircuitLevel, grid: CellComponent[][]): boolean[][] {
    return simulateCircuit(grid, level.rows, level.cols)
}

function isLevelSolved(level: CircuitLevel, grid: CellComponent[][]): boolean {
    return checkAllBulbsLit(grid, buildPoweredGrid(level, grid), level.rows, level.cols)
}

function createPlayableGrid(level: CircuitLevel, randomFn: () => number = Math.random): CellComponent[][] {
    const grid = deepCopyGrid(level.grid)
    const rotatableCells: Array<[number, number]> = []

    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            const cell = grid[row][col]
            if (cell.fixed || cell.type === "empty") continue
            const turns = Math.floor(randomFn() * 4)
            cell.rotation = (cell.rotation + turns * 90) % 360
            rotatableCells.push([row, col])
        }
    }

    if (!isLevelSolved(level, grid)) {
        return grid
    }

    for (const [row, col] of rotatableCells) {
        const originalRotation = grid[row][col].rotation
        for (let turns = 1; turns < 4; turns++) {
            grid[row][col].rotation = (originalRotation + turns * 90) % 360
            if (!isLevelSolved(level, grid)) {
                return grid
            }
        }
        grid[row][col].rotation = originalRotation
    }

    return grid
}

function loadStoredData(): { stats: CircuitStats; progress: CircuitProgress | null } {
    const stored = getPlaygroundItem<StoredCircuitData>(STATS_KEY)
    if (!stored) {
        return {
            stats: { ...EMPTY_STATS },
            progress: null,
        }
    }

    return {
        stats: normalizeStats(stored),
        progress: parseStoredProgress(stored.progress),
    }
}

function createInitialState(): CircuitInitialState {
    const { stats, progress } = loadStoredData()

    if (progress) {
        return {
            ...progress,
            stats,
        }
    }

    return {
        levelIndex: 0,
        grid: createPlayableGrid(LEVELS[0]),
        status: "idle",
        moves: 0,
        time: 0,
        stats,
    }
}

function saveCircuitData(stats: CircuitStats, progress: CircuitProgress) {
    setPlaygroundItem(STATS_KEY, {
        ...stats,
        progress: JSON.stringify(progress),
    })
}

// ── React Hook ────────────────────────────────────────────────────────

export function useCircuitPuzzle() {
    const initialStateRef = useRef<CircuitInitialState | null>(null)
    if (initialStateRef.current === null) {
        initialStateRef.current = createInitialState()
    }

    const initialState = initialStateRef.current
    const initialLevel = LEVELS[initialState.levelIndex]
    const initialPowered = buildPoweredGrid(initialLevel, initialState.grid)

    const [levelIndex, setLevelIndex] = useState(initialState.levelIndex)
    const [grid, setGrid] = useState<CellComponent[][]>(() =>
        deepCopyGrid(initialState.grid),
    )
    const [powered, setPowered] = useState<boolean[][]>(initialPowered)
    const [status, setStatus] = useState<CircuitStatus>(initialState.status)
    const [moves, setMoves] = useState(initialState.moves)
    const [time, setTime] = useState(initialState.time)
    const [stats, setStats] = useState<CircuitStats>(initialState.stats)

    const level = LEVELS[levelIndex]
    const timerIdRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (status === "playing") {
            const id = setInterval(() => setTime((t) => t + 1), 1000)
            timerIdRef.current = id
            return () => clearInterval(id)
        }
        if (timerIdRef.current) {
            clearInterval(timerIdRef.current)
            timerIdRef.current = null
        }
    }, [status])

    useEffect(() => {
        saveCircuitData(stats, {
            levelIndex,
            grid,
            status,
            moves,
            time,
        })
    }, [grid, levelIndex, moves, stats, status, time])

    // Simulate whenever grid changes
    useEffect(() => {
        const p = buildPoweredGrid(level, grid)
        setPowered(p)

        if (status === "playing" || status === "idle") {
            const allLit = checkAllBulbsLit(grid, p, level.rows, level.cols)
            if (allLit && moves > 0) {
                setStatus("solved")
                persistStats((prev) => {
                    const solvedLevels = prev.solvedLevels.includes(level.id)
                        ? prev.solvedLevels
                        : [...prev.solvedLevels, level.id]
                    const bestTimes = { ...prev.bestTimes }
                    if (bestTimes[level.id] === undefined || time < bestTimes[level.id]) {
                        bestTimes[level.id] = time
                    }
                    return {
                        totalGames: prev.totalGames + 1,
                        solvedCount: prev.solvedCount + 1,
                        solvedLevels,
                        bestTimes,
                    }
                })
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grid])

    const persistStats = useCallback(
        (updater: (prev: CircuitStats) => CircuitStats) => {
            setStats((prev) => {
                return updater(prev)
            })
        },
        [],
    )

    const rotateCell = useCallback(
        (row: number, col: number) => {
            if (status === "solved") return
            setGrid((prev) => {
                const cell = prev[row][col]
                if (cell.fixed || cell.type === "empty") return prev
                if (status === "idle") setStatus("playing")
                const next = prev.map((r) => r.map((c) => ({ ...c })))
                next[row][col] = { ...cell, rotation: (cell.rotation + 90) % 360 }
                setMoves((m) => m + 1)
                return next
            })
        },
        [status],
    )

    const goToLevel = useCallback(
        (index: number) => {
            const clamped = Math.max(0, Math.min(LEVELS.length - 1, index))
            const nextLevel = LEVELS[clamped]
            setLevelIndex(clamped)
            setGrid(createPlayableGrid(nextLevel))
            setPowered(
                Array.from({ length: nextLevel.rows }, () =>
                    Array(nextLevel.cols).fill(false),
                ),
            )
            setStatus("idle")
            setMoves(0)
            setTime(0)
        },
        [],
    )

    const nextLevel = useCallback(() => {
        goToLevel(Math.min(levelIndex + 1, LEVELS.length - 1))
    }, [levelIndex, goToLevel])

    const prevLevel = useCallback(() => {
        goToLevel(Math.max(levelIndex - 1, 0))
    }, [levelIndex, goToLevel])

    const resetLevel = useCallback(() => {
        setGrid(createPlayableGrid(level))
        setPowered(
            Array.from({ length: level.rows }, () =>
                Array(level.cols).fill(false),
            ),
        )
        setStatus("idle")
        setMoves(0)
        setTime(0)
    }, [level])

    return {
        level,
        levelIndex,
        levelCount: LEVELS.length,
        grid,
        powered,
        status,
        moves,
        time,
        stats,
        rotateCell,
        goToLevel,
        nextLevel,
        prevLevel,
        resetLevel,
    }
}

function deepCopyGrid(grid: CellComponent[][]): CellComponent[][] {
    return grid.map((row) => row.map((cell) => ({ ...cell })))
}
