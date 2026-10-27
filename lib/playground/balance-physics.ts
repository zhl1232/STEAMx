// 天平称重 · 物理模式：杠杆平衡（F₁·L₁ = F₂·L₂）与密度比较（ρ = m / V）。纯函数，便于测试。
import { getPlaygroundItem, setPlaygroundItem } from "@/lib/playground/storage"

export const BALANCE_STATS_KEY = "balance_stats"
export type PhysicsProgressField = "leverSolved" | "densitySolved"

export function loadPhysicsProgress(field: PhysicsProgressField): string[] {
    const raw = getPlaygroundItem<Record<string, unknown>>(BALANCE_STATS_KEY)
    const list = raw?.[field]
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []
}

export function savePhysicsProgress(field: PhysicsProgressField, solved: string[]) {
    const current = getPlaygroundItem<Record<string, unknown>>(BALANCE_STATS_KEY) ?? {}
    setPlaygroundItem(BALANCE_STATS_KEY, { ...current, [field]: solved })
}

/* ---------- 杠杆 ---------- */

/** 支点两侧各 4 个挂点，距离 1–4 格 */
export const LEVER_PEGS = [1, 2, 3, 4] as const

export type LeverPuzzle = {
    id: string
    name: string
    /** 左侧固定砝码：distance → 个数（每个砝码重 1 份） */
    left: Record<number, number>
    /** 右侧最多可用的砝码个数 */
    maxWeights: number
    tip: string
}

export const LEVER_PUZZLES: LeverPuzzle[] = [
    { id: "lever-1", name: "跷跷板", left: { 2: 2 }, maxWeights: 4, tip: "左边 2 个砝码挂在 2 格处。右边怎么挂能平衡？" },
    { id: "lever-2", name: "以远补轻", left: { 2: 3 }, maxWeights: 2, tip: "只能用 2 个砝码，平衡左边 3 个。放远一点试试。" },
    { id: "lever-3", name: "一个顶三个", left: { 4: 1, 1: 2 }, maxWeights: 2, tip: "左边有两组砝码，先把它们的“力×力臂”加起来。" },
    { id: "lever-4", name: "省力挑战", left: { 3: 4 }, maxWeights: 3, tip: "左边 4 个挂在 3 格。只用 3 个砝码让它平衡。" },
    { id: "lever-5", name: "大力士", left: { 2: 5 }, maxWeights: 3, tip: "5 个砝码 × 2 格 = ？ 用 3 个砝码凑出来。" },
]

export function leverTorque(side: Record<number, number>): number {
    return Object.entries(side).reduce((sum, [d, n]) => sum + Number(d) * n, 0)
}

export function leverCount(side: Record<number, number>): number {
    return Object.values(side).reduce((sum, n) => sum + n, 0)
}

/** 倾斜角（度）：左边力矩大 → 负值（左端下沉）。最大 ±14°。 */
export function leverTilt(leftTorque: number, rightTorque: number): number {
    const diff = rightTorque - leftTorque
    if (diff === 0) return 0
    return Math.max(-14, Math.min(14, diff * 2.5))
}

export function describeLever(side: Record<number, number>): string {
    const parts = Object.entries(side)
        .filter(([, n]) => n > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([d, n]) => `${n}×${d}`)
    return parts.length ? parts.join(" + ") : "0"
}

/** 是否存在 ≤ maxWeights 个砝码的解（关卡自检） */
export function leverSolvable(puzzle: LeverPuzzle): boolean {
    const target = leverTorque(puzzle.left)
    const search = (index: number, left: number, remain: number): boolean => {
        if (remain === 0) return true
        if (index >= LEVER_PEGS.length || left === 0) return false
        const d = LEVER_PEGS[index]
        for (let n = 0; n <= left && n * d <= remain; n += 1) {
            if (search(index + 1, left - n, remain - n * d)) return true
        }
        return false
    }
    return search(0, puzzle.maxWeights, target)
}

/* ---------- 密度 ---------- */

