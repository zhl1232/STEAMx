import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type GateKind = "AND" | "OR" | "NOT" | "NAND" | "XOR"

export type CircuitGateSlot = {
    id: string
    /** 输入：in0 / in1… 或其它门 id */
    inputs: string[]
    /** 若为 null，玩家需要选择门类型 */
    fixed?: GateKind
}

export type CircuitLevel = {
    id: string
    name: string
    hint: string
    /** 输入开关初值；玩家可拨动 */
    inputCount: number
    initialInputs: boolean[]
    gates: CircuitGateSlot[]
    outputGateId: string
    /** 目标输出 */
    targetOutput: boolean
    /** 可选：要求输入保持为某组合（null 表示任意可拨） */
    lockInputs?: boolean
}

export type CircuitStats = {
    totalGames: number
    solvedLevels: string[]
    bestTimes: Record<string, number>
}

const STATS_KEY = "circuit_stats"
const EMPTY_STATS: CircuitStats = { totalGames: 0, solvedLevels: [], bestTimes: {} }

export const GATE_OPTIONS: GateKind[] = ["AND", "OR", "NOT", "NAND", "XOR"]

export function evalGate(kind: GateKind, inputs: boolean[]): boolean {
    if (kind === "NOT") return !inputs[0]
    if (kind === "AND") return inputs.every(Boolean)
    if (kind === "OR") return inputs.some(Boolean)
    if (kind === "NAND") return !inputs.every(Boolean)
    if (kind === "XOR") return inputs.filter(Boolean).length % 2 === 1
    return false
}

export function evaluateCircuit(
    inputs: boolean[],
    gates: CircuitGateSlot[],
    assignments: Record<string, GateKind | null>,
    outputGateId: string,
): { values: Record<string, boolean | null>; output: boolean | null; complete: boolean } {
    const values: Record<string, boolean | null> = {}
    inputs.forEach((value, index) => {
        values[`in${index}`] = value
    })

    const pending = [...gates]
    let guard = 0
    while (pending.length > 0 && guard < 32) {
        guard += 1
        let progressed = false
        for (let i = pending.length - 1; i >= 0; i -= 1) {
            const gate = pending[i]
            const kind = gate.fixed ?? assignments[gate.id] ?? null
            if (!kind) continue
            if (kind === "NOT" && gate.inputs.length !== 1) continue
            if (kind !== "NOT" && gate.inputs.length < 2) continue
            const args = gate.inputs.map((key) => values[key])
            if (args.some((value) => value == null)) continue
            values[gate.id] = evalGate(kind, args as boolean[])
            pending.splice(i, 1)
            progressed = true
        }
        if (!progressed) break
    }

    const output = values[outputGateId] ?? null
    const complete = gates.every((gate) => (gate.fixed ?? assignments[gate.id]) != null) && output != null
    return { values, output, complete }
}

export const CIRCUIT_LEVELS: CircuitLevel[] = [
    {
        id: "and-light",
        name: "与门点灯",
        hint: "两个开关都打开，AND 才会亮灯。",
        inputCount: 2,
        initialInputs: [true, true],
        lockInputs: true,
        gates: [{ id: "g0", inputs: ["in0", "in1"] }],
        outputGateId: "g0",
        targetOutput: true,
    },
    {
        id: "or-rescue",
        name: "或门救援",
        hint: "只要一路有电就亮——选 OR，并打开任一开关。",
        inputCount: 2,
        initialInputs: [false, true],
        lockInputs: false,
        gates: [{ id: "g0", inputs: ["in0", "in1"] }],
        outputGateId: "g0",
        targetOutput: true,
    },
    {
        id: "not-flip",
        name: "非门翻转",
        hint: "NOT 只有一个输入：关掉开关，灯才会亮。",
        inputCount: 1,
        initialInputs: [true],
        lockInputs: false,
        gates: [{ id: "g0", inputs: ["in0"] }],
        outputGateId: "g0",
        targetOutput: true,
    },
    {
        id: "and-or-combo",
        name: "与或组合",
        hint: "先 AND 再 OR：让第二级在输入锁定时输出真。",
        inputCount: 3,
        initialInputs: [true, true, false],
        lockInputs: true,
        gates: [
            { id: "g0", inputs: ["in0", "in1"] },
            { id: "g1", inputs: ["g0", "in2"] },
        ],
        outputGateId: "g1",
        targetOutput: true,
    },
    {
        id: "nand-xor",
        name: "NAND 与异或",
        hint: "第一级用 NAND，第二级用 XOR，输入已锁定。",
        inputCount: 3,
        initialInputs: [true, true, true],
        lockInputs: true,
        gates: [
            { id: "g0", inputs: ["in0", "in1"] },
            { id: "g1", inputs: ["g0", "in2"] },
        ],
        outputGateId: "g1",
        targetOutput: true,
    },
]

function emptyAssignments(level: CircuitLevel): Record<string, GateKind | null> {
    const result: Record<string, GateKind | null> = {}
    for (const gate of level.gates) {
        result[gate.id] = gate.fixed ?? null
    }
    return result
}

function loadStats(): CircuitStats {
    const raw = getPlaygroundItem<Partial<CircuitStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: CircuitStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useCircuit() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [inputs, setInputs] = useState<boolean[]>(() => [...CIRCUIT_LEVELS[0].initialInputs])
    const [assignments, setAssignments] = useState<Record<string, GateKind | null>>(() =>
        emptyAssignments(CIRCUIT_LEVELS[0]),
    )
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<CircuitStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const level = CIRCUIT_LEVELS[levelIndex]

    const evaluation = useMemo(
        () => evaluateCircuit(inputs, level.gates, assignments, level.outputGateId),
        [assignments, inputs, level],
    )

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: CircuitLevel, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousBest = prev.bestTimes[solvedLevel.id]
            const updated: CircuitStats = {
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

    useEffect(() => {
        if (status !== "playing") return
        if (!evaluation.complete) return
        if (evaluation.output === level.targetOutput) {
            recordSolve(level, time)
        }
    }, [evaluation.complete, evaluation.output, level, recordSolve, status, time])

    const setGate = useCallback(
        (gateId: string, kind: GateKind | null) => {
            if (status === "solved") return
            const gate = level.gates.find((item) => item.id === gateId)
            if (!gate || gate.fixed) return
            setAssignments((prev) => ({ ...prev, [gateId]: kind }))
        },
        [level.gates, status],
    )

    const toggleInput = useCallback(
        (index: number) => {
            if (status === "solved" || level.lockInputs) return
            setInputs((prev) => prev.map((value, i) => (i === index ? !value : value)))
        },
        [level.lockInputs, status],
    )

    const startLevel = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(CIRCUIT_LEVELS.length - 1, index))
        const nextLevel = CIRCUIT_LEVELS[nextIndex]
        solvedRecordedRef.current = false
        setLevelIndex(nextIndex)
        setInputs([...nextLevel.initialInputs])
        setAssignments(emptyAssignments(nextLevel))
        setTime(0)
        setStatus("playing")
    }, [])

    return {
        level,
        levelIndex,
        levelCount: CIRCUIT_LEVELS.length,
        inputs,
        assignments,
        evaluation,
        time,
        status,
        stats,
        setGate,
        toggleInput,
        startLevel,
    }
}
