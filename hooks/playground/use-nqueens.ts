import { useState, useCallback, useEffect, useRef } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

// ── Types ─────────────────────────────────────────────────────────────

export type NQueensMode = "manual" | "visualize"
export type NQueensStatus = "idle" | "playing" | "solved" | "visualizing" | "no_solution"
export type NQueensSpeed = "slow" | "normal" | "fast"
export type CellState = "empty" | "queen" | "attacking" | "trying" | "backtracked" | "safe"

export type NQueensStats = {
    totalGames: number
    manualSolves: number
    bestSolvesByN: Record<number, number>
}

// ── Constants ─────────────────────────────────────────────────────────

const STATS_KEY = "nqueens_stats"
const MIN_N = 4
const MAX_N = 12
const DEFAULT_N = 8

const SPEED_MS: Record<NQueensSpeed, number> = {
    slow: 500,
    normal: 150,
    fast: 30,
}

const EMPTY_STATS: NQueensStats = {
    totalGames: 0,
    manualSolves: 0,
    bestSolvesByN: {},
}

type VisStep = {
    queens: number[]
    cellStates: CellState[][]
    totalSteps: number
    backtracks: number
    solutionCount: number
}

// ── Stats persistence ─────────────────────────────────────────────────

function loadStats(): NQueensStats {
    const p = getPlaygroundItem<Partial<NQueensStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS, bestSolvesByN: {} }
    return {
        totalGames: p.totalGames ?? 0,
        manualSolves: p.manualSolves ?? 0,
        bestSolvesByN: p.bestSolvesByN ?? {},
    }
}

function saveStats(stats: NQueensStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

// ── Board helpers ─────────────────────────────────────────────────────

function createEmptyQueens(n: number): number[] {
    return Array(n).fill(-1)
}

function createEmptyCellStates(n: number): CellState[][] {
    return Array.from({ length: n }, () => Array(n).fill("empty") as CellState[])
}

function isAttacked(queens: number[], row: number, col: number): boolean {
    for (let r = 0; r < queens.length; r++) {
        const c = queens[r]
        if (c === -1) continue
        if (r === row && c === col) continue
        if (c === col) return true
        if (r === row) return true
        if (Math.abs(r - row) === Math.abs(c - col)) return true
    }
    return false
}

function isSafe(queens: number[], row: number, col: number): boolean {
    for (let r = 0; r < row; r++) {
        if (queens[r] === -1) continue
        if (queens[r] === col) return false
        if (Math.abs(queens[r] - col) === Math.abs(r - row)) return false
    }
    return true
}

function computeManualCellStates(queens: number[], n: number): CellState[][] {
    const grid = createEmptyCellStates(n)

    const queenPositions: Array<{ row: number; col: number }> = []
    for (let r = 0; r < n; r++) {
        if (queens[r] !== -1) {
            queenPositions.push({ row: r, col: queens[r] })
        }
    }

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (queens[r] === c) {
                grid[r][c] = "queen"
            } else if (isAttacked(queens, r, c)) {
                grid[r][c] = "attacking"
            }
        }
    }

    return grid
}

function hasConflicts(queens: number[]): boolean {
    const placed: Array<{ row: number; col: number }> = []
    for (let r = 0; r < queens.length; r++) {
        if (queens[r] !== -1) placed.push({ row: r, col: queens[r] })
    }
    for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i]
            const b = placed[j]
            if (a.col === b.col) return true
            if (a.row === b.row) return true
            if (Math.abs(a.row - b.row) === Math.abs(a.col - b.col)) return true
        }
    }
    return false
}

// ── Visualization step generation ─────────────────────────────────────

