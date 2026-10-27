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


export type MemoryConceptFace = "term" | "def"

export type MemoryConceptPair = {
    key: string
    term: string
    /** Short definition or emoji+phrase shown on the matching card */
    def: string
}

export type MemoryConceptPack = "physics" | "math"

/** Solo mode: pair a term with its definition (or picture cue). At least 18 pairs for hard. */
export const MEMORY_CONCEPT_PACKS: Record<MemoryConceptPack, MemoryConceptPair[]> = {
    physics: [
        { key: "force", term: "力", def: "改变物体运动状态的作用" },
        { key: "gravity", term: "重力", def: "地球对物体的吸引" },
        { key: "friction", term: "摩擦力", def: "阻碍相对运动的力" },
        { key: "pressure", term: "压强", def: "单位面积上的压力" },
        { key: "density", term: "密度", def: "质量 ÷ 体积" },
        { key: "buoyancy", term: "浮力", def: "液体对浸入物体向上的力" },
        { key: "inertia", term: "惯性", def: "保持原有运动状态的性质" },
        { key: "energy", term: "能量", def: "做功的本领" },
        { key: "kinetic", term: "动能", def: "物体因运动而具有的能" },
        { key: "potential", term: "势能", def: "由位置决定的能" },
        { key: "wave", term: "波", def: "振动在介质中的传播" },
        { key: "sound", term: "声音", def: "由物体振动产生" },
        { key: "light", term: "光", def: "能引起视觉的电磁波" },
        { key: "reflection", term: "反射", def: "光遇界面返回原介质" },
        { key: "refraction", term: "折射", def: "光进入另一介质改变方向" },
        { key: "circuit", term: "电路", def: "电流的闭合通路" },
        { key: "current", term: "电流", def: "电荷的定向移动" },
        { key: "voltage", term: "电压", def: "推动电荷流动的原因" },
        { key: "resistance", term: "电阻", def: "导体对电流的阻碍" },
        { key: "magnet", term: "磁体", def: "能吸引铁等的物体" },
    ],
    math: [
        { key: "prime", term: "质数", def: "只有 1 和自身两个因数" },
        { key: "even", term: "偶数", def: "能被 2 整除的整数" },
        { key: "odd", term: "奇数", def: "不能被 2 整除的整数" },
        { key: "fraction", term: "分数", def: "把整体平均分成若干份" },
        { key: "percent", term: "百分数", def: "分母是 100 的分数" },
        { key: "area", term: "面积", def: "平面图形所占大小" },
        { key: "perimeter", term: "周长", def: "封闭图形一周的长度" },
        { key: "volume", term: "体积", def: "立体所占空间大小" },
        { key: "angle", term: "角", def: "两条射线的公共端点张开" },
        { key: "parallel", term: "平行", def: "永不相交的两条直线" },
        { key: "perpendicular", term: "垂直", def: "相交成直角" },
        { key: "triangle", term: "三角形", def: "三条边围成的图形" },
        { key: "circle", term: "圆", def: "到定点距离相等的点集" },
        { key: "radius", term: "半径", def: "圆心到圆周的距离" },
        { key: "diameter", term: "直径", def: "过圆心的弦，最长" },
        { key: "equation", term: "方程", def: "含未知数的等式" },
        { key: "function", term: "函数", def: "一个量随另一个变化" },
        { key: "average", term: "平均数", def: "总和 ÷ 个数" },
        { key: "probability", term: "概率", def: "事件发生的可能性" },
        { key: "symmetry", term: "对称", def: "沿某线对折能重合" },
    ],
}

export const MEMORY_CONCEPT_OPTIONS: Array<{ key: MemoryConceptPack; label: string; preview: string[] }> = [
    { key: "physics", label: "物理概念", preview: ["力", "压强", "浮力", "电流"] },
    { key: "math", label: "数学概念", preview: ["质数", "面积", "方程", "对称"] },
]

export function memoryConceptsFor(pack: MemoryConceptPack, difficulty: MemoryDifficulty): MemoryConceptPair[] {
    return MEMORY_CONCEPT_PACKS[pack].slice(0, MEMORY_PAIRS[difficulty])
}

export function isMemoryConceptPack(value: unknown): value is MemoryConceptPack {
    return value === "physics" || value === "math"
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
