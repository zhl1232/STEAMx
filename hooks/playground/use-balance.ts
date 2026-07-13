import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type BalanceLevel = {
    id: string
    name: string
    hint: string
    coinCount: number
    /** 假币下标（0-based），关卡固定便于复现教学 */
    fakeIndex: number
    /** true = 假币更轻 */
    fakeLighter: boolean
    maxWeighings: number
}

export type WeighResult = "left" | "right" | "equal"

export type BalanceStats = {
    totalGames: number
    solvedLevels: string[]
    bestWeighings: Record<string, number>
    bestTimes: Record<string, number>
}

const STATS_KEY = "balance_stats"
const EMPTY_STATS: BalanceStats = { totalGames: 0, solvedLevels: [], bestWeighings: {}, bestTimes: {} }

export const BALANCE_LEVELS: BalanceLevel[] = [
    {
        id: "three-light",
        name: "三币寻轻",
        hint: "只称一次：两边各放一枚，翘起的那边更轻；平衡则第三枚是假币。",
        coinCount: 3,
        fakeIndex: 2,
        fakeLighter: true,
        maxWeighings: 1,
    },
    {
        id: "nine-light",
        name: "九币寻轻",
        hint: "经典三分法：每次把硬币分成三组。",
        coinCount: 9,
        fakeIndex: 4,
        fakeLighter: true,
        maxWeighings: 2,
    },
    {
        id: "twelve-light",
        name: "十二寻轻",
        hint: "假币一定更轻，三次称量足够锁定。",
        coinCount: 12,
        fakeIndex: 7,
        fakeLighter: true,
        maxWeighings: 3,
    },
    {
        id: "nine-heavy",
        name: "九币寻重",
        hint: "这次假币更重：下沉的一侧可疑。",
        coinCount: 9,
        fakeIndex: 1,
        fakeLighter: false,
        maxWeighings: 2,
    },
    {
        id: "eight-mixed",
        name: "八币挑战",
        hint: "假币更轻。尽量用满两次称量前就锁定答案。",
        coinCount: 8,
        fakeIndex: 5,
        fakeLighter: true,
        maxWeighings: 3,
    },
]

export function weighCoins(
    left: number[],
    right: number[],
    fakeIndex: number,
    fakeLighter: boolean,
): WeighResult {
    const leftHasFake = left.includes(fakeIndex)
    const rightHasFake = right.includes(fakeIndex)
    if (!leftHasFake && !rightHasFake) return "equal"
    if (leftHasFake && !rightHasFake) return fakeLighter ? "right" : "left"
    if (rightHasFake && !leftHasFake) return fakeLighter ? "left" : "right"
    return "equal"
}

