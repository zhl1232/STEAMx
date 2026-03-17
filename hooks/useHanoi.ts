import { useState, useCallback, useEffect, useRef } from "react"

// ── Types ─────────────────────────────────────────────────────────────

export type HanoiPeg = "A" | "B" | "C"

export type HanoiStatus = "idle" | "playing" | "won" | "auto_solving"

export type HanoiSpeed = "slow" | "normal" | "fast"

export type HanoiStats = {
    totalGames: number
    wins: number
    bestMoves: Record<number, number>
    bestTimes: Record<number, number>
}

// ── Constants ─────────────────────────────────────────────────────────

const STATS_KEY = "hanoi_stats"
const MIN_DISKS = 3
const MAX_DISKS = 8
const DEFAULT_DISKS = 3

const SPEED_MS: Record<HanoiSpeed, number> = {
    slow: 800,
    normal: 400,
    fast: 100,
}

const EMPTY_STATS: HanoiStats = {
    totalGames: 0,
    wins: 0,
    bestMoves: {},
    bestTimes: {},
}

type SolveStep = { from: HanoiPeg; to: HanoiPeg }

// ── Stats persistence ─────────────────────────────────────────────────

function loadStats(): HanoiStats {
    if (typeof window === "undefined") return { ...EMPTY_STATS }
    try {
        const raw = window.localStorage.getItem(STATS_KEY)
        if (!raw) return { ...EMPTY_STATS }
        const p = JSON.parse(raw) as Partial<HanoiStats>
        return {
            totalGames: p.totalGames ?? 0,
            wins: p.wins ?? 0,
            bestMoves: p.bestMoves ?? {},
            bestTimes: p.bestTimes ?? {},
        }
    } catch {
        return { ...EMPTY_STATS }
    }
}

function saveStats(stats: HanoiStats) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
    } catch { /* ignore */ }
}

// ── Solver ────────────────────────────────────────────────────────────

function generateSolveSteps(
    n: number,
    from: HanoiPeg,
    aux: HanoiPeg,
    to: HanoiPeg,
): SolveStep[] {
    if (n === 0) return []
    return [
        ...generateSolveSteps(n - 1, from, to, aux),
        { from, to },
        ...generateSolveSteps(n - 1, aux, from, to),
    ]
}

// ── Initial pegs builder ──────────────────────────────────────────────

function createInitialPegs(diskCount: number): Record<HanoiPeg, number[]> {
    const disks: number[] = []
    for (let i = diskCount; i >= 1; i--) disks.push(i)
    return { A: disks, B: [], C: [] }
}

// ── React Hook ────────────────────────────────────────────────────────

