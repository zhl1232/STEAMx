// 记忆翻牌的共享数据与类型，供单机 hook、在线对战 API/hook 复用（服务端安全，无 React 依赖）。
// 在线对战服务端权威规则（翻牌、配对、计分、终局）在 SQL RPC memory_flip_card 内完成，
// 这里保留主题符号表、难度对数、房间行类型与服务端建牌（洗牌）。

import { generateRoomCode, type BaseMatchRow } from "@/lib/playground/online-room"

export { generateRoomCode }

export type MemoryTheme = "animals" | "nature" | "space" | "food" | "stem"
export type MemoryDifficulty = "easy" | "normal" | "hard"

export type MemoryThemeOption = {
    key: MemoryTheme
    label: string
    preview: string[]
}

/** 每套至少 18 个互异图案，覆盖 6×6（hard）难度 */
export const THEME_SYMBOLS: Record<MemoryTheme, string[]> = {
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

export const MEMORY_PAIRS: Record<MemoryDifficulty, number> = {
    easy: 8,
    normal: 10,
    hard: 18,
}

export function memorySymbolsFor(theme: MemoryTheme, difficulty: MemoryDifficulty): string[] {
    return THEME_SYMBOLS[theme].slice(0, MEMORY_PAIRS[difficulty])
}

export function getMemoryColumns(difficulty: MemoryDifficulty): number {
    if (difficulty === "easy") return 4
    if (difficulty === "normal") return 5
    return 6
}

export function getMemoryThemeSymbols(theme: MemoryTheme): string[] {
    return [...THEME_SYMBOLS[theme]]
}

export function isMemoryTheme(value: unknown): value is MemoryTheme {
    return typeof value === "string" && value in THEME_SYMBOLS
}

export function isMemoryDifficulty(value: unknown): value is MemoryDifficulty {
    return value === "easy" || value === "normal" || value === "hard"
}

// ── 在线对战 ────────────────────────────────────────────────────────
export type MemoryOnlineStatus = BaseMatchRow["status"]

/** 房间内的角色（与执子颜色无关，记忆翻牌只分先后手） */
export type MemoryRole = "host" | "guest"

/** 服务端权威牌堆中的一张牌；matched 记录被哪一方收走（未配对为 null）。 */
export type MemoryDeckCard = {
    id: string
    symbol: string
    matched: MemoryRole | null
}

export type MemoryFlipCardRef = { id: string; symbol: string }

/** 刚完成的一对翻牌，供前端只播一次揭示动画（按 result_seq 去重）。 */
export type MemoryLastResult = {
    a: MemoryFlipCardRef
    b: MemoryFlipCardRef
    matched: boolean
    by: MemoryRole
}

export type MemoryScores = { host: number; guest: number }

export type MemoryMatchRow = BaseMatchRow & {
    theme: MemoryTheme
    difficulty: MemoryDifficulty
    deck: MemoryDeckCard[]
    current_turn: MemoryRole
    first_flip: MemoryFlipCardRef | null
    last_result: MemoryLastResult | null
    result_seq: number
    scores: MemoryScores
    winner: MemoryRole | "draw" | null
}

/** RPC memory_flip_card 返回行 */
export type MemoryFlipResult = { ok: boolean; reason: string }

/**
 * 服务端建牌：每个符号两张，Fisher–Yates 洗牌，matched 初始为 null。
 * id 形如 `${theme}-${pairIndex}-a|b`，与单机 createMemoryDeck 命名一致。
 */
export function buildOnlineDeck(theme: MemoryTheme, difficulty: MemoryDifficulty): MemoryDeckCard[] {
    const symbols = memorySymbolsFor(theme, difficulty)
    const cards: MemoryDeckCard[] = symbols.flatMap((symbol, pairIndex) => [
        { id: `${theme}-${pairIndex}-a`, symbol, matched: null },
        { id: `${theme}-${pairIndex}-b`, symbol, matched: null },
    ])
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }
    return cards
}

export function opponentRole(role: MemoryRole): MemoryRole {
    return role === "host" ? "guest" : "host"
}
