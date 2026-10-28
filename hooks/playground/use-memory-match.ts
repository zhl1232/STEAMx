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
import {
    getMemoryLevel,
    isMemoryLevelUnlocked,
    MEMORY_LEVEL_THEMES,
    MEMORY_LEVELS,
    memoryLevelColumns,
    memoryLevelPairs,
    type MemoryLevel,
} from "@/lib/playground/memory-levels"

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
    /** 已通过的主题关卡 id，例如 "optics-1" */
    clearedLevels: string[]
}

const STATS_KEY = "memory_match_stats"

const EMPTY_STATS: MemoryStats = {
    totalGames: 0,
    wins: 0,
    bestMoves: {},
    bestTimes: {},
    clearedLevels: [],
}

function loadStats(): MemoryStats {
    const raw = getPlaygroundItem<Partial<MemoryStats>>(STATS_KEY)
    if (!raw) return { ...EMPTY_STATS }
    return {
        totalGames: typeof raw.totalGames === "number" ? raw.totalGames : 0,
        wins: typeof raw.wins === "number" ? raw.wins : 0,
        bestMoves: raw.bestMoves && typeof raw.bestMoves === "object" ? raw.bestMoves : {},
        bestTimes: raw.bestTimes && typeof raw.bestTimes === "object" ? raw.bestTimes : {},
        clearedLevels: Array.isArray(raw.clearedLevels)
            ? raw.clearedLevels.filter((id): id is string => typeof id === "string")
            : [],
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

export function createMemoryDeck(
    difficulty: MemoryDifficulty,
    pack: MemoryConceptPack = "physics",
): MemoryCard[] {
    return buildDeck(pack, difficulty)
}

export function buildLevelDeck(level: MemoryLevel, random: RandomSource = Math.random): MemoryCard[] {
    const cards = memoryLevelPairs(level).flatMap((pair, pairIndex) => [
        { id: `${level.id}-${pairIndex}-a`, symbol: pair.key, face: "term" as const, label: pair.term, matched: false },
        { id: `${level.id}-${pairIndex}-b`, symbol: pair.key, face: "def" as const, label: pair.def, matched: false },
    ])
    return cards
        .map((card) => ({ card, sort: random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ card }) => card)
}

function initialLevelDeck(level: MemoryLevel): MemoryCard[] {
    return buildLevelDeck(level, createSeededRandom(initialDeckSeed("physics", "easy") ^ level.pairCount))
}

export function useMemoryMatch(initialLevelId: string = MEMORY_LEVELS[0].id) {
    const [levelId, setLevelId] = useState(initialLevelId)
    const level = getMemoryLevel(levelId)
    const [cards, setCards] = useState<MemoryCard[]>(() => initialLevelDeck(getMemoryLevel(initialLevelId)))
    const [openIds, setOpenIds] = useState<string[]>([])
    const [moves, setMoves] = useState(0)
    const [time, setTime] = useState(0)
    const [status, setStatus] = useState<"playing" | "won">("playing")
    const [stats, setStats] = useState<MemoryStats>(() => ({ ...EMPTY_STATS }))

    usePlaygroundStatsLoader(() => setStats(loadStats()))

    useEffect(() => {
        setCards(buildLevelDeck(getMemoryLevel(initialLevelId)))
    }, [initialLevelId])

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
            const key = level.id
            const updated: MemoryStats = {
                totalGames: prev.totalGames + 1,
                wins: prev.wins + 1,
                bestMoves: { ...prev.bestMoves, [key]: prev.bestMoves[key] ? Math.min(prev.bestMoves[key], moves) : moves },
                bestTimes: { ...prev.bestTimes, [key]: prev.bestTimes[key] ? Math.min(prev.bestTimes[key], time) : time },
                clearedLevels: prev.clearedLevels.includes(key) ? prev.clearedLevels : [...prev.clearedLevels, key],
            }
            saveStats(updated)
            return updated
        })
    }, [cards, level.id, moves, status, time])

    const startLevel = useCallback((nextId?: string) => {
        const next = getMemoryLevel(nextId ?? levelId)
        setLevelId(next.id)
        setCards(buildLevelDeck(next))
        setOpenIds([])
        setMoves(0)
        setTime(0)
        setStatus("playing")
    }, [levelId])

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

    const nextLevel = useMemo(() => {
        const t = MEMORY_LEVEL_THEMES.find((item) => item.id === level.themeId)
        return t?.levels[level.index + 1] ?? null
    }, [level])

    return {
        level,
        nextLevel,
        cards: visibleCards,
        moves,
        time,
        status,
        stats,
        columns: memoryLevelColumns(level.pairCount),
        isUnlocked: (target: MemoryLevel) => isMemoryLevelUnlocked(target, stats.clearedLevels),
        flipCard,
        startLevel,
    }
}