function generateVisualizationSteps(n: number): VisStep[] {
    const steps: VisStep[] = []
    const queens = createEmptyQueens(n)
    let totalSteps = 0
    let backtracks = 0
    let solutionCount = 0

    function makeStep(
        currentQueens: number[],
        action: "trying" | "placed" | "conflict" | "backtrack" | "solved",
        targetRow?: number,
        targetCol?: number,
    ): VisStep {
        const grid = createEmptyCellStates(n)

        for (let r = 0; r < n; r++) {
            if (currentQueens[r] !== -1) {
                grid[r][currentQueens[r]] = "queen"
            }
        }

        if (action === "trying" && targetRow !== undefined && targetCol !== undefined) {
            grid[targetRow][targetCol] = "trying"
            for (let r = 0; r < n; r++) {
                if (currentQueens[r] === -1) continue
                if (currentQueens[r] === targetCol ||
                    Math.abs(currentQueens[r] - targetCol) === Math.abs(r - targetRow)) {
                    grid[r][currentQueens[r]] = "attacking"
                }
            }
        } else if (action === "placed" && targetRow !== undefined && targetCol !== undefined) {
            grid[targetRow][targetCol] = "queen"
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    if (grid[r][c] !== "empty") continue
                    if (isAttacked(currentQueens, r, c)) {
                        grid[r][c] = "attacking"
                    } else {
                        grid[r][c] = "safe"
                    }
                }
            }
        } else if (action === "conflict" && targetRow !== undefined && targetCol !== undefined) {
            grid[targetRow][targetCol] = "backtracked"
        } else if (action === "backtrack" && targetRow !== undefined) {
            for (let c = 0; c < n; c++) {
                if (grid[targetRow][c] === "empty") {
                    grid[targetRow][c] = "backtracked"
                }
            }
        } else if (action === "solved") {
            for (let r = 0; r < n; r++) {
                for (let c = 0; c < n; c++) {
                    if (currentQueens[r] === c) {
                        grid[r][c] = "queen"
                    } else {
                        grid[r][c] = "safe"
                    }
                }
            }
        }

        return {
            queens: [...currentQueens],
            cellStates: grid,
            totalSteps,
            backtracks,
            solutionCount,
        }
    }

    function solve(row: number) {
        if (row === n) {
            solutionCount++
            totalSteps++
            steps.push(makeStep(queens, "solved"))
            return
        }
        for (let col = 0; col < n; col++) {
            totalSteps++
            steps.push(makeStep(queens, "trying", row, col))

            if (isSafe(queens, row, col)) {
                queens[row] = col
                totalSteps++
                steps.push(makeStep(queens, "placed", row, col))
                solve(row + 1)
                queens[row] = -1
            } else {
                totalSteps++
                steps.push(makeStep(queens, "conflict", row, col))
            }
        }
        if (row > 0) {
            backtracks++
            totalSteps++
            steps.push(makeStep(queens, "backtrack", row))
        }
    }

    solve(0)
    return steps
}

// ── React Hook ────────────────────────────────────────────────────────

