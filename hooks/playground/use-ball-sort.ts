import { useCallback, useEffect, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type BallSortLevel = {
    id: string
    name: string
    hint: string
    capacity: number
    /** 每管自底向上的颜色编号；0 表示空管占位不出现在初始数组里 */
    tubes: number[][]
}

export type BallSortStats = {
    totalGames: number
    solvedLevels: string[]
    bestMoves: Record<string, number>
    bestTimes: Record<string, number>
}

const STATS_KEY = "ball_sort_stats"
const EMPTY_STATS: BallSortStats = { totalGames: 0, solvedLevels: [], bestMoves: {}, bestTimes: {} }

export const BALL_SORT_LEVELS: BallSortLevel[] = [
    {
        id: "duo",
        name: "双色入门",
        hint: "一次只能倒同色连续球；空管是中转站。",
        capacity: 4,
        tubes: [
            [1, 2, 1, 2],
            [2, 1, 2, 1],
            [],
        ],
    },
    {
        id: "trio",
        name: "三色分流",
        hint: "先把快满的同色管收干净，再拆混色管。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 1],
            [2, 3, 1, 2],
            [3, 1, 2, 3],
            [],
            [],
        ],
    },
    {
        id: "rainbow",
        name: "四色彩虹",
        hint: "不要急着填满；留两根空管周转更稳。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 4],
            [2, 3, 4, 1],
            [3, 4, 1, 2],
            [4, 1, 2, 3],
            [],
            [],
        ],
    },
    {
        id: "stacked",
        name: "叠层谜题",
        hint: "同色不一定连续出现在同一管，先拆顶层。",
        capacity: 4,
        tubes: [
            [1, 1, 2, 3],
            [2, 3, 3, 1],
            [3, 2, 1, 2],
            [],
            [],
        ],
    },
    {
        id: "pentagon",
        name: "五色挑战",
        hint: "容量仍是 4：每色恰好 4 球，完成时每管纯色。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 4],
            [5, 1, 2, 3],
            [4, 5, 1, 2],
            [3, 4, 5, 1],
            [2, 3, 4, 5],
            [],
            [],
        ],
    },
]

export function isBallSortSolved(tubes: number[][], capacity: number): boolean {
    return tubes.every((tube) => {
        if (tube.length === 0) return true
        if (tube.length !== capacity) return false
        return tube.every((color) => color === tube[0])
    })
}

export function canPour(from: number[], to: number[], capacity: number): boolean {
    if (from.length === 0) return false
    if (to.length >= capacity) return false
    const color = from[from.length - 1]
    if (to.length === 0) return true
    return to[to.length - 1] === color
}

export function pourBalls(from: number[], to: number[], capacity: number): { from: number[]; to: number[] } | null {
    if (!canPour(from, to, capacity)) return null
    const nextFrom = [...from]
    const nextTo = [...to]
    const color = nextFrom[nextFrom.length - 1]
    while (
        nextFrom.length > 0 &&
        nextFrom[nextFrom.length - 1] === color &&
        nextTo.length < capacity
    ) {
        nextTo.push(nextFrom.pop()!)
    }
    return { from: nextFrom, to: nextTo }
}

function cloneTubes(tubes: number[][]): number[][] {
    return tubes.map((tube) => [...tube])
}

function loadStats(): BallSortStats {
    const raw = getPlaygroundItem<Partial<BallSortStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestMoves: raw.bestMoves && typeof raw.bestMoves === "object" ? raw.bestMoves : {},
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: BallSortStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useBallSort() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [tubes, setTubes] = useState<number[][]>(() => cloneTubes(BALL_SORT_LEVELS[0].tubes))
    const [selected, setSelected] = useState<number | null>(null)
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved">("playing")
    const [stats, setStats] = useState<BallSortStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const level = BALL_SORT_LEVELS[levelIndex]

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: BallSortLevel, moveCount: number, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousMoves = prev.bestMoves[solvedLevel.id]
            const previousTime = prev.bestTimes[solvedLevel.id]
            const updated: BallSortStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestMoves: {
                    ...prev.bestMoves,
                    [solvedLevel.id]: previousMoves ? Math.min(previousMoves, moveCount) : moveCount,
                },
                bestTimes: {
                    ...prev.bestTimes,
                    [solvedLevel.id]: previousTime ? Math.min(previousTime, seconds) : seconds,
                },
            }
            saveStats(updated)
            return updated
        })
    }, [])

    const selectTube = useCallback(
        (index: number) => {
            if (status === "solved") return
            if (selected === null) {
                if (tubes[index].length === 0) return
                setSelected(index)
                return
            }
            if (selected === index) {
                setSelected(null)
                return
            }
            const result = pourBalls(tubes[selected], tubes[index], level.capacity)
            if (!result) {
                setSelected(tubes[index].length > 0 ? index : null)
                return
            }
            const next = cloneTubes(tubes)
            next[selected] = result.from
            next[index] = result.to
            const nextMoves = moves + 1
            setTubes(next)
            setMoves(nextMoves)
            setSelected(null)
            if (isBallSortSolved(next, level.capacity)) {
                recordSolve(level, nextMoves, time)
            }
        },
        [level, moves, recordSolve, selected, status, time, tubes],
    )

    const startLevel = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(BALL_SORT_LEVELS.length - 1, index))
        solvedRecordedRef.current = false
        setLevelIndex(nextIndex)
        setTubes(cloneTubes(BALL_SORT_LEVELS[nextIndex].tubes))
        setSelected(null)
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [])

    const reset = useCallback(() => startLevel(levelIndex), [levelIndex, startLevel])

    return {
        level,
        levelIndex,
        levelCount: BALL_SORT_LEVELS.length,
        tubes,
        selected,
        moves,
        time,
        status,
        stats,
        selectTube,
        startLevel,
        reset,
    }
}
