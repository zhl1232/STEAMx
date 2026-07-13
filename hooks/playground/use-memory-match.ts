import { useCallback, useEffect, useMemo, useState } from "react"
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundStatsLoader } from "@/lib/playground/use-playground-stats-loader"

export type MemoryDifficulty = "easy" | "normal" | "hard"

export type MemoryTheme = "animals" | "nature" | "space" | "food" | "stem"

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

export type MemoryThemeOption = {
    key: MemoryTheme
    label: string
    preview: string[]
}

const STATS_KEY = "memory_match_stats"

/** 每套至少 18 个互异图案，覆盖 6×6 难度 */
const THEME_SYMBOLS: Record<MemoryTheme, string[]> = {
    animals: ["🦊", "🐼", "🦁", "🐸", "🐧", "🦋", "🐙", "🦄", "🐢", "🦉", "🐝", "🐬", "🦩", "🦔", "🐨", "🐯", "🦕", "🐲"],
    nature: ["🌸", "🌺", "🌻", "🍀", "🌈", "🌊", "🍄", "🌵", "🌴", "🍁", "🌕", "❄️", "🔥", "💧", "🍃", "🌿", "🌙", "⭐"],
    space: ["🚀", "🛸", "🪐", "☄️", "🌍", "👽", "🛰️", "🌌", "☀️", "💫", "🌑", "✨", "🌠", "🔭", "🌙", "⭐", "🔮", "🌟"],
    food: ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🥝", "🍉", "🍒", "🫐", "🍌", "🥑", "🍕", "🍪", "🧁", "🍩", "🍦", "🍬"],
    stem: ["🧬", "🔬", "⚗️", "🔭", "🧪", "🧲", "⚡", "💡", "🔋", "💻", "🧠", "⚛️", "🧮", "📐", "🌡️", "📡", "🚀", "🧿"],
}

export const MEMORY_THEMES: MemoryThemeOption[] = [
    { key: "animals", label: "萌宠", preview: THEME_SYMBOLS.animals.slice(0, 4) },
    { key: "nature", label: "自然", preview: THEME_SYMBOLS.nature.slice(0, 4) },
    { key: "space", label: "宇宙", preview: THEME_SYMBOLS.space.slice(0, 4) },
    { key: "food", label: "美食", preview: THEME_SYMBOLS.food.slice(0, 4) },
    { key: "stem", label: "科学", preview: THEME_SYMBOLS.stem.slice(0, 4) },
]

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

function symbolsFor(theme: MemoryTheme, difficulty: MemoryDifficulty): string[] {
    return THEME_SYMBOLS[theme].slice(0, PAIRS[difficulty])
}

function buildDeck(theme: MemoryTheme, difficulty: MemoryDifficulty): MemoryCard[] {
    const symbols = symbolsFor(theme, difficulty)
    const cards = symbols.flatMap((symbol, pairIndex) => [
        { id: `${theme}-${pairIndex}-a`, symbol, matched: false },
        { id: `${theme}-${pairIndex}-b`, symbol, matched: false },
    ])
    return cards
        .map((card) => ({ card, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ card }) => card)
}

export function createMemoryDeck(
    difficulty: MemoryDifficulty,
    theme: MemoryTheme = "animals",
): MemoryCard[] {
    return buildDeck(theme, difficulty)
}

export function getMemoryColumns(difficulty: MemoryDifficulty): number {
    if (difficulty === "easy") return 4
    if (difficulty === "normal") return 5
    return 6
}

export function getMemoryThemeSymbols(theme: MemoryTheme): string[] {
    return [...THEME_SYMBOLS[theme]]
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
    const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(initialTheme, initialDifficulty))
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
