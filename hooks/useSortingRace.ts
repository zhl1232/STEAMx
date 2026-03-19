import { useCallback, useEffect, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export type SortingAlgorithm = "bubble" | "selection" | "insertion" | "merge" | "quick"

export type SortingStatus = "idle" | "running" | "paused" | "completed"

export type SortingSpeed = "slow" | "normal" | "fast"

export type SortingBar = {
    value: number
    state: "default" | "comparing" | "swapping" | "sorted" | "pivot"
}

export type SortingStats = {
    totalRuns: number
    algorithmsUsed: Record<string, number>
}

type Step = {
    bars: SortingBar[]
    comparisons: number
    swaps: number
}

const STATS_KEY = "sorting_race_stats"

const SPEED_MS: Record<SortingSpeed, number> = {
    slow: 200,
    normal: 50,
    fast: 5,
}

const EMPTY_STATS: SortingStats = {
    totalRuns: 0,
    algorithmsUsed: {},
}

// ── Stats persistence ────────────────────────────────────────────────

function loadStats(): SortingStats {
    const p = getPlaygroundItem<Partial<SortingStats>>(STATS_KEY)
    if (!p) return { ...EMPTY_STATS, algorithmsUsed: {} }
    return {
        totalRuns: p.totalRuns ?? 0,
        algorithmsUsed: p.algorithmsUsed ?? {},
    }
}

function saveStats(stats: SortingStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

// ── Array generation ─────────────────────────────────────────────────

function createRandomArray(size: number): number[] {
    return Array.from({ length: size }, () => Math.floor(Math.random() * 96) + 5)
}

function toBars(arr: number[], stateOverrides?: Map<number, SortingBar["state"]>): SortingBar[] {
    return arr.map((value, i) => ({
        value,
        state: stateOverrides?.get(i) ?? "default",
    }))
}

// ── Step generators ──────────────────────────────────────────────────

function generateBubbleSortSteps(arr: number[]): Step[] {
    const a = [...arr]
    const steps: Step[] = []
    let comparisons = 0
    let swaps = 0
    const n = a.length

    for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < n - 1 - i; j++) {
            comparisons++
            const states = new Map<number, SortingBar["state"]>()
            states.set(j, "comparing")
            states.set(j + 1, "comparing")
            for (let k = n - i; k < n; k++) states.set(k, "sorted")
            steps.push({ bars: toBars(a, states), comparisons, swaps })

            if (a[j] > a[j + 1]) {
                ;[a[j], a[j + 1]] = [a[j + 1], a[j]]
                swaps++
                const swapStates = new Map<number, SortingBar["state"]>()
                swapStates.set(j, "swapping")
                swapStates.set(j + 1, "swapping")
                for (let k = n - i; k < n; k++) swapStates.set(k, "sorted")
                steps.push({ bars: toBars(a, swapStates), comparisons, swaps })
            }
        }
        const sortedStates = new Map<number, SortingBar["state"]>()
        for (let k = n - 1 - i; k < n; k++) sortedStates.set(k, "sorted")
        steps.push({ bars: toBars(a, sortedStates), comparisons, swaps })
    }

    const allSorted = new Map<number, SortingBar["state"]>()
    for (let i = 0; i < n; i++) allSorted.set(i, "sorted")
    steps.push({ bars: toBars(a, allSorted), comparisons, swaps })

    return steps
}

function generateSelectionSortSteps(arr: number[]): Step[] {
    const a = [...arr]
    const steps: Step[] = []
    let comparisons = 0
    let swaps = 0
    const n = a.length

    for (let i = 0; i < n - 1; i++) {
        let minIdx = i
        for (let j = i + 1; j < n; j++) {
            comparisons++
            const states = new Map<number, SortingBar["state"]>()
            for (let k = 0; k < i; k++) states.set(k, "sorted")
            states.set(minIdx, "pivot")
            states.set(j, "comparing")
            steps.push({ bars: toBars(a, states), comparisons, swaps })

            if (a[j] < a[minIdx]) {
                minIdx = j
            }
        }

        if (minIdx !== i) {
            ;[a[i], a[minIdx]] = [a[minIdx], a[i]]
            swaps++
            const swapStates = new Map<number, SortingBar["state"]>()
            for (let k = 0; k < i; k++) swapStates.set(k, "sorted")
            swapStates.set(i, "swapping")
            swapStates.set(minIdx, "swapping")
            steps.push({ bars: toBars(a, swapStates), comparisons, swaps })
        }

        const sortedStates = new Map<number, SortingBar["state"]>()
        for (let k = 0; k <= i; k++) sortedStates.set(k, "sorted")
        steps.push({ bars: toBars(a, sortedStates), comparisons, swaps })
    }

    const allSorted = new Map<number, SortingBar["state"]>()
    for (let i = 0; i < n; i++) allSorted.set(i, "sorted")
    steps.push({ bars: toBars(a, allSorted), comparisons, swaps })

    return steps
}

