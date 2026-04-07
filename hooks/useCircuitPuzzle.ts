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

type LogicGateType = "and_gate" | "or_gate" | "not_gate"

export interface CellComponent {
    type: ComponentType
    rotation: number
    fixed: boolean
    active?: boolean
    interactive?: boolean
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
    objective: string
    parMoves: number
    rows: number
    cols: number
    grid: CellComponent[][]
    startRotations: number[][]
    sourceControls?: Array<{
        row: number
        col: number
        label: string
        startOn: boolean
    }>
    bulbTargets?: Array<{
        row: number
        col: number
        required: "lit" | "dark"
        label?: string
    }>
    difficulty: "easy" | "medium" | "hard"
    hasLogicGate: boolean
}

export type CircuitStatus = "idle" | "playing" | "solved"

export interface CircuitStats {
    totalGames: number
    solvedCount: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
    bestMoves: Record<string, number>
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

function rotateDirection(direction: Direction, rotation: number): Direction {
    const dirs: Direction[] = ["top", "right", "bottom", "left"]
    const steps = ((rotation % 360) + 360) % 360 / 90
    return dirs[(dirs.indexOf(direction) + steps) % 4]
}

function isLogicGate(type: ComponentType): type is LogicGateType {
    return type === "and_gate" || type === "or_gate" || type === "not_gate"
}

function getGateDefinition(type: LogicGateType, rotation: number): { inputs: Direction[]; output: Direction } {
    if (type === "not_gate") {
        return {
            inputs: [rotateDirection("top", rotation)],
            output: rotateDirection("bottom", rotation),
        }
    }

    return {
        inputs: [
            rotateDirection("top", rotation),
            rotateDirection("bottom", rotation),
        ],
        output: rotateDirection("right", rotation),
    }
}

// ── Levels ────────────────────────────────────────────────────────────

function e(): CellComponent { return { type: "empty", rotation: 0, fixed: false } }
function ws(r = 0, fixed = false): CellComponent { return { type: "wire_straight", rotation: r, fixed } }
function wc(r = 0, fixed = false): CellComponent { return { type: "wire_corner", rotation: r, fixed } }
function wt(r = 0, fixed = false): CellComponent { return { type: "wire_tee", rotation: r, fixed } }
function wx(fixed = false): CellComponent { return { type: "wire_cross", rotation: 0, fixed } }
function bat(r = 0, interactive = false, active = true): CellComponent { return { type: "battery", rotation: r, fixed: true, interactive, active } }
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
        objective: "用最少的旋转恢复最基础的串联回路。",
        parMoves: 1,
        rows: 3,
        cols: 3,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [e(),      bat(),  e()     ],
            [e(),      ws(0),  e()     ],
            [e(),      blb(),  e()     ],
        ],
        startRotations: [
            [0, 0, 0],
            [0, 90, 0],
            [0, 0, 0],
        ],
    },
    {
        id: "corner_turn",
        name: "拐弯前行",
        description: "使用弯角导线连通电路",
        objective: "观察拐角与直线的朝向，让电流完成一次转弯。",
        parMoves: 3,
        rows: 3,
        cols: 3,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [bat(90),  ws(90), wc(180)],
            [e(),      e(),    ws()    ],
            [e(),      e(),    blb()   ],
        ],
        startRotations: [
            [90, 0, 90],
            [0, 0, 90],
            [0, 0, 0],
        ],
    },
    {
        id: "l_shape",
        name: "L 形回路",
        description: "用弯角和直线组合一条 L 形路径",
        objective: "先找纵向主干，再补齐顶端横线。",
        parMoves: 4,
        rows: 3,
        cols: 4,
        difficulty: "easy",
        hasLogicGate: false,
        grid: [
            [bat(90),  ws(90), ws(90), wc(180)],
            [e(),      e(),    e(),    ws()   ],
            [e(),      e(),    e(),    blb()  ],
        ],
        startRotations: [
            [90, 0, 0, 90],
            [0, 0, 0, 90],
            [0, 0, 0, 0],
        ],
    },
    {
        id: "resistor_intro",
        name: "认识电阻",
        description: "电阻不影响连通——旋转导线使电路导通",
        objective: "识别电阻只是通路的一部分，不是障碍。",
        parMoves: 2,
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
        startRotations: [
            [0, 0, 0],
            [0, 90, 0],
            [0, 90, 0],
            [0, 0, 0],
        ],
    },
    {
        id: "tee_split",
        name: "三通分流",
        description: "使用 T 形导线让电路分支",
        objective: "先打通主线，再让一个节点同时供电给两侧灯泡。",
        parMoves: 2,
        rows: 3,
        cols: 3,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [blb(90), wt(90),  blb(90) ],
            [e(),      ws(),    e()     ],
            [e(),      bat(),   e()     ],
        ],
        startRotations: [
            [90, 90, 90],
            [0, 90, 0],
            [0, 0, 0],
        ],
    },
    {
        id: "parallel_circuit",
        name: "并联电路",
        description: "连接并联回路，两个灯泡都要亮",
        objective: "不要只顾一侧，必须让两条支路同时成立。",
        parMoves: 5,
        rows: 4,
        cols: 4,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [e(),      bat(),   e(),     e()     ],
            [wc(90),   wt(270), ws(90),  wc(180) ],
            [blb(),    e(),     e(),     blb()   ],
            [e(),      e(),     e(),     e()     ],
        ],
        startRotations: [
            [0, 0, 0, 0],
            [0, 90, 0, 270],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ],
    },
    {
        id: "power_hub",
        name: "中心枢纽",
        description: "中央十字节点要同时为三盏灯供电",
        objective: "先找到唯一的供电核心，再让三条支路全部接通。",
        parMoves: 5,
        rows: 5,
        cols: 5,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [e(),      e(),      bat(),     e(),      e()     ],
            [e(),      e(),      ws(),      e(),      e()     ],
            [blb(90),  ws(90),   wx(),      ws(90),   blb(90) ],
            [e(),      e(),      ws(),      e(),      e()     ],
            [e(),      e(),      blb(),     e(),      e()     ],
        ],
        startRotations: [
            [0, 0, 0, 0, 0],
            [0, 0, 90, 0, 0],
            [0, 0, 0, 90, 0],
            [0, 0, 90, 0, 0],
            [0, 0, 0, 0, 0],
        ],
    },
    {
        id: "switch_gate",
        name: "开关控制",
        description: "旋转开关导通电路",
        objective: "把开关当作一段特殊导线，修复完整控制链。",
        parMoves: 2,
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
        startRotations: [
            [0, 0, 0],
            [0, 90, 0],
            [0, 90, 0],
            [0, 0, 0],
        ],
    },
    {
        id: "selective_branch",
        name: "选择性分支",
        description: "只点亮上下两盏灯，右侧灯必须保持熄灭",
        objective: "不是所有支路都该接通，学会为目标保留一条断路。",
        parMoves: 4,
        rows: 3,
        cols: 5,
        difficulty: "medium",
        hasLogicGate: false,
        grid: [
            [e(),       e(),      blb(),     e(),       e()      ],
            [bat(90),   ws(90),   wt(180),   ws(90),    blb(90)  ],
            [e(),       e(),      blb(),     e(),       e()      ],
        ],
        startRotations: [
            [0, 0, 0, 0, 0],
            [0, 0, 90, 0, 0],
            [0, 0, 180, 0, 0],
        ],
        bulbTargets: [
            { row: 0, col: 2, required: "lit", label: "A" },
            { row: 1, col: 4, required: "dark", label: "B" },
            { row: 2, col: 2, required: "lit", label: "C" },
        ],
    },
    {
        id: "not_split",
        name: "反相信号分流",
        description: "NOT 门输出经枢纽同时点亮两盏灯",
        objective: "别给 NOT 门输入供电，真正要修的是它的输出网络。",
        parMoves: 4,
        rows: 3,
        cols: 5,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),      e(),      notG(),    e(),      e()     ],
            [blb(90),  ws(90),   wx(),      ws(90),   blb(90) ],
            [e(),      e(),      e(),       e(),      e()     ],
        ],
        startRotations: [
            [0, 0, 0, 0, 0],
            [90, 90, 0, 0, 90],
            [0, 0, 0, 0, 0],
        ],
    },
    {
        id: "inverter_choice",
        name: "反相择路",
        description: "保持 NOT 的左侧输入灯熄灭，同时点亮右侧输出灯",
        objective: "如果你把输入侧也接通了，虽然有电流，但这题仍然算失败。",
        parMoves: 3,
        rows: 3,
        cols: 5,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),       e(),      e(),        e(),       e()      ],
            [blb(90),   ws(90),   notG(270),  ws(90),    blb(90)  ],
            [e(),       e(),      e(),        e(),       e()      ],
        ],
        startRotations: [
            [0, 0, 0, 0, 0],
            [0, 0, 180, 0, 0],
            [0, 0, 0, 0, 0],
        ],
        bulbTargets: [
            { row: 1, col: 0, required: "dark", label: "A" },
            { row: 1, col: 4, required: "lit", label: "B" },
        ],
    },
    {
        id: "input_toggle_not",
        name: "输入开关 · 非门",
        description: "切换输入源状态，让 NOT 门重新输出高电平",
        objective: "这关除了接线，还必须把输入源 A 关掉。",
        parMoves: 3,
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),     bat(0, true, false), e()    ],
            [e(),     notG(),             e()    ],
            [e(),     ws(),               e()    ],
            [e(),     blb(),              e()    ],
        ],
        startRotations: [
            [0, 0, 0],
            [0, 0, 0],
            [0, 90, 0],
            [0, 0, 0],
        ],
        sourceControls: [
            { row: 0, col: 1, label: "A", startOn: true },
        ],
    },
    {
        id: "and_gate_intro",
        name: "与门入门",
        description: "AND 门需要两个输入都连通才输出",
        objective: "同时修复左右两路输入，否则输出永远不会亮。",
        parMoves: 5,
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
        startRotations: [
            [0, 0, 0],
            [90, 0, 90],
            [90, 0, 180],
            [0, 0, 0],
        ],
    },
    {
        id: "input_toggle_and",
        name: "双输入联锁",
        description: "两个可切换输入共同控制 AND 门输出",
        objective: "不仅要修好连线，还要把 A、B 两个输入都打开。",
        parMoves: 4,
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [bat(0, true, true), e(),               bat(0, true, true)],
            [ws(),               e(),               ws()              ],
            [wc(0),              andG(90),          wc(270)           ],
            [e(),                blb(),             e()               ],
        ],
        startRotations: [
            [0, 0, 0],
            [90, 0, 90],
            [0, 0, 270],
            [0, 0, 0],
        ],
        sourceControls: [
            { row: 0, col: 0, label: "A", startOn: false },
            { row: 0, col: 2, label: "B", startOn: false },
        ],
    },
    {
        id: "logic_cascade",
        name: "逻辑级联",
        description: "AND 的输出继续作为 OR 的输入，级联后点亮灯泡",
        objective: "先让 AND 真正成立，再检查 OR 的第二路输入与最终输出。",
        parMoves: 6,
        rows: 5,
        cols: 5,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),      bat(),     e(),       e(),       e()      ],
            [e(),      ws(),      e(),       e(),       e()      ],
            [e(),      andG(0),   ws(90),    orG(90),   bat(90)  ],
            [e(),      ws(),      e(),       ws(),      e()      ],
            [e(),      bat(),     e(),       blb(),     e()      ],
        ],
        startRotations: [
            [0, 0, 0, 0, 0],
            [0, 90, 0, 0, 0],
            [0, 90, 0, 180, 0],
            [0, 90, 0, 90, 0],
            [0, 0, 0, 0, 0],
        ],
    },
    {
        id: "or_gate_intro",
        name: "或门入门",
        description: "OR 门只需一个输入连通即可输出",
        objective: "注意 OR 门不要求双路都通，但输出路径必须正确。",
        parMoves: 4,
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
        startRotations: [
            [0, 0, 0],
            [90, 0, 0],
            [180, 180, 90],
            [0, 0, 0],
        ],
    },
    {
        id: "not_gate_intro",
        name: "非门入门",
        description: "NOT 门在没有输入时会输出信号，连通灯泡即可点亮",
        objective: "理解这关的关键不是供电，而是保持 NOT 门输入为空。",
        parMoves: 2,
        rows: 4,
        cols: 3,
        difficulty: "hard",
        hasLogicGate: true,
        grid: [
            [e(),     notG(),  e()    ],
            [e(),     ws(),    e()    ],
            [e(),     blb(),   e()    ],
            [e(),     e(),     e()    ],
        ],
        startRotations: [
            [0, 90, 0],
            [0, 90, 0],
            [0, 0, 0],
            [0, 0, 0],
        ],
    },
]

