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

export type BallSortMoveFeedback = {
    key: number
    from: number
    to: number
    color: number
    count: number
}

export type BallSortInvalidFeedback = {
    key: number
    index: number
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
    {
        id: "hexagon",
        name: "六色回环",
        hint: "每个颜色先找一根同色接力管，别急着把空管一次用满。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6],
            [4, 5, 6, 1],
            [5, 6, 1, 2],
            [6, 1, 2, 3],
            [],
            [],
        ],
    },
    {
        id: "tide",
        name: "七色潮汐",
        hint: "先锁住容易成管的颜色，再慢慢拆掉缠在一起的那几层。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6],
            [4, 5, 6, 7],
            [5, 6, 7, 1],
            [6, 7, 1, 2],
            [7, 1, 2, 3],
            [],
            [],
        ],
    },
    {
        id: "starring",
        name: "八色星环",
        hint: "保留空管给长链，短链先落袋，别让周转空间太早被占满。",
        capacity: 4,
        tubes: [
            [1, 2, 3, 4],
            [2, 3, 4, 5],
            [3, 4, 5, 6],
            [4, 5, 6, 7],
            [5, 6, 7, 8],
            [6, 7, 8, 1],
            [7, 8, 1, 2],
            [8, 1, 2, 3],
            [],
            [],
        ],
    },
    {
        id: "layered",
        name: "七色夹层",
        hint: "混层越多，越要按顶部颜色分段回收，别被中间颜色带偏。",
        capacity: 4,
        tubes: [
            [1, 2, 4, 6],
            [2, 3, 5, 7],
            [4, 5, 7, 2],
            [5, 6, 1, 3],
            [7, 1, 3, 5],
            [3, 4, 6, 1],
            [6, 7, 2, 4],
            [],
            [],
        ],
    },
    {
        id: "vortex",
        name: "七色漩涡",
        hint: "最后一关要靠多轮周转，先腾空间，再把同色球一层层卷回来。",
        capacity: 4,
        tubes: [
            [1, 4, 2, 5],
            [4, 7, 5, 1],
            [2, 5, 3, 6],
            [5, 1, 6, 2],
            [3, 6, 4, 7],
            [6, 2, 7, 3],
            [7, 3, 1, 4],
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

export function getTopRun(tube: number[]): { color: number; count: number } | null {
    if (tube.length === 0) return null
    const color = tube[tube.length - 1]
    let count = 0
    for (let index = tube.length - 1; index >= 0; index -= 1) {
        if (tube[index] !== color) break
        count += 1
    }
    return { color, count }
}

export function pourBalls(from: number[], to: number[], capacity: number): { from: number[]; to: number[] } | null {
    if (!canPour(from, to, capacity)) return null
    const nextFrom = [...from]
    const nextTo = [...to]
    const topRun = getTopRun(nextFrom)
    if (!topRun) return null
    const color = topRun.color
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
    const [moveFeedback, setMoveFeedback] = useState<BallSortMoveFeedback | null>(null)
    const [invalidFeedback, setInvalidFeedback] = useState<BallSortInvalidFeedback | null>(null)
    const solvedRecordedRef = useRef(false)
    const feedbackKeyRef = useRef(0)
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
                setInvalidFeedback(null)
                setSelected(index)
                return
            }
            if (selected === index) {
                setInvalidFeedback(null)
                setSelected(null)
                return
            }
            const result = pourBalls(tubes[selected], tubes[index], level.capacity)
            if (!result) {
                feedbackKeyRef.current += 1
                setInvalidFeedback({ key: feedbackKeyRef.current, index })
                setSelected(tubes[index].length > 0 ? index : null)
                return
            }
            const next = cloneTubes(tubes)
            next[selected] = result.from
            next[index] = result.to
            const nextMoves = moves + 1
            const movedCount = result.to.length - tubes[index].length
            const movedColor = result.to[result.to.length - 1]
            setTubes(next)
            setMoves(nextMoves)
            setSelected(null)
            setInvalidFeedback(null)
            feedbackKeyRef.current += 1
            setMoveFeedback({
                key: feedbackKeyRef.current,
                from: selected,
                to: index,
                color: movedColor,
                count: movedCount,
            })
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
        setMoveFeedback(null)
        setInvalidFeedback(null)
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
        moveFeedback,
        invalidFeedback,
        selectTube,
        startLevel,
        reset,
    }
}
