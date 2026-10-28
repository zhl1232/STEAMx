// 24 点 · 难度阶梯：入门（只用 + −，目标可小于 24）→ 进阶（+ − × ÷）→ 挑战（必须用 ÷ / 三步三种运算）。

export type Game24Op = "+" | "-" | "*" | "/"

export type Game24Level = {
    id: string
    tier: "入门" | "进阶" | "挑战"
    name: string
    target: number
    ops: Game24Op[]
    /** 牌面取值范围 */
    maxValue: number
    /** 解法必须包含 ÷ */
    requireDivision?: boolean
    /** 3 步运算必须各用一种不同的运算符 */
    distinctOps?: boolean
    /** 不依赖前一关，始终开放 */
    alwaysOpen?: boolean
    rule: string
}

/** 每关答对多少轮算通过 */
export const GAME24_CLEAR_WINS = 3

export const GAME24_LEVELS: Game24Level[] = [
    { id: "intro-10", tier: "入门", name: "凑 10", target: 10, ops: ["+", "-"], maxValue: 9, alwaysOpen: true, rule: "只用 + 和 −，让四张牌算出 10。" },
    { id: "intro-15", tier: "入门", name: "凑 15", target: 15, ops: ["+", "-"], maxValue: 9, rule: "只用 + 和 −，让四张牌算出 15。" },
    { id: "intro-24", tier: "入门", name: "加减 24", target: 24, ops: ["+", "-"], maxValue: 13, rule: "只用 + 和 −，算出 24。" },
    { id: "classic", tier: "进阶", name: "经典 24", target: 24, ops: ["+", "-", "*", "/"], maxValue: 13, alwaysOpen: true, rule: "用 + − × ÷ 和括号，算出 24。" },
    { id: "must-divide", tier: "挑战", name: "必须用 ÷", target: 24, ops: ["+", "-", "*", "/"], maxValue: 13, requireDivision: true, rule: "算出 24，而且算式里必须用到 ÷。" },
    { id: "three-ops", tier: "挑战", name: "三步三种运算", target: 24, ops: ["+", "-", "*", "/"], maxValue: 13, distinctOps: true, rule: "恰好 3 步算出 24，每一步用的运算都不一样。" },
]

export const DEFAULT_GAME24_LEVEL = "classic"

export function getGame24Level(id: string): Game24Level {
    return GAME24_LEVELS.find((level) => level.id === id) ?? GAME24_LEVELS.find((level) => level.id === DEFAULT_GAME24_LEVEL)!
}

export function isGame24LevelUnlocked(level: Game24Level, levelWins: Record<string, number>): boolean {
    if (level.alwaysOpen) return true
    const index = GAME24_LEVELS.findIndex((item) => item.id === level.id)
    if (index <= 0) return true
    return (levelWins[GAME24_LEVELS[index - 1].id] ?? 0) >= GAME24_CLEAR_WINS
}

/** 把表达式里的运算符取出来（×÷ 统一成 * /） */
export function expressionOps(expr: string): Game24Op[] {
    return (expr.replace(/×/g, "*").replace(/÷/g, "/").match(/[+\-*/]/g) ?? []) as Game24Op[]
}

const OP_LABEL: Record<Game24Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" }

/** 检查算式是否符合本关规则；返回错误文案或 null */
export function checkGame24Rule(expr: string, level: Game24Level): string | null {
    const ops = expressionOps(expr)
    const banned = ops.find((op) => !level.ops.includes(op))
    if (banned) return `本关只能用 ${level.ops.map((op) => OP_LABEL[op]).join(" 和 ")}，不能用 ${OP_LABEL[banned]}`
    if (level.requireDivision && !ops.includes("/")) return "本关的算式里必须用到 ÷"
    if (level.distinctOps && new Set(ops).size !== ops.length) return "本关 3 步要用 3 种不同的运算"
    return null
}