export function useNQueens() {
    const [n, setNState] = useState(DEFAULT_N)
    const [queens, setQueens] = useState<number[]>(() => createEmptyQueens(DEFAULT_N))
    const [cellStates, setCellStates] = useState<CellState[][]>(() => createEmptyCellStates(DEFAULT_N))
    const [mode, setModeState] = useState<NQueensMode>("manual")
    const [status, setStatus] = useState<NQueensStatus>("idle")
    const [isVisualizationPaused, setIsVisualizationPaused] = useState(false)
    const [speed, setSpeedState] = useState<NQueensSpeed>("normal")
    const [time, setTime] = useState(0)
    const [totalSteps, setTotalSteps] = useState(0)
    const [backtracks, setBacktracks] = useState(0)
    const [solutionCount, setSolutionCount] = useState(0)
    const [stats, setStats] = useState<NQueensStats>(() => ({
        ...EMPTY_STATS,
        bestSolvesByN: {},
    }))

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const visIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const visStepsRef = useRef<VisStep[]>([])
    const visIndexRef = useRef(0)
    const speedRef = useRef<NQueensSpeed>(speed)
    const statusRef = useRef<NQueensStatus>(status)
    const timeRef = useRef(0)

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    speedRef.current = speed
    statusRef.current = status
    timeRef.current = time

    // ── Timer helpers ─────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        if (timerRef.current) return
        timerRef.current = setInterval(() => {
            setTime((prev) => prev + 1)
        }, 1000)
    }, [])

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    // ── Visualization interval helpers ────────────────────────────────

    const clearVisInterval = useCallback(() => {
        if (visIntervalRef.current) {
            clearInterval(visIntervalRef.current)
            visIntervalRef.current = null
        }
    }, [])

    // ── Persist stats helper ──────────────────────────────────────────

    const persistStats = useCallback((updater: (prev: NQueensStats) => NQueensStats) => {
        setStats((prev) => {
            const next = updater(prev)
            saveStats(next)
            return next
        })
    }, [])

    // ── toggleCell (manual mode) ──────────────────────────────────────

    const toggleCell = useCallback(
        (row: number, col: number) => {
            if (statusRef.current === "visualizing" || statusRef.current === "solved") return
            if (statusRef.current === "no_solution") return

            setQueens((prev) => {
                const next = [...prev]
                if (next[row] === col) {
                    next[row] = -1
                } else {
                    next[row] = col
                }

                const placedCount = next.filter((c) => c !== -1).length
                if (placedCount >= 1 && statusRef.current === "idle") {
                    setStatus("playing")
                    statusRef.current = "playing"
                    startTimer()
                }

                setCellStates(computeManualCellStates(next, prev.length))
                return next
            })
        },
        [startTimer],
    )

    // ── Manual mode win detection ─────────────────────────────────────

    useEffect(() => {
        if (status !== "playing" || mode !== "manual") return
        const placedCount = queens.filter((c) => c !== -1).length
        if (placedCount !== n) return
        if (hasConflicts(queens)) return

        setStatus("solved")
        statusRef.current = "solved"
        stopTimer()

        persistStats((prev) => {
            const bestSolvesByN = { ...prev.bestSolvesByN }
            if (bestSolvesByN[n] === undefined || timeRef.current < bestSolvesByN[n]) {
                bestSolvesByN[n] = timeRef.current
            }
            return {
                totalGames: prev.totalGames + 1,
                manualSolves: prev.manualSolves + 1,
                bestSolvesByN,
            }
        })
    }, [queens, status, mode, n, time, stopTimer, persistStats])

    // ── Visualization advance ─────────────────────────────────────────

    const advanceVisStep = useCallback(() => {
        const steps = visStepsRef.current
        const idx = visIndexRef.current

        if (idx >= steps.length) {
            clearVisInterval()
            setIsVisualizationPaused(false)
            setStatus((prev) => {
                const newStatus = prev === "visualizing" ? "no_solution" : prev
                statusRef.current = newStatus
                return newStatus
            })
            return
        }

        const step = steps[idx]
        visIndexRef.current = idx + 1

        setQueens(step.queens)
        setCellStates(step.cellStates)
        setTotalSteps(step.totalSteps)
        setBacktracks(step.backtracks)
        setSolutionCount(step.solutionCount)

        if (idx === steps.length - 1) {
            clearVisInterval()
            setIsVisualizationPaused(false)
            const finalStatus = step.solutionCount > 0 ? "solved" : "no_solution"
            setStatus(finalStatus)
            statusRef.current = finalStatus
        }
    }, [clearVisInterval])

    // ── Start visualization interval ──────────────────────────────────

    const startVisInterval = useCallback(() => {
        clearVisInterval()
        setIsVisualizationPaused(false)
        visIntervalRef.current = setInterval(() => {
            advanceVisStep()
        }, SPEED_MS[speedRef.current])
    }, [advanceVisStep, clearVisInterval])

    // ── startVisualization ────────────────────────────────────────────

    const startVisualization = useCallback(() => {
        clearVisInterval()
        stopTimer()

        const currentN = n
        const emptyQueens = createEmptyQueens(currentN)
        setQueens(emptyQueens)
        setCellStates(createEmptyCellStates(currentN))
        setTime(0)
        setTotalSteps(0)
        setBacktracks(0)
        setSolutionCount(0)
        setIsVisualizationPaused(false)

        const steps = generateVisualizationSteps(currentN)
        visStepsRef.current = steps
        visIndexRef.current = 0

        if (steps.length === 0) {
            setStatus("no_solution")
            statusRef.current = "no_solution"
            setIsVisualizationPaused(false)
            return
        }

        setStatus("visualizing")
        statusRef.current = "visualizing"

        persistStats((prev) => ({
            ...prev,
            totalGames: prev.totalGames + 1,
        }))

        startVisInterval()
    }, [n, clearVisInterval, stopTimer, persistStats, startVisInterval])

    // ── pauseVisualization ────────────────────────────────────────────

    const pauseVisualization = useCallback(() => {
        if (statusRef.current !== "visualizing") return
        clearVisInterval()
        setIsVisualizationPaused(true)
    }, [clearVisInterval])

    // ── resumeVisualization ───────────────────────────────────────────

    const resumeVisualization = useCallback(() => {
        if (statusRef.current !== "visualizing") return
        if (visIndexRef.current >= visStepsRef.current.length) return
        startVisInterval()
    }, [startVisInterval])

    // ── setN ──────────────────────────────────────────────────────────

    const setN = useCallback(
        (newN: number) => {
            if (statusRef.current === "visualizing") return
            const clamped = Math.max(MIN_N, Math.min(MAX_N, newN))
            clearVisInterval()
            stopTimer()
            visStepsRef.current = []
            visIndexRef.current = 0
            setNState(clamped)
            setQueens(createEmptyQueens(clamped))
            setCellStates(createEmptyCellStates(clamped))
            setStatus("idle")
            statusRef.current = "idle"
            setTime(0)
            setTotalSteps(0)
            setBacktracks(0)
            setSolutionCount(0)
            setIsVisualizationPaused(false)
        },
        [clearVisInterval, stopTimer],
    )

    // ── setMode ───────────────────────────────────────────────────────

    const setMode = useCallback(
        (newMode: NQueensMode) => {
            if (statusRef.current === "visualizing") return
            clearVisInterval()
            stopTimer()
            visStepsRef.current = []
            visIndexRef.current = 0
            setModeState(newMode)
            setQueens(createEmptyQueens(n))
            setCellStates(createEmptyCellStates(n))
            setStatus("idle")
            statusRef.current = "idle"
            setTime(0)
            setTotalSteps(0)
            setBacktracks(0)
            setSolutionCount(0)
            setIsVisualizationPaused(false)
        },
        [n, clearVisInterval, stopTimer],
    )

    // ── setSpeed ──────────────────────────────────────────────────────

    const setSpeed = useCallback(
        (newSpeed: NQueensSpeed) => {
            setSpeedState(newSpeed)
            speedRef.current = newSpeed
            if (statusRef.current === "visualizing" && visIntervalRef.current) {
                startVisInterval()
            }
        },
        [startVisInterval],
    )

    // ── reset ─────────────────────────────────────────────────────────

    const reset = useCallback(() => {
        clearVisInterval()
        stopTimer()
        visStepsRef.current = []
        visIndexRef.current = 0
        setQueens(createEmptyQueens(n))
        setCellStates(createEmptyCellStates(n))
        setStatus("idle")
        statusRef.current = "idle"
        setTime(0)
        setTotalSteps(0)
        setBacktracks(0)
        setSolutionCount(0)
        setIsVisualizationPaused(false)
    }, [n, clearVisInterval, stopTimer])

    // ── Cleanup on unmount ────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (visIntervalRef.current) clearInterval(visIntervalRef.current)
        }
    }, [])

    return {
        n,
        queens,
        cellStates,
        mode,
        status,
        isVisualizationPaused,
        speed,
        time,
        totalSteps,
        backtracks,
        solutionCount,
        stats,
        setN,
        setMode,
        setSpeed,
        toggleCell,
        startVisualization,
        pauseVisualization,
        resumeVisualization,
        reset,
    }
}