// ── Circuit simulation (BFS) ──────────────────────────────────────────

function simulateCircuit(
    grid: CellComponent[][],
    rows: number,
    cols: number,
): boolean[][] {
    const createBooleanGrid = () =>
        Array.from({ length: rows }, () => Array(cols).fill(false))

    let activeGates = new Set<string>()

    while (true) {
        const powered = createBooleanGrid()
        const queue: [number, number][] = []
        const energizedGateInputs = new Map<string, Set<Direction>>()

        const markPowered = (r: number, c: number) => {
            if (powered[r][c]) return
            powered[r][c] = true
            queue.push([r, c])
        }

        const noteGateInput = (r: number, c: number, inputDir: Direction) => {
            const key = `${r},${c}`
            const inputs = energizedGateInputs.get(key) ?? new Set<Direction>()
            inputs.add(inputDir)
            energizedGateInputs.set(key, inputs)
            powered[r][c] = true
        }

        const getSimConnections = (cell: CellComponent) => {
            if (cell.type === "battery" && cell.active === false) {
                return new Set<Direction>()
            }
            return getConnections(cell.type, cell.rotation)
        }

        const emitIntoNeighbor = (r: number, c: number, dir: Direction) => {
            const [dr, dc] = DIR_DELTA[dir]
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return

            const neighbor = grid[nr][nc]
            if (neighbor.type === "empty") return

            const incomingSide = OPPOSITE[dir]
            const neighborConns = getSimConnections(neighbor)
            if (!neighborConns.has(incomingSide)) return

            if (isLogicGate(neighbor.type)) {
                const gate = getGateDefinition(neighbor.type, neighbor.rotation)
                if (gate.inputs.includes(incomingSide)) {
                    noteGateInput(nr, nc, incomingSide)
                }
                return
            }

            markPowered(nr, nc)
        }

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (grid[r][c].type === "battery") {
                    if (grid[r][c].active === false) continue
                    markPowered(r, c)
                }
            }
        }

        for (const key of activeGates) {
            const [r, c] = key.split(",").map(Number)
            const cell = grid[r]?.[c]
            if (!cell || !isLogicGate(cell.type)) continue

            powered[r][c] = true
            emitIntoNeighbor(r, c, getGateDefinition(cell.type, cell.rotation).output)
        }

        while (queue.length > 0) {
            const [r, c] = queue.shift()!
            const cell = grid[r][c]
            const conns = getSimConnections(cell)

            for (const dir of conns) {
                emitIntoNeighbor(r, c, dir)
            }
        }

        const nextActiveGates = new Set<string>()

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = grid[r][c]
                if (!isLogicGate(cell.type)) continue

                const gate = getGateDefinition(cell.type, cell.rotation)
                const energizedInputs = energizedGateInputs.get(`${r},${c}`) ?? new Set<Direction>()

                const isActive = (() => {
                    switch (cell.type) {
                        case "and_gate":
                            return gate.inputs.every((input) => energizedInputs.has(input))
                        case "or_gate":
                            return gate.inputs.some((input) => energizedInputs.has(input))
                        case "not_gate":
                            return !energizedInputs.has(gate.inputs[0])
                    }
                })()

                if (isActive) {
                    nextActiveGates.add(`${r},${c}`)
                    powered[r][c] = true
                }
            }
        }

        if (
            nextActiveGates.size === activeGates.size
            && [...nextActiveGates].every((key) => activeGates.has(key))
        ) {
            return powered
        }

        activeGates = nextActiveGates
    }
}

