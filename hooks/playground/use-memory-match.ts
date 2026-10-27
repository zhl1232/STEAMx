import { useCallback, useEffect, useMemo, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"
import {
    getMemoryColumns,
    getMemoryThemeSymbols,
    MEMORY_CONCEPT_OPTIONS,
    MEMORY_THEMES,
    memoryConceptsFor,
    type MemoryConceptFace,
    type MemoryConceptPack,
    type MemoryDifficulty,
    type MemoryTheme,
    type MemoryThemeOption,
} from "@/lib/playground/memory-online"

export {
    getMemoryColumns,
    getMemoryThemeSymbols,
    MEMORY_CONCEPT_OPTIONS,
    MEMORY_THEMES,
    type MemoryConceptFace,
    type MemoryConceptPack,
    type MemoryDifficulty,
    type MemoryTheme,
    type MemoryThemeOption,
}

/** Solo card: term paired with definition; match by shared pairKey (stored in symbol). */
export type MemoryCard = {
    id: string
    /** Shared pair key used for matching */
    symbol: string
    face: MemoryConceptFace
    label: string
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

function initialDeckSeed(pack: MemoryConceptPack, difficulty: MemoryDifficulty): number {
    const value = `${pack}:${difficulty}`
    let hash = 2166136261
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
}

function buildDeck(
    pack: MemoryConceptPack,
    difficulty: MemoryDifficulty,
    random: RandomSource = Math.random,
): MemoryCard[] {
    const pairs = memoryConceptsFor(pack, difficulty)
    const cards = pairs.flatMap((pair, pairIndex) => [
        {
            id: `${pack}-${pairIndex}-a`,
            symbol: pair.key,
            face: "term" as const,
            label: pair.term,
            matched: false,
        },
        {
            id: `${pack}-${pairIndex}-b`,
            symbol: pair.key,
            face: "def" as const,
            label: pair.def,
            matched: false,
        },
    ])
    return cards
        .map((card) => ({ card, sort: random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ card }) => card)
}

function buildInitialDeck(pack: MemoryConceptPack, difficulty: MemoryDifficulty): MemoryCard[] {
    return buildDeck(pack, difficulty, createSeededRandom(initialDeckSeed(pack, difficulty)))
}

export function createMemoryDeck(
    difficulty: MemoryDifficulty,
    pack: MemoryConceptPack = "physics",
): MemoryCard[] {
    return buildDeck(pack, difficulty)
}

export type StartMemoryGameOptions = {
    difficulty?: MemoryDifficulty
    pack?: MemoryConceptPack
    /** @deprecated use pack; kept so old callers compiling against theme still typecheck if any */
    theme?: MemoryTheme
}

export function useMemoryMatch(
    initialDifficulty: MemoryDifficulty = "easy",
    initialPack: MemoryConceptPack = "physics",
) {
    const [difficulty, setDifficulty] = useState(initialDifficulty)
    const [pack, setPack] = useState(initialPack)
    const [cards, setCards] = useState<MemoryCard[]>(() => buildInitialDeck(initialPack, initialDifficulty))
    const [openIds, setOpenIds] = useState<string[]>([])
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [stats, setStats] = useState<MemoryStats>(() => ({ ...EMPTY_STATS }))

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        setCards(buildDeck(initialPack, initialDifficulty))
        setPack(initialPack)
    }, [initialDifficulty, initialPack])

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
        const matched = Boolean(first && second && first.symbol === second.symbol)
        const id = setTimeout(() => {
            if (matched && first) {
                setCards((current) =>
                    current.map((card) =>
                        card.symbol === first.symbol ? { ...card, matched: true } : card,
                    ),
                )
            }
            setOpenIds([])
        }, matched ? 320 : 900)
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
        const nextPack = options?.pack ?? pack
        setDifficulty(nextDifficulty)
        setPack(nextPack)
        setCards(buildDeck(nextPack, nextDifficulty))
        setOpenIds([])
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [difficulty, pack])

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
        pack,
        /** alias for older UI that still said theme */
        theme: pack,
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