export function useHanoi() {
    const [diskCount, setDiskCountState] = useState(DEFAULT_DISKS)
    const [pegs, setPegs] = useState<Record<HanoiPeg, number[]>>(() =>
        createInitialPegs(DEFAULT_DISKS),
    )
    const [status, setStatus] = useState<HanoiStatus>("idle")
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [speed, setSpeedState] = useState<HanoiSpeed>("normal")
    const [stats, setStats] = useState<HanoiStats>(() => loadStats())
    const [selectedPeg, setSelectedPeg] = useState<HanoiPeg | null>(null)
    const [autoSolvePaused, setAutoSolvePaused] = useState(false)

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const solveStepsRef = useRef<SolveStep[]>([])
    const solveIndexRef = useRef(0)
    const speedRef = useRef<HanoiSpeed>(speed)
    const pegsRef = useRef(pegs)

    pegsRef.current = pegs
    speedRef.current = speed

    const optimalMoves = (1 << diskCount) - 1

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

    // ── Auto-solve interval helpers ───────────────────────────────────

    const clearAutoInterval = useCallback(() => {
        if (autoIntervalRef.current) {
            clearInterval(autoIntervalRef.current)
            autoIntervalRef.current = null
        }
    }, [])

    // ── Persist stats helper ──────────────────────────────────────────

    const persistStats = useCallback((updater: (prev: HanoiStats) => HanoiStats) => {
        setStats((prev) => {
            const next = updater(prev)
            saveStats(next)
            return next
        })
    }, [])

    // ── Core move logic ───────────────────────────────────────────────

    const moveDisk = useCallback(
        (from: HanoiPeg, to: HanoiPeg) => {
            if (status !== "playing" && status !== "auto_solving") return
            if (from === to) return

            setPegs((prev) => {
                const srcStack = prev[from]
                const dstStack = prev[to]
                if (srcStack.length === 0) return prev
                const disk = srcStack[srcStack.length - 1]
                if (dstStack.length > 0 && dstStack[dstStack.length - 1] < disk) return prev

                const next = {
                    A: [...prev.A],
                    B: [...prev.B],
                    C: [...prev.C],
                }
                next[from] = next[from].slice(0, -1)
                next[to] = [...next[to], disk]
                return next
            })

            setMoves((prev) => prev + 1)
        },
        [status],
    )

    // ── Win detection ─────────────────────────────────────────────────

    useEffect(() => {
        if (status !== "playing") return
        if (pegs.C.length !== diskCount) return

        let isComplete = true
        for (let i = 0; i < diskCount; i++) {
            if (pegs.C[i] !== diskCount - i) {
                isComplete = false
                break
            }
        }
        if (!isComplete) return

        setStatus("won")
        stopTimer()

        persistStats((prev) => {
            const bestMoves = { ...prev.bestMoves }
            const bestTimes = { ...prev.bestTimes }
            if (bestMoves[diskCount] === undefined || moves < bestMoves[diskCount]) {
                bestMoves[diskCount] = moves
            }
            if (bestTimes[diskCount] === undefined || time < bestTimes[diskCount]) {
                bestTimes[diskCount] = time
            }
            return {
                totalGames: prev.totalGames + 1,
                wins: prev.wins + 1,
                bestMoves,
                bestTimes,
            }
        })
    }, [pegs, status, diskCount, moves, time, stopTimer, persistStats])

    // ── Auto-solve win detection ──────────────────────────────────────

    useEffect(() => {
        if (status !== "auto_solving") return
        if (pegs.C.length !== diskCount) return

        let isComplete = true
        for (let i = 0; i < diskCount; i++) {
            if (pegs.C[i] !== diskCount - i) {
                isComplete = false
                break
            }
        }
        if (!isComplete) return

        clearAutoInterval()
        setStatus("won")
        stopTimer()
    }, [pegs, status, diskCount, clearAutoInterval, stopTimer])

    // ── selectPeg (two-click move system) ─────────────────────────────

    const selectPeg = useCallback(
        (peg: HanoiPeg) => {
            if (status !== "idle" && status !== "playing") return

            if (selectedPeg === null) {
                if (pegs[peg].length === 0) return
                setSelectedPeg(peg)
                return
            }

            if (selectedPeg === peg) {
                setSelectedPeg(null)
                return
            }

            const srcStack = pegs[selectedPeg]
            const dstStack = pegs[peg]
            const disk = srcStack[srcStack.length - 1]

            if (dstStack.length > 0 && dstStack[dstStack.length - 1] < disk) {
                setSelectedPeg(null)
                return
            }

            if (status === "idle") {
                setStatus("playing")
                startTimer()
            }

            setPegs((prev) => {
                const next = { A: [...prev.A], B: [...prev.B], C: [...prev.C] }
                next[selectedPeg] = next[selectedPeg].slice(0, -1)
                next[peg] = [...next[peg], disk]
                return next
            })
            setMoves((prev) => prev + 1)
            setSelectedPeg(null)
        },
        [status, selectedPeg, pegs, startTimer],
    )

    // ── setDiskCount ──────────────────────────────────────────────────

    const setDiskCount = useCallback(
        (n: number) => {
            const clamped = Math.max(MIN_DISKS, Math.min(MAX_DISKS, n))
            clearAutoInterval()
            stopTimer()
            solveStepsRef.current = []
            solveIndexRef.current = 0
            setDiskCountState(clamped)
            setPegs(createInitialPegs(clamped))
            setStatus("idle")
            setMoves(0)
            setTime(0)
            setSelectedPeg(null)
        },
        [clearAutoInterval, stopTimer],
    )

    // ── resetGame ─────────────────────────────────────────────────────

    const resetGame = useCallback(() => {
        clearAutoInterval()
        stopTimer()
        solveStepsRef.current = []
        solveIndexRef.current = 0
        setPegs(createInitialPegs(diskCount))
        setStatus("idle")
        setAutoSolvePaused(false)
        setMoves(0)
        setTime(0)
        setSelectedPeg(null)
    }, [diskCount, clearAutoInterval, stopTimer])

    // ── Auto-solve ────────────────────────────────────────────────────

    const startAutoInterval = useCallback(() => {
        clearAutoInterval()
        autoIntervalRef.current = setInterval(() => {
            const steps = solveStepsRef.current
            const idx = solveIndexRef.current
            if (idx >= steps.length) {
                clearAutoInterval()
                return
            }
            const step = steps[idx]
            solveIndexRef.current = idx + 1

            setPegs((prev) => {
                const srcStack = prev[step.from]
                if (srcStack.length === 0) return prev
                const disk = srcStack[srcStack.length - 1]
                const next = {
                    A: [...prev.A],
                    B: [...prev.B],
                    C: [...prev.C],
                }
                next[step.from] = next[step.from].slice(0, -1)
                next[step.to] = [...next[step.to], disk]
                return next
            })
            setMoves((prev) => prev + 1)
        }, SPEED_MS[speedRef.current])
    }, [clearAutoInterval])

    const autoSolve = useCallback(() => {
        clearAutoInterval()
        stopTimer()

        const initialPegs = createInitialPegs(diskCount)
        setPegs(initialPegs)
        setMoves(0)
        setTime(0)
        setSelectedPeg(null)

        const steps = generateSolveSteps(diskCount, "A", "B", "C")
        solveStepsRef.current = steps
        solveIndexRef.current = 0

        setStatus("auto_solving")
        setAutoSolvePaused(false)
        startTimer()
        startAutoInterval()
    }, [diskCount, clearAutoInterval, stopTimer, startTimer, startAutoInterval])

    const pauseAutoSolve = useCallback(() => {
        if (status !== "auto_solving") return
        clearAutoInterval()
        stopTimer()
        setAutoSolvePaused(true)
    }, [status, clearAutoInterval, stopTimer])

    const resumeAutoSolve = useCallback(() => {
        if (status !== "auto_solving") return
        if (solveIndexRef.current >= solveStepsRef.current.length) return
        setAutoSolvePaused(false)
        startTimer()
        startAutoInterval()
    }, [status, startTimer, startAutoInterval])

    // ── setSpeed ──────────────────────────────────────────────────────

    const setSpeed = useCallback(
        (newSpeed: HanoiSpeed) => {
            setSpeedState(newSpeed)
            speedRef.current = newSpeed
            if (status === "auto_solving" && autoIntervalRef.current) {
                startAutoInterval()
            }
        },
        [status, startAutoInterval],
    )

    // ── Cleanup on unmount ────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (autoIntervalRef.current) clearInterval(autoIntervalRef.current)
        }
    }, [])

    return {
        pegs,
        diskCount,
        status,
        moves,
        optimalMoves,
        time,
        speed,
        stats,
        selectedPeg,
        autoSolvePaused,
        selectPeg,
        moveDisk,
        setDiskCount,
        resetGame,
        autoSolve,
        pauseAutoSolve,
        resumeAutoSolve,
        setSpeed,
    }
}