export type DensityMaterial = {
    id: string
    name: string
    emoji: string
    /** g/cm³ */
    density: number
    color: string
}

export const DENSITY_MATERIALS: Record<string, DensityMaterial> = {
    foam: { id: "foam", name: "泡沫", emoji: "☁️", density: 0.05, color: "bg-slate-100 dark:bg-slate-300" },
    wood: { id: "wood", name: "木头", emoji: "🪵", density: 0.6, color: "bg-amber-300 dark:bg-amber-400" },
    ice: { id: "ice", name: "冰", emoji: "🧊", density: 0.9, color: "bg-sky-200 dark:bg-sky-300" },
    aluminum: { id: "aluminum", name: "铝", emoji: "🥫", density: 2.7, color: "bg-zinc-300 dark:bg-zinc-400" },
    iron: { id: "iron", name: "铁", emoji: "🔩", density: 7.9, color: "bg-stone-500 dark:bg-stone-400" },
    copper: { id: "copper", name: "铜", emoji: "🪙", density: 8.9, color: "bg-orange-500 dark:bg-orange-400" },
}

export type DensityBlock = {
    id: string
    material: string
    /** cm³ */
    volume: number
}

export type DensityPuzzle = {
    id: string
    name: string
    kind: "same-volume" | "same-mass"
    goal: "pick-densest" | "sort"
    blocks: DensityBlock[]
    tip: string
    takeaway: string
}

const block = (material: string, volume: number): DensityBlock => ({ id: `${material}-${volume}`, material, volume })

export const DENSITY_PUZZLES: DensityPuzzle[] = [
    {
        id: "density-1", name: "一样大，谁更重", kind: "same-volume", goal: "pick-densest",
        blocks: [block("wood", 10), block("iron", 10)],
        tip: "两块一样大。放上天平称一称，再选出密度更大的那块。",
        takeaway: "体积相同时，质量越大，密度越大。",
    },
    {
        id: "density-2", name: "三块排排队", kind: "same-volume", goal: "sort",
        blocks: [block("aluminum", 10), block("wood", 10), block("copper", 10)],
        tip: "三块一样大。两两称一称，按密度从小到大点一遍。",
        takeaway: "同样大小的木头、铝、铜，质量依次变大，所以密度也依次变大。",
    },
    {
        id: "density-3", name: "一样重，谁最小", kind: "same-mass", goal: "pick-densest",
        blocks: [block("foam", 180), block("ice", 10), block("iron", 1.14)],
        tip: "这三个物体一样重（天平会平衡）。体积最小的那个密度最大。",
        takeaway: "质量相同时，体积越小，密度越大：ρ = m ÷ V。",
    },
    {
        id: "density-4", name: "四块大比拼", kind: "same-volume", goal: "sort",
        blocks: [block("iron", 10), block("ice", 10), block("copper", 10), block("wood", 10)],
        tip: "四块一样大，铁和铜很接近，要仔细称！",
        takeaway: "铜（8.9）比铁（7.9）密度略大，同样大小时铜更重。",
    },
]

export function blockMass(b: DensityBlock): number {
    return Math.round(DENSITY_MATERIALS[b.material].density * b.volume * 10) / 10
}

export function blockDensity(b: DensityBlock): number {
    return DENSITY_MATERIALS[b.material].density
}

export type DensityWeighResult = "left" | "right" | "equal"

export function weighBlocks(left: DensityBlock, right: DensityBlock): DensityWeighResult {
    const a = blockMass(left), b = blockMass(right)
    if (Math.abs(a - b) < 0.5) return "equal"
    return a > b ? "left" : "right"
}

export function densestBlock(blocks: DensityBlock[]): DensityBlock {
    return blocks.reduce((best, b) => (blockDensity(b) > blockDensity(best) ? b : best))
}

export function isSortedByDensity(order: DensityBlock[]): boolean {
    return order.every((b, i) => i === 0 || blockDensity(order[i - 1]) <= blockDensity(b))
}