function loadStats(): BalanceStats {
    const raw = getPlaygroundItem<Partial<BalanceStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        solvedLevels: Array.isArray(raw.solvedLevels)
            ? raw.solvedLevels.filter((id): id is string => typeof id === "string")
            : [],
        bestWeighings: raw.bestWeighings && typeof raw.bestWeighings === "object" ? raw.bestWeighings : {},
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: BalanceStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function useBalance() {
    const [levelIndex, setLevelIndex] = useState(0)
    const [left, setLeft] = useState<number[]>([])
    const [right, setRight] = useState<number[]>([])
    const [lastResult, setLastResult] = useState<WeighResult | null>(null)
    const [weighings, setWeighings] = useState(0)
    const [history, setHistory] = useState<string[]>([])
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "solved" | "failed">("playing")
    const [message, setMessage] = useState<string | null>(null)
    const [stats, setStats] = useState<BalanceStats>(EMPTY_STATS)
    const solvedRecordedRef = useRef(false)
    const level = BALANCE_LEVELS[levelIndex]

    const availableCoins = useMemo(() => {
        const used = new Set([...left, ...right])
        return Array.from({ length: level.coinCount }, (_, index) => index).filter((coin) => !used.has(coin))
    }, [left, level.coinCount, right])

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((value) => value + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    const recordSolve = useCallback((solvedLevel: BalanceLevel, weighingCount: number, seconds: number) => {
        if (solvedRecordedRef.current) return
        solvedRecordedRef.current = true
        setStatus("solved")
        setStats((prev) => {
            const solvedLevels = prev.solvedLevels.includes(solvedLevel.id)
                ? prev.solvedLevels
                : [...prev.solvedLevels, solvedLevel.id]
            const previousWeighings = prev.bestWeighings[solvedLevel.id]
            const previousTime = prev.bestTimes[solvedLevel.id]
            const updated: BalanceStats = {
                totalGames: prev.totalGames + 1,
                solvedLevels,
                bestWeighings: {
                    ...prev.bestWeighings,
                    [solvedLevel.id]: previousWeighings ? Math.min(previousWeighings, weighingCount) : weighingCount,
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

    const toggleCoin = useCallback(
        (coin: number, side: "left" | "right") => {
            if (status !== "playing") return
            setLastResult(null)
            setMessage(null)
            if (side === "left") {
                setLeft((prev) => (prev.includes(coin) ? prev.filter((item) => item !== coin) : [...prev, coin].sort((a, b) => a - b)))
                setRight((prev) => prev.filter((item) => item !== coin))
            } else {
                setRight((prev) => (prev.includes(coin) ? prev.filter((item) => item !== coin) : [...prev, coin].sort((a, b) => a - b)))
                setLeft((prev) => prev.filter((item) => item !== coin))
            }
        },
        [status],
    )

    const clearPans = useCallback(() => {
        if (status !== "playing") return
        setLeft([])
        setRight([])
        setLastResult(null)
    }, [status])

    const doWeigh = useCallback(() => {
        if (status !== "playing") return
        if (left.length === 0 || right.length === 0) {
            setMessage("左右托盘都至少放一枚硬币。")
            return
        }
        if (left.length !== right.length) {
            setMessage("两边硬币数量要相同，结果才有意义。")
            return
        }
        if (weighings >= level.maxWeighings) {
            setMessage("称量次数已用完，请直接指认假币。")
            return
        }
        const result = weighCoins(left, right, level.fakeIndex, level.fakeLighter)
        const nextWeighings = weighings + 1
        setWeighings(nextWeighings)
        setLastResult(result)
        const label =
            result === "equal" ? "平衡" : result === "left" ? "左边更重" : "右边更重"
        setHistory((prev) => [
            ...prev,
            `第 ${nextWeighings} 次：L[${left.map((n) => n + 1).join(",")}] vs R[${right.map((n) => n + 1).join(",")}] → ${label}`,
        ])
        setMessage(null)
    }, [left, level, right, status, weighings])

    const guess = useCallback(
        (coin: number) => {
            if (status !== "playing") return
            if (coin === level.fakeIndex) {
                setMessage(`正确！假币是 #${coin + 1}（${level.fakeLighter ? "偏轻" : "偏重"}）。`)
                recordSolve(level, weighings, time)
                return
            }
            setStatus("failed")
            setMessage(`不对。假币其实是 #${level.fakeIndex + 1}。再开一局试试三分法。`)
            setStats((prev) => {
                const updated = { ...prev, totalGames: prev.totalGames + 1 }
                saveStats(updated)
                return updated
            })
        },
        [level, recordSolve, status, time, weighings],
    )

    const startLevel = useCallback((index: number) => {
        const nextIndex = Math.max(0, Math.min(BALANCE_LEVELS.length - 1, index))
        solvedRecordedRef.current = false
        setLevelIndex(nextIndex)
        setLeft([])
        setRight([])
        setLastResult(null)
        setWeighings(0)
        setHistory([])
        setTime(0)
        setStatus("playing")
        setMessage(null)
    }, [])

    return {
        level,
        levelIndex,
        levelCount: BALANCE_LEVELS.length,
        left,
        right,
        availableCoins,
        lastResult,
        weighings,
        history,
        time,
        status,
        message,
        stats,
        toggleCoin,
        clearPans,
        doWeigh,
        guess,
        startLevel,
    }
}
