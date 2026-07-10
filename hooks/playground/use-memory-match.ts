import { useCallback, useEffect, useMemo, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type MemoryDifficulty = "easy" | "normal" | "hard"

export type MemoryCard = {
    id: string
    symbol: string
    matched: boolean
}

export type MemoryStats = {
    totalGames: number
    wins: number
    bestMoves: Record<string, number>
    bestTimes: Record<string, number>
}

const STATS_KEY = "memory_match_stats"
const SYMBOLS = ["DNA", "π", "⚙", "★", "∞", "AI", "H₂O", "∑", "光", "磁", "芽", "火", "云", "桥", "弦", "晶", "轨", "波"]
const PAIRS: Record<MemoryDifficulty, number> = {
    easy: 8,
    normal: 10,
    hard: 18,
}

const EMPTY_STATS: MemoryStats = {
    totalGames: 0,
    wins: 0,
    bestMoves: {},
    bestTimes: {},
}

function loadStats(): MemoryStats {
    const raw = getPlaygroundItem<Partial<MemoryStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        wins: typeof raw.wins === "number" ? raw.wins : 0,
        bestMoves: raw.bestMoves && typeof raw.bestMoves === "object" ? raw.bestMoves : {},
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
    }
}

function saveStats(stats: MemoryStats) {
    setPlaygroundItem(STATS_KEY, stats)
}

export function createMemoryDeck(difficulty: MemoryDifficulty): MemoryCard[] {
    const symbols = SYMBOLS.slice(0, PAIRS[difficulty])
    const cards = symbols.flatMap((symbol, pairIndex) => [
        { id: `${symbol}-${pairIndex}-a`, symbol, matched: false },
        { id: `${symbol}-${pairIndex}-b`, symbol, matched: false },
    ])
    return cards
        .map((card) => ({ card, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ card }) => card)
}

export function getMemoryColumns(difficulty: MemoryDifficulty): number {
    if (difficulty === "easy") return 4
    if (difficulty === "normal") return 5
    return 6
}

export function useMemoryMatch(initialDifficulty: MemoryDifficulty = "easy") {
    const [difficulty, setDifficulty] = useState(initialDifficulty)
    const [cards, setCards] = useState<MemoryCard[]>(() =>
        SYMBOLS.slice(0, PAIRS[initialDifficulty]).flatMap((symbol, pairIndex) => [
            { id: `${symbol}-${pairIndex}-a`, symbol, matched: false },
            { id: `${symbol}-${pairIndex}-b`, symbol, matched: false },
        ]),
    )
    const [openIds, setOpenIds] = useState<string[]>([])
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [stats, setStats] = useState<MemoryStats>(() => ({ ...EMPTY_STATS }))

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        setCards(createMemoryDeck(initialDifficulty))
    }, [initialDifficulty])

    useEffect(() => {
        if (status !== "playing") return
        const id = setInterval(() => setTime((current) => current + 1), 1000)
        return () => clearInterval(id)
    }, [status])

    useEffect(() => {
        if (openIds.length !== 2) return
        const [firstId, secondId] = openIds
        const first = cards.find((card) => card.id === firstId)
        const second = cards.find((card) => card.id === secondId)
        const id = setTimeout(() => {
            if (first && second && first.symbol === second.symbol) {
                setCards((current) =>
                    current.map((card) =>
                        card.symbol === first.symbol ? { ...card, matched: true } : card,
                    ),
                )
            }
            setOpenIds([])
        }, first && second && first.symbol === second.symbol ? 250 : 700)
        return () => clearTimeout(id)
    }, [cards, openIds])

    useEffect(() => {
        if (status === "won" || cards.some((card) => !card.matched)) return
        setStatus("won")
        setStats((prev) => {
            const updated = {
                totalGames: prev.totalGames + 1,
                wins: prev.wins + 1,
                bestMoves: {
                    ...prev.bestMoves,
                    [difficulty]: prev.bestMoves[difficulty] ? Math.min(prev.bestMoves[difficulty], moves) : moves,
                },
                bestTimes: {
                    ...prev.bestTimes,
                    [difficulty]: prev.bestTimes[difficulty] ? Math.min(prev.bestTimes[difficulty], time) : time,
                },
            }
            saveStats(updated)
            return updated
        })
    }, [cards, difficulty, moves, status, time])

    const startNewGame = useCallback((nextDifficulty: MemoryDifficulty = difficulty) => {
        setDifficulty(nextDifficulty)
        setCards(createMemoryDeck(nextDifficulty))
        setOpenIds([])
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [difficulty])

    const flipCard = useCallback((id: string) => {
        if (status === "won" || openIds.length >= 2 || openIds.includes(id)) return
        const card = cards.find((item) => item.id === id)
        if (!card || card.matched) return
        const next = [...openIds, id]
        setOpenIds(next)
        if (next.length === 2) setMoves((value) => value + 1)
    }, [cards, openIds, status])

    const visibleCards = useMemo(() =>
        cards.map((card) => ({
            ...card,
            open: card.matched || openIds.includes(card.id),
        })),
    [cards, openIds])

    return {
        difficulty,
        cards: visibleCards,
        moves,
        time,
        status,
        stats,
        columns: getMemoryColumns(difficulty),
        flipCard,
        startNewGame,
    }
}
