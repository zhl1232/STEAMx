import { useCallback, useEffect, useMemo, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"
import {
    getMemoryColumns,
    getMemoryThemeSymbols,
    MEMORY_THEMES,
    memorySymbolsFor,
    type MemoryDifficulty,
    type MemoryTheme,
    type MemoryThemeOption,
} from "@/lib/playground/memory-online"

// 主题符号表、难度对数、列数等静态数据已下沉到 lib/playground/memory-online.ts（服务端安全），
// 单机与在线对战共用。此处 re-export 保持既有导入路径不变。
export {
    getMemoryColumns,
    getMemoryThemeSymbols,
    MEMORY_THEMES,
    type MemoryDifficulty,
    type MemoryTheme,
    type MemoryThemeOption,
}

/** 单机模式的牌：matched 为布尔（在线模式记录归属方，见 memory-online.ts） */
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

type RandomSource = () => number

function createSeededRandom(seed: number): RandomSource {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

function initialDeckSeed(theme: MemoryTheme, difficulty: MemoryDifficulty): number {
    const value = `${theme}:${difficulty}`
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function buildDeck(
    theme: MemoryTheme,
    difficulty: MemoryDifficulty,
    random: RandomSource = Math.random,
): MemoryCard[] {
    const symbols = memorySymbolsFor(theme, difficulty)
    const cards = symbols.flatMap((symbol, pairIndex) => [
        { id: `${theme}-${pairIndex}-a`, symbol, matched: false },
        { id: `${theme}-${pairIndex}-b`, symbol, matched: false },
    ])
    return cards
        .map((card) => ({ card, sort: random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ card }) => card)
}

function buildInitialDeck(theme: MemoryTheme, difficulty: MemoryDifficulty): MemoryCard[] {
    return buildDeck(theme, difficulty, createSeededRandom(initialDeckSeed(theme, difficulty)))
}

export function createMemoryDeck(
    difficulty: MemoryDifficulty,
    theme: MemoryTheme = "animals",
): MemoryCard[] {
    return buildDeck(theme, difficulty)
}

export type StartMemoryGameOptions = {
    difficulty?: MemoryDifficulty
    theme?: MemoryTheme
}

export function useMemoryMatch(
    initialDifficulty: MemoryDifficulty = "easy",
    initialTheme: MemoryTheme = "animals",
) {
    const [difficulty, setDifficulty] = useState(initialDifficulty)
    const [theme, setTheme] = useState(initialTheme)
    // The first render is server-rendered and hydrated independently. Keep its deck
    // deterministic; the mount effect below replaces it with a fresh random deck.
    const [cards, setCards] = useState<MemoryCard[]>(() => buildInitialDeck(initialTheme, initialDifficulty))
    const [openIds, setOpenIds] = useState<string[]>([])
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [stats, setStats] = useState<MemoryStats>(() => ({ ...EMPTY_STATS }))

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        setCards(buildDeck(initialTheme, initialDifficulty))
        setTheme(initialTheme)
    }, [initialDifficulty, initialTheme])

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

    const startNewGame = useCallback((options?: StartMemoryGameOptions) => {
        const nextDifficulty = options?.difficulty ?? difficulty
        const nextTheme = options?.theme ?? theme
        setDifficulty(nextDifficulty)
        setTheme(nextTheme)
        setCards(buildDeck(nextTheme, nextDifficulty))
        setOpenIds([])
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [difficulty, theme])

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
        theme,
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