function checkAllBulbsLit(
    level: CircuitLevel,
    powered: boolean[][],
): boolean {
    for (const target of getBulbTargets(level)) {
        const isPowered = powered[target.row]?.[target.col] ?? false
        if (target.required === "lit" && !isPowered) return false
        if (target.required === "dark" && isPowered) return false
    }
    return true
}

export { simulateCircuit }

function getBulbTargets(level: CircuitLevel): Array<{
    row: number
    col: number
    required: "lit" | "dark"
    label: string
}> {
    const explicitTargets = new Map(
        (level.bulbTargets ?? []).map((target) => [`${target.row},${target.col}`, target]),
    )
    const bulbs: Array<{ row: number; col: number }> = []

    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            if (level.grid[row][col].type === "bulb") {
                bulbs.push({ row, col })
            }
        }
    }

    return bulbs.map((bulb, index) => {
        const target = explicitTargets.get(`${bulb.row},${bulb.col}`)
        return {
            row: bulb.row,
            col: bulb.col,
            required: target?.required ?? "lit",
            label: target?.label ?? String.fromCharCode(65 + index),
        }
    })
}

export { getBulbTargets }

function getSourceControls(level: CircuitLevel): Array<{
    row: number
    col: number
    label: string
    startOn: boolean
}> {
    return level.sourceControls ?? []
}