function generateInsertionSortSteps(arr: number[]): Step[] {
    const a = [...arr]
    const steps: Step[] = []
    let comparisons = 0
    let swaps = 0
    const n = a.length

    const markSorted = (states: Map<number, SortingBar["state"]>, upTo: number) => {
        for (let k = 0; k <= upTo; k++) states.set(k, "sorted")
    }

    for (let i = 1; i < n; i++) {
        let j = i
        while (j > 0) {
            comparisons++
            const states = new Map<number, SortingBar["state"]>()
            states.set(j, "comparing")
            states.set(j - 1, "comparing")
            steps.push({ bars: toBars(a, states), comparisons, swaps })

            if (a[j - 1] > a[j]) {
                ;[a[j - 1], a[j]] = [a[j], a[j - 1]]
                swaps++
                const swapStates = new Map<number, SortingBar["state"]>()
                swapStates.set(j, "swapping")
                swapStates.set(j - 1, "swapping")
                steps.push({ bars: toBars(a, swapStates), comparisons, swaps })
                j--
            } else {
                break
            }
        }

        const sorted = new Map<number, SortingBar["state"]>()
        markSorted(sorted, i)
        steps.push({ bars: toBars(a, sorted), comparisons, swaps })
    }

    const allSorted = new Map<number, SortingBar["state"]>()
    for (let i = 0; i < n; i++) allSorted.set(i, "sorted")
    steps.push({ bars: toBars(a, allSorted), comparisons, swaps })

    return steps
}

function generateMergeSortSteps(arr: number[]): Step[] {
    const a = [...arr]
    const steps: Step[] = []
    let comparisons = 0
    let swaps = 0
    const sortedFlags = new Array(a.length).fill(false)

    function merge(left: number, mid: number, right: number) {
        const leftArr = a.slice(left, mid + 1)
        const rightArr = a.slice(mid + 1, right + 1)
        let i = 0
        let j = 0
        let k = left

        while (i < leftArr.length && j < rightArr.length) {
            comparisons++
            const states = new Map<number, SortingBar["state"]>()
            states.set(left + i, "comparing")
            states.set(mid + 1 + j, "comparing")
            for (let s = 0; s < a.length; s++) if (sortedFlags[s]) states.set(s, "sorted")
            steps.push({ bars: toBars(a, states), comparisons, swaps })

            if (leftArr[i] <= rightArr[j]) {
                a[k] = leftArr[i]
                i++
            } else {
                a[k] = rightArr[j]
                j++
                swaps++
            }
            k++

            const writeStates = new Map<number, SortingBar["state"]>()
            writeStates.set(k - 1, "swapping")
            for (let s = 0; s < a.length; s++) if (sortedFlags[s]) writeStates.set(s, "sorted")
            steps.push({ bars: toBars(a, writeStates), comparisons, swaps })
        }

        while (i < leftArr.length) {
            a[k] = leftArr[i]
            i++
            k++
        }

        while (j < rightArr.length) {
            a[k] = rightArr[j]
            j++
            k++
        }
    }

    function mergeSort(left: number, right: number) {
        if (left >= right) return
        const mid = Math.floor((left + right) / 2)
        mergeSort(left, mid)
        mergeSort(mid + 1, right)
        merge(left, mid, right)

        if (left === 0 && right === a.length - 1) {
            for (let i = left; i <= right; i++) sortedFlags[i] = true
        }
    }

    mergeSort(0, a.length - 1)

    const allSorted = new Map<number, SortingBar["state"]>()
    for (let i = 0; i < a.length; i++) allSorted.set(i, "sorted")
    steps.push({ bars: toBars(a, allSorted), comparisons, swaps })

    return steps
}

function generateQuickSortSteps(arr: number[]): Step[] {
    const a = [...arr]
    const steps: Step[] = []
    let comparisons = 0
    let swaps = 0
    const sortedFlags = new Array(a.length).fill(false)

    function addStep(overrides: Map<number, SortingBar["state"]>) {
        for (let s = 0; s < a.length; s++) {
            if (sortedFlags[s] && !overrides.has(s)) overrides.set(s, "sorted")
        }
        steps.push({ bars: toBars(a, overrides), comparisons, swaps })
    }

    function partition(low: number, high: number): number {
        const pivotVal = a[high]
        const pivotStates = new Map<number, SortingBar["state"]>()
        pivotStates.set(high, "pivot")
        addStep(pivotStates)

        let i = low - 1
        for (let j = low; j < high; j++) {
            comparisons++
            const cmpStates = new Map<number, SortingBar["state"]>()
            cmpStates.set(high, "pivot")
            cmpStates.set(j, "comparing")
            if (i >= low) cmpStates.set(i, "comparing")
            addStep(cmpStates)

            if (a[j] <= pivotVal) {
                i++
                if (i !== j) {
                    ;[a[i], a[j]] = [a[j], a[i]]
                    swaps++
                    const swapStates = new Map<number, SortingBar["state"]>()
                    swapStates.set(high, "pivot")
                    swapStates.set(i, "swapping")
                    swapStates.set(j, "swapping")
                    addStep(swapStates)
                }
            }
        }

        ;[a[i + 1], a[high]] = [a[high], a[i + 1]]
        if (i + 1 !== high) swaps++
        sortedFlags[i + 1] = true

        const placedStates = new Map<number, SortingBar["state"]>()
        placedStates.set(i + 1, "sorted")
        addStep(placedStates)

        return i + 1
    }

    function quickSort(low: number, high: number) {
        if (low >= high) {
            if (low === high) sortedFlags[low] = true
            return
        }
        const pi = partition(low, high)
        quickSort(low, pi - 1)
        quickSort(pi + 1, high)
    }

    quickSort(0, a.length - 1)

    const allSorted = new Map<number, SortingBar["state"]>()
    for (let i = 0; i < a.length; i++) allSorted.set(i, "sorted")
    steps.push({ bars: toBars(a, allSorted), comparisons, swaps })

    return steps
}

const STEP_GENERATORS: Record<SortingAlgorithm, (arr: number[]) => Step[]> = {
    bubble: generateBubbleSortSteps,
    selection: generateSelectionSortSteps,
    insertion: generateInsertionSortSteps,
    merge: generateMergeSortSteps,
    quick: generateQuickSortSteps,
}

// ── React Hook ───────────────────────────────────────────────────────