export { getSourceControls }

// ── Stats persistence ─────────────────────────────────────────────────

const STATS_KEY = "circuit_stats"
const VALID_ROTATIONS = new Set([0, 90, 180, 270])

const EMPTY_STATS: CircuitStats = {
    totalGames: 0,
    solvedCount: 0,
    solvedLevels: [],
    bestTimes: {},
    bestMoves: {},
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
                .map(([levelId, value]) => [levelId, Math.floor(value as number)]),
        )
        : {}

    const bestMoves = isRecord(raw.bestMoves)
        ? Object.fromEntries(
            Object.entries(raw.bestMoves)
                .filter(([levelId, value]) => validLevelIds.has(levelId) && typeof value === "number" && Number.isFinite(value) && value >= 0)
                .map(([levelId, value]) => [levelId, Math.floor(value as number)]),
        )
        : {}

    return {
        totalGames: toSafeCount(raw.totalGames),
        solvedCount: toSafeCount(raw.solvedCount),
        solvedLevels,
        bestTimes,
        bestMoves,
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

            const nextCell: CellComponent = {
                ...templateCell,
                rotation: normalizedRotation,
            }

            if (templateCell.type === "battery" && templateCell.interactive) {
                if (typeof storedCell.active !== "boolean") return null
                nextCell.active = storedCell.active
                nextCell.interactive = true
            }

            nextRow.push(nextCell)
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

function getMoveRating(moves: number, parMoves: number): number {
    if (moves <= parMoves) return 3
    if (moves <= parMoves + 2) return 2
    return 1
}

export { getMoveRating }

function getUnlockedLevelCount(stats: CircuitStats): number {
    let unlocked = 1

    while (
        unlocked < LEVELS.length
        && stats.solvedLevels.includes(LEVELS[unlocked - 1].id)
    ) {
        unlocked++
    }

    return unlocked
}

export { getUnlockedLevelCount }

function isLevelSolved(level: CircuitLevel, grid: CellComponent[][]): boolean {
    return checkAllBulbsLit(level, buildPoweredGrid(level, grid))
}

function buildLevelStartGrid(level: CircuitLevel): CellComponent[][] {
    const grid = deepCopyGrid(level.grid)

    for (let row = 0; row < level.rows; row++) {
        const rotationRow = level.startRotations[row]
        if (!Array.isArray(rotationRow) || rotationRow.length !== level.cols) {
            throw new Error(`Invalid startRotations for level ${level.id}`)
        }

        for (let col = 0; col < level.cols; col++) {
            const cell = grid[row][col]
            if (cell.fixed || cell.type === "empty") continue

            const rotation = rotationRow[col]
            if (!VALID_ROTATIONS.has(rotation)) {
                throw new Error(`Invalid rotation ${rotation} in level ${level.id}`)
            }

            cell.rotation = rotation
        }
    }

    for (const source of getSourceControls(level)) {
        const cell = grid[source.row]?.[source.col]
        if (!cell || cell.type !== "battery") {
            throw new Error(`Invalid sourceControls entry for level ${level.id}`)
        }

        cell.interactive = true
        cell.active = source.startOn
    }

    return grid
}

export { buildLevelStartGrid }

function createPlayableGrid(level: CircuitLevel): CellComponent[][] {
    if (level.startRotations.length > 0) {
        return buildLevelStartGrid(level)
    }

    const grid = deepCopyGrid(level.grid)
    const rotatableCells: Array<[number, number]> = []

    for (let row = 0; row < level.rows; row++) {
        for (let col = 0; col < level.cols; col++) {
            const cell = grid[row][col]
            if (cell.fixed || cell.type === "empty") continue
            const turns = Math.floor(Math.random() * 4)
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
    const unlockedLevelCount = getUnlockedLevelCount(stats)

    if (progress) {
        const safeLevelIndex = Math.min(progress.levelIndex, unlockedLevelCount - 1)

        return {
            ...progress,
            levelIndex: safeLevelIndex,
            grid:
                safeLevelIndex === progress.levelIndex
                    ? progress.grid
                    : createPlayableGrid(LEVELS[safeLevelIndex]),
            status: safeLevelIndex === progress.levelIndex ? progress.status : "idle",
            moves: safeLevelIndex === progress.levelIndex ? progress.moves : 0,
            time: safeLevelIndex === progress.levelIndex ? progress.time : 0,
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
    const unlockedLevelCount = getUnlockedLevelCount(stats)
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
            const allLit = checkAllBulbsLit(level, p)
            if (allLit && moves > 0) {
                setStatus("solved")
                persistStats((prev) => {
                    const solvedLevels = prev.solvedLevels.includes(level.id)
                        ? prev.solvedLevels
                        : [...prev.solvedLevels, level.id]
                    const bestTimes = { ...prev.bestTimes }
                    const bestMoves = { ...prev.bestMoves }
                    if (bestTimes[level.id] === undefined || time < bestTimes[level.id]) {
                        bestTimes[level.id] = time
                    }
                    if (bestMoves[level.id] === undefined || moves < bestMoves[level.id]) {
                        bestMoves[level.id] = moves
                    }
                    return {
                        totalGames: prev.totalGames + 1,
                        solvedCount: prev.solvedCount + 1,
                        solvedLevels,
                        bestTimes,
                        bestMoves,
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

    const toggleSource = useCallback(
        (row: number, col: number) => {
            if (status === "solved") return
            setGrid((prev) => {
                const cell = prev[row][col]
                if (cell.type !== "battery" || !cell.interactive) return prev
                if (status === "idle") setStatus("playing")
                const next = prev.map((currentRow) => currentRow.map((currentCell) => ({ ...currentCell })))
                next[row][col] = { ...cell, active: !(cell.active ?? true) }
                setMoves((currentMoves) => currentMoves + 1)
                return next
            })
        },
        [status],
    )

    const goToLevel = useCallback(
        (index: number) => {
            const clamped = Math.max(0, Math.min(unlockedLevelCount - 1, index))
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
        [unlockedLevelCount],
    )

    const nextLevel = useCallback(() => {
        goToLevel(Math.min(levelIndex + 1, unlockedLevelCount - 1))
    }, [levelIndex, unlockedLevelCount, goToLevel])

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
        unlockedLevelCount,
        grid,
        powered,
        status,
        moves,
        time,
        stats,
        rotateCell,
        toggleSource,
        goToLevel,
        nextLevel,
        prevLevel,
        resetLevel,
    }
}

function deepCopyGrid(grid: CellComponent[][]): CellComponent[][] {
    return grid.map((row) => row.map((cell) => ({ ...cell })))
}