export function useSortingRace() {
    const [bars, setBars] = useState<SortingBar[]>([])
    const [algorithm, setAlgorithmState] = useState<SortingAlgorithm>("bubble")
    const [arraySize, setArraySizeState] = useState(20)
    const [status, setStatus] = useState<SortingStatus>("idle")
    const [speed, setSpeedState] = useState<SortingSpeed>("normal")
    const [comparisons, setComparisons] = useState(0)
    const [swaps, setSwaps] = useState(0)
    const [elapsedMs, setElapsedMs] = useState(0)
    const [stats, setStats] = useState<SortingStats>(() => loadStats())

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const stepsRef = useRef<Step[]>([])
    const stepIndexRef = useRef(0)
    const speedRef = useRef<SortingSpeed>(speed)
    const statusRef = useRef<SortingStatus>(status)
    const startTimeRef = useRef(0)
    const pausedElapsedRef = useRef(0)
    const rawArrayRef = useRef<number[]>([])

    speedRef.current = speed
    statusRef.current = status

    const persistStats = useCallback((updater: (prev: SortingStats) => SortingStats) => {
        setStats((prev) => {
            const next = updater(prev)
            saveStats(next)
            return next
        })
    }, [])

    const stopInterval = useCallback(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    const stopTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const startTimer = useCallback(() => {
        stopTimer()
        startTimeRef.current = Date.now()
        timerRef.current = setInterval(() => {
            setElapsedMs(pausedElapsedRef.current + (Date.now() - startTimeRef.current))
        }, 16)
    }, [stopTimer])

    const advanceStep = useCallback(() => {
        const steps = stepsRef.current
        const idx = stepIndexRef.current

        if (idx >= steps.length) {
            stopInterval()
            stopTimer()
            setStatus("completed")
            statusRef.current = "completed"
            setElapsedMs(pausedElapsedRef.current + (Date.now() - startTimeRef.current))
            return
        }

        const step = steps[idx]
        setBars(step.bars)
        setComparisons(step.comparisons)
        setSwaps(step.swaps)
        stepIndexRef.current = idx + 1
    }, [stopInterval, stopTimer])

    const startInterval = useCallback(() => {
        stopInterval()
        intervalRef.current = setInterval(() => {
            advanceStep()
        }, SPEED_MS[speedRef.current])
    }, [advanceStep, stopInterval])

    const generateArray = useCallback(() => {
        stopInterval()
        stopTimer()
        const arr = createRandomArray(arraySize)
        rawArrayRef.current = arr
        setBars(toBars(arr))
        setComparisons(0)
        setSwaps(0)
        setElapsedMs(0)
        setStatus("idle")
        stepsRef.current = []
        stepIndexRef.current = 0
        pausedElapsedRef.current = 0
    }, [arraySize, stopInterval, stopTimer])

    const start = useCallback(() => {
        if (rawArrayRef.current.length === 0) return

        const steps = STEP_GENERATORS[algorithm](rawArrayRef.current)
        stepsRef.current = steps
        stepIndexRef.current = 0
        pausedElapsedRef.current = 0
        setComparisons(0)
        setSwaps(0)
        setElapsedMs(0)

        persistStats((prev) => ({
            totalRuns: prev.totalRuns + 1,
            algorithmsUsed: {
                ...prev.algorithmsUsed,
                [algorithm]: (prev.algorithmsUsed[algorithm] ?? 0) + 1,
            },
        }))

        setStatus("running")
        startTimer()
        startInterval()
    }, [algorithm, persistStats, startTimer, startInterval])

    const pause = useCallback(() => {
        if (statusRef.current !== "running") return
        stopInterval()
        stopTimer()
        pausedElapsedRef.current += Date.now() - startTimeRef.current
        setElapsedMs(pausedElapsedRef.current)
        setStatus("paused")
    }, [stopInterval, stopTimer])

    const resume = useCallback(() => {
        if (statusRef.current !== "paused") return
        setStatus("running")
        startTimer()
        startInterval()
    }, [startTimer, startInterval])

    const reset = useCallback(() => {
        stopInterval()
        stopTimer()
        const arr = rawArrayRef.current.length > 0 ? rawArrayRef.current : createRandomArray(arraySize)
        rawArrayRef.current = arr
        setBars(toBars(arr))
        setComparisons(0)
        setSwaps(0)
        setElapsedMs(0)
        setStatus("idle")
        stepsRef.current = []
        stepIndexRef.current = 0
        pausedElapsedRef.current = 0
    }, [arraySize, stopInterval, stopTimer])

    const setAlgorithm = useCallback(
        (algo: SortingAlgorithm) => {
            if (statusRef.current === "running" || statusRef.current === "paused") return
            setAlgorithmState(algo)
        },
        [],
    )

    const setArraySize = useCallback(
        (size: number) => {
            if (statusRef.current === "running" || statusRef.current === "paused") return
            setArraySizeState(size)
        },
        [],
    )

    const setSpeed = useCallback(
        (newSpeed: SortingSpeed) => {
            setSpeedState(newSpeed)
            speedRef.current = newSpeed
            if (statusRef.current === "running") {
                startInterval()
            }
        },
        [startInterval],
    )

    useEffect(() => {
        generateArray()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        return () => {
            stopInterval()
            stopTimer()
        }
    }, [stopInterval, stopTimer])

    return {
        bars,
        algorithm,
        arraySize,
        status,
        speed,
        comparisons,
        swaps,
        elapsedMs,
        stats,
        setAlgorithm,
        setArraySize,
        setSpeed,
        generateArray,
        start,
        pause,
        resume,
        reset,
    }
}
