"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowRight,
    Award,
    BarChart3,
    Beaker,
    Bomb,
    Bot,
    Brain,
    Calculator,
    ChevronRight,
    Code2,
    Cog,
    Compass,
    Crown,
    Dna,
    Gamepad2,
    Grid3X3,
    Hash,
    Layers,
    Palette,
    RotateCw,
    Sigma,
    Star,
    Trophy,
    Zap,
    type LucideIcon,
} from "lucide-react"

import { BadgeIcon } from "@/components/features/gamification/badge-icon"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ToneBadge, type CategoryTone } from "@/components/ui/tone-badge"
import { BADGES, PLAYGROUND_BADGE_COUNT } from "@/lib/gamification/badges"
import { getPlaygroundItem, PLAYGROUND_CHANGE_EVENT } from "@/lib/playground/storage"
import { readMergedMinesweeperStats } from "@/lib/playground/minesweeper-stats"
import { cn } from "@/lib/utils"

type SteamTag = "Science" | "Technology" | "Engineering" | "Arts" | "Math"
type GameVisual = "mines" | "gomoku" | "life" | "2048" | "24" | "hanoi" | "sorting" | "sudoku" | "nqueens" | "circuit" | "fifteen" | "memory" | "quickmath" | "maze" | "tangram"

type GameCard = {
    name: string
    subtitle: string
    href: string
    icon: LucideIcon
    color: string
    iconBg: string
    visual: GameVisual
    tags: SteamTag[]
    description: string
    statsKey: string
    getPlayed: (raw: unknown) => number
    getWins: (raw: unknown) => number
}

/** 条目数变更时请同步 `lib/playground/catalog.ts` 的 PLAYGROUND_MINI_GAMES_COUNT（首页分类卡展示）。 */
const GAMES: GameCard[] = [
    {
        name: "扫雷",
        subtitle: "Minesweeper",
        href: "/playground/minesweeper",
        icon: Bomb,
        color: "text-primary",
        iconBg: "bg-blue-100 dark:bg-blue-400/10",
        visual: "mines",
        tags: ["Science", "Math"],
        description: "经典逻辑推理游戏，训练你的推理与安全排雷能力。",
        statsKey: "minesweeper_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames") || countBestTimeRecords(readBestTimes(raw)),
        getWins: (raw) => safeNum(raw, "wins") || countBestTimeRecords(readBestTimes(raw)),
    },
    {
        name: "五子棋",
        subtitle: "Gomoku",
        href: "/playground/gomoku",
        icon: Bot,
        color: "text-violet-600 dark:text-violet-300",
        iconBg: "bg-violet-100 dark:bg-violet-400/10",
        visual: "gomoku",
        tags: ["Technology"],
        description: "连续五子即可胜利，策略与布局的经典对决。",
        statsKey: "gomoku_records",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "生命游戏",
        subtitle: "Game of Life",
        href: "/playground/life",
        icon: Dna,
        color: "text-emerald-600 dark:text-emerald-300",
        iconBg: "bg-emerald-100 dark:bg-emerald-400/10",
        visual: "life",
        tags: ["Science", "Math"],
        description: "探索元胞自动机的奇妙世界，观察复杂系统的演化。",
        statsKey: "game_of_life_stats",
        getPlayed: (raw) => safeNum(raw, "totalSessions"),
        getWins: (raw) => safeNum(raw, "totalSessions"),
    },
    {
        name: "2048",
        subtitle: "",
        href: "/playground/2048",
        icon: Grid3X3,
        color: "text-amber-600 dark:text-amber-300",
        iconBg: "bg-amber-100 dark:bg-amber-400/10",
        visual: "2048",
        tags: ["Math", "Technology"],
        description: "合并相同数字，挑战你的逻辑与规划能力。",
        statsKey: "game_2048_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "24 点",
        subtitle: "24 Game",
        href: "/playground/24game",
        icon: Calculator,
        color: "text-sky-600 dark:text-sky-300",
        iconBg: "bg-sky-100 dark:bg-sky-400/10",
        visual: "24",
        tags: ["Math"],
        description: "用加减乘除算出 24，锻炼心算与运算能力。",
        statsKey: "game_24_stats",
        getPlayed: (raw) => safeNum(raw, "totalRounds"),
        getWins: (raw) => safeNum(raw, "solvedCount"),
    },
    {
        name: "汉诺塔",
        subtitle: "Hanoi Tower",
        href: "/playground/hanoi",
        icon: Layers,
        color: "text-orange-600 dark:text-orange-300",
        iconBg: "bg-orange-100 dark:bg-orange-400/10",
        visual: "hanoi",
        tags: ["Math", "Engineering"],
        description: "经典递归问题，最少步数完成所有圆盘移动。",
        statsKey: "hanoi_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "排序可视化",
        subtitle: "Sorting Visualizer",
        href: "/playground/sorting",
        icon: BarChart3,
        color: "text-cyan-600 dark:text-cyan-300",
        iconBg: "bg-cyan-100 dark:bg-cyan-400/10",
        visual: "sorting",
        tags: ["Technology", "Arts"],
        description: "通过可视化了解排序算法的原理与过程。",
        statsKey: "sorting_race_stats",
        getPlayed: (raw) => safeNum(raw, "totalRuns"),
        getWins: (raw) => safeNum(raw, "totalRuns"),
    },
    {
        name: "数独",
        subtitle: "Sudoku",
        href: "/playground/sudoku",
        icon: Hash,
        color: "text-rose-600 dark:text-rose-300",
        iconBg: "bg-rose-100 dark:bg-rose-400/10",
        visual: "sudoku",
        tags: ["Math", "Technology"],
        description: "逻辑填数，挑战你的耐心与推理能力。",
        statsKey: "sudoku_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "N 皇后",
        subtitle: "N-Queens",
        href: "/playground/nqueens",
        icon: Crown,
        color: "text-yellow-600 dark:text-yellow-300",
        iconBg: "bg-yellow-100 dark:bg-yellow-400/10",
        visual: "nqueens",
        tags: ["Technology", "Engineering"],
        description: "在 N×N 棋盘上放置 N 个皇后，互不攻击。",
        statsKey: "nqueens_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "manualSolves"),
    },
    {
        name: "电路拼图",
        subtitle: "Circuit Puzzle",
        href: "/playground/circuit",
        icon: Zap,
        color: "text-teal-600 dark:text-teal-300",
        iconBg: "bg-teal-100 dark:bg-teal-400/10",
        visual: "circuit",
        tags: ["Science", "Engineering"],
        description: "连接电路元件点亮灯泡，理解电路的工作原理。",
        statsKey: "circuit_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "solvedCount"),
    },
    {
        name: "数字华容道",
        subtitle: "15 Puzzle",
        href: "/playground/fifteen",
        icon: Grid3X3,
        color: "text-cyan-600 dark:text-cyan-300",
        iconBg: "bg-cyan-100 dark:bg-cyan-400/10",
        visual: "fifteen",
        tags: ["Math", "Engineering"],
        description: "滑动数字复原顺序，理解可解性与空间规划。",
        statsKey: "fifteen_puzzle_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "记忆翻牌",
        subtitle: "Memory Match",
        href: "/playground/memory",
        icon: Brain,
        color: "text-fuchsia-600 dark:text-fuchsia-300",
        iconBg: "bg-fuchsia-100 dark:bg-fuchsia-400/10",
        visual: "memory",
        tags: ["Science", "Arts"],
        description: "翻牌配对 STEAM 图案，训练工作记忆与空间记忆。",
        statsKey: "memory_match_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "速算闪电战",
        subtitle: "Quick Math",
        href: "/playground/quickmath",
        icon: Calculator,
        color: "text-amber-600 dark:text-amber-300",
        iconBg: "bg-amber-100 dark:bg-amber-400/10",
        visual: "quickmath",
        tags: ["Math"],
        description: "60 秒限时四则运算，连击越高题目越难、奖励越多。",
        statsKey: "quick_math_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "bestScore"),
    },
    {
        name: "迷宫探险",
        subtitle: "Maze Runner",
        href: "/playground/maze",
        icon: Compass,
        color: "text-lime-600 dark:text-lime-300",
        iconBg: "bg-lime-100 dark:bg-lime-400/10",
        visual: "maze",
        tags: ["Technology", "Science"],
        description: "走出递归迷宫，对比 BFS、DFS 与 A* 寻路路径。",
        statsKey: "maze_runner_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "七巧板",
        subtitle: "Tangram",
        href: "/playground/tangram",
        icon: Palette,
        color: "text-violet-600 dark:text-violet-300",
        iconBg: "bg-violet-100 dark:bg-violet-400/10",
        visual: "tangram",
        tags: ["Arts", "Math"],
        description: "拖拽七块标准件拼出剪影，练习旋转、镜像和组合。",
        statsKey: "tangram_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).solvedLevels) ? ((raw as Record<string, unknown>).solvedLevels as unknown[]).length : 0,
    },
]

const TAG_LABELS: Record<SteamTag, string> = {
    Science: "科学",
    Technology: "技术",
    Engineering: "工程",
    Arts: "艺术",
    Math: "数学",
}

const STEAM_TAG_TONE: Record<SteamTag, CategoryTone> = {
    Science: "science",
    Technology: "tech",
    Engineering: "engineering",
    Arts: "art",
    Math: "math",
}

const STEAM_DIMS: { key: SteamTag; label: string; name: string; icon: LucideIcon; color: string; bg: string }[] = [
    { key: "Science", label: "科学", name: "Science", icon: Beaker, color: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-400/10" },
    { key: "Technology", label: "技术", name: "Technology", icon: Code2, color: "text-primary", bg: "bg-blue-100 dark:bg-blue-400/10" },
    { key: "Engineering", label: "工程", name: "Engineering", icon: Cog, color: "text-orange-600 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-400/10" },
    { key: "Arts", label: "艺术", name: "Arts", icon: Palette, color: "text-violet-600 dark:text-violet-300", bg: "bg-violet-100 dark:bg-violet-400/10" },
    { key: "Math", label: "数学", name: "Math", icon: Sigma, color: "text-cyan-600 dark:text-cyan-300", bg: "bg-cyan-100 dark:bg-cyan-400/10" },
]

const BADGE_COUNT = PLAYGROUND_BADGE_COUNT
const BADGE_PREVIEW_IDS = [
    "playground_explorer_bronze",
    "playground_victories_bronze",
    "minesweeper_speedster",
    "game2048_8192",
    "game24_speed",
    "hanoi_perfect",
    "circuit_logic",
    "tangram_all",
] as const
const BADGE_PREVIEW_BADGES = BADGE_PREVIEW_IDS.flatMap((id) => {
    const badge = BADGES.find((item) => item.id === id)
    return badge ? [badge] : []
})

const IMAGE_ARTWORKS: Partial<Record<GameVisual, { light: string; dark: string }>> = {
    mines: {
        light: "/assets/playground-art/minesweeper-transparent-light.png",
        dark: "/assets/playground-art/minesweeper-transparent-dark.png",
    },
    gomoku: {
        light: "/assets/playground-art/gomoku-transparent-light.png",
        dark: "/assets/playground-art/gomoku-transparent-dark.png",
    },
    hanoi: {
        light: "/assets/playground-art/hanoi-transparent-light.png",
        dark: "/assets/playground-art/hanoi-transparent-dark.png",
    },
    sorting: {
        light: "/assets/playground-art/sorting-transparent-light.png",
        dark: "/assets/playground-art/sorting-transparent-dark.png",
    },
    sudoku: {
        light: "/assets/playground-art/sudoku-transparent-light.png",
        dark: "/assets/playground-art/sudoku-transparent-dark.png",
    },
    nqueens: {
        light: "/assets/playground-art/nqueens-transparent-light.png",
        dark: "/assets/playground-art/nqueens-transparent-dark.png",
    },
    circuit: {
        light: "/assets/playground-art/circuit-transparent-light.png",
        dark: "/assets/playground-art/circuit-transparent-dark.png",
    },
}

function safeNum(raw: unknown, key: string): number {
    if (raw && typeof raw === "object" && key in raw) {
        const value = (raw as Record<string, unknown>)[key]
        return typeof value === "number" ? value : 0
    }
    return 0
}

function readBestTimes(raw: unknown): unknown {
    if (!raw || typeof raw !== "object") return raw
    const value = (raw as Record<string, unknown>).bestTimes
    if (value && typeof value === "object") return value
    if ("totalGames" in raw || "wins" in raw || "winsByDifficulty" in raw) return {}
    return raw
}

function countBestTimeRecords(raw: unknown): number {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0
    return Object.values(raw).filter((value) => typeof value === "number" && Number.isFinite(value) && value >= 0).length
}

function readStats(key: string): unknown {
    return getPlaygroundItem(key)
}

type AggStats = {
    totalPlayed: number
    totalWins: number
    gamesExplored: number
    perGame: Map<string, { played: number; wins: number }>
    steamPlayed: Record<SteamTag, number>
}

const EMPTY_STATS: AggStats = {
    totalPlayed: 0,
    totalWins: 0,
    gamesExplored: 0,
    perGame: new Map(),
    steamPlayed: {
        Science: 0,
        Technology: 0,
        Engineering: 0,
        Arts: 0,
        Math: 0,
    },
}

function readGameStats(game: GameCard): unknown {
    if (game.statsKey === "minesweeper_stats") {
        return readMergedMinesweeperStats()
    }
    return readStats(game.statsKey)
}

function aggregateStats(): AggStats {
    let totalPlayed = 0
    let totalWins = 0
    let gamesExplored = 0
    const perGame = new Map<string, { played: number; wins: number }>()
    const steamPlayed: Record<SteamTag, number> = {
        Science: 0,
        Technology: 0,
        Engineering: 0,
        Arts: 0,
        Math: 0,
    }

    for (const game of GAMES) {
        const raw = readGameStats(game)
        const played = game.getPlayed(raw)
        const wins = game.getWins(raw)
        totalPlayed += played
        totalWins += wins
        if (played > 0) gamesExplored += 1
        perGame.set(game.href, { played, wins })
        if (played > 0) {
            for (const tag of game.tags) {
                steamPlayed[tag] += played
            }
        }
    }

    return { totalPlayed, totalWins, gamesExplored, perGame, steamPlayed }
}

function getStatus(gameIndex: number, played: number): { label: string; className: string } {
    if (played > 0) {
        return {
            label: `已玩 ${played}`,
            className: "bg-foreground text-background",
        }
    }

    if ([2, 6].includes(gameIndex)) {
        return {
            label: "新挑战",
            className: "bg-orange-500 text-white dark:bg-orange-400 dark:text-orange-950",
        }
    }

    if ([4, 8].includes(gameIndex)) {
        return {
            label: "推荐",
            className: "bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950",
        }
    }

    return {
        label: "开始",
        className: "bg-muted text-muted-foreground",
    }
}

export default function PlaygroundPage() {
    const [stats, setStats] = useState<AggStats | null>(null)

    useEffect(() => {
        const refreshStats = () => {
            setStats(aggregateStats())
        }

        refreshStats()
        window.addEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)

        return () => {
            window.removeEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)
        }
    }, [])

    const displayStats = stats ?? EMPTY_STATS
    const steamMax = Math.max(1, ...Object.values(displayStats.steamPlayed))
    const missingDims = STEAM_DIMS.filter((dim) => displayStats.steamPlayed[dim.key] === 0)
    const unexploredGames = GAMES.filter((game) => (displayStats.perGame.get(game.href)?.played ?? 0) === 0)
    const recommendedGames = (
        missingDims.length > 0
            ? unexploredGames.filter((game) => game.tags.some((tag) => missingDims.some((dim) => dim.key === tag)))
            : unexploredGames
    )
    const toRecommend = (recommendedGames.length > 0 ? recommendedGames : GAMES).slice(0, 3)
    const hasPlayHistory = displayStats.totalPlayed > 0

    return (
        <div className="mx-auto w-full py-4 sm:py-5 lg:px-8 lg:py-8">
            <div className="grid gap-5 xl:gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="flex min-w-0 flex-col gap-5">
                    <HeroPanel className="order-1" />

                    <div className="order-2 xl:hidden">
                        <RecommendationPanel games={toRecommend} />
                    </div>

                    <div className="order-3 grid gap-3 md:grid-cols-2 xl:order-5 2xl:grid-cols-3">
                        {GAMES.map((game, index) => {
                            const gameStats = displayStats.perGame.get(game.href)
                            const played = gameStats?.played ?? 0
                            return <GameTile key={game.href} game={game} index={index} played={played} />
                        })}
                    </div>

                    <div className="order-4 space-y-5 xl:order-2">
                        <StatsGrid stats={displayStats} />
                        <SteamRadarPanel
                            stats={displayStats}
                            steamMax={steamMax}
                            collapsibleOnMobile
                            defaultCollapsed={!hasPlayHistory}
                        />
                    </div>

                    <div className="order-5 xl:hidden">
                        <BadgePanel />
                    </div>
                </section>

                <aside className="hidden space-y-5 xl:sticky xl:top-20 xl:block xl:self-start">
                    <RecommendationPanel games={toRecommend} />
                    <BadgePanel />
                </aside>
            </div>
        </div>
    )
}

function StatsGrid({ stats }: { stats: AggStats }) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
                icon={Gamepad2}
                iconClassName="bg-primary/10 text-primary"
                label="总游玩局数"
                value={stats.totalPlayed}
            />
            <StatCard
                icon={Trophy}
                iconClassName="bg-[hsl(var(--tone-science-soft))] text-[hsl(var(--tone-science))]"
                label="总胜利数"
                value={stats.totalWins}
            />
            <StatCard
                icon={Award}
                iconClassName="bg-[hsl(var(--tone-engineering-soft))] text-[hsl(var(--tone-engineering))]"
                label="已体验游戏"
                value={`${stats.gamesExplored} / ${GAMES.length}`}
            />
            <StatCard
                icon={Star}
                iconClassName="bg-[hsl(var(--tone-tech-soft))] text-[hsl(var(--tone-tech))]"
                label="STEAM 维度覆盖"
                value={`${Object.values(stats.steamPlayed).filter((value) => value > 0).length} / 5`}
            />
        </div>
    )
}

function HeroPanel({ className }: { className?: string }) {
    return (
        <section className={cn("surface-panel relative overflow-hidden p-4 sm:p-6 lg:min-h-[236px] lg:p-8", className)}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_26%,hsl(var(--brand-blue)/0.12),transparent_34%),radial-gradient(circle_at_92%_72%,hsl(var(--brand-green)/0.1),transparent_28%)]" />
            <div className="relative grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1fr)] lg:items-center lg:gap-7">
                <div>
                    <ToneBadge tone="tech" className="gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold normal-case tracking-normal">
                        <Code2 className="h-3.5 w-3.5" />
                        Hello, World! 欢迎进入数智空间
                    </ToneBadge>
                    <h1 className="mt-4 max-w-xl text-3xl font-black leading-tight tracking-tight text-foreground sm:mt-5 sm:text-5xl lg:text-6xl">
                        STEAM <span className="text-primary">Playground</span>
                    </h1>
                    <p className="mt-3 max-w-xl text-sm font-medium leading-7 text-muted-foreground sm:mt-4 sm:text-base sm:leading-8">
                        在游戏中理解算法、数学与工程思维。每一次挑战，都把抽象概念变成可操作的训练。
                    </p>
                    <div className="mt-4 hidden flex-wrap gap-2 sm:flex sm:mt-7">
                        {["算法推演", "逻辑训练", "工程建模"].map((label) => (
                            <span
                                key={label}
                                className="surface-subtle rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
                <div className="hidden md:block">
                    <PlaygroundHeroVisual />
                </div>
            </div>
        </section>
    )
}

function PlaygroundHeroVisual() {
    return (
        <div className="surface-subtle relative min-h-[220px] overflow-hidden sm:min-h-[280px] lg:min-h-[320px]">
            <div className="pointer-events-none absolute inset-0 opacity-[0.32] [background-image:linear-gradient(hsl(var(--brand-blue)/0.2)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--brand-blue)/0.2)_1px,transparent_1px)] [background-size:42px_42px] dark:opacity-[0.18]" />
            <div className="pointer-events-none absolute inset-x-6 bottom-2 h-24 rounded-xl bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-blue)/0.22),transparent_68%)] blur-xl dark:bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-green)/0.2),transparent_68%)]" />
            <Image
                src="/assets/playground-art/playground-hero-foreground.png"
                alt=""
                width={1200}
                height={610}
                className="absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain drop-shadow-[0_24px_34px_hsl(var(--surface-shadow)/0.22)] dark:brightness-90 dark:saturate-95 [.black-gold_&]:[filter:sepia(1)_saturate(1.35)_hue-rotate(350deg)_brightness(0.94)]"
                sizes="(min-width: 1024px) 48vw, 92vw"
                priority
                aria-hidden="true"
            />
        </div>
    )
}

function StatCard({
    icon: Icon,
    iconClassName,
    value,
    label,
}: {
    icon: LucideIcon
    iconClassName: string
    value: number | string
    label: string
}) {
    return (
        <div className="surface-card flex min-h-[86px] items-center gap-4 px-4 py-3.5">
            <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-md", iconClassName)}>
                <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
                <div className="text-2xl font-black leading-none tracking-tight text-foreground">{value}</div>
                <div className="mt-1.5 truncate text-xs font-semibold text-muted-foreground">{label}</div>
            </div>
        </div>
    )
}

function SteamRadarPanel({
    stats,
    steamMax,
    collapsibleOnMobile = false,
    defaultCollapsed = false,
}: {
    stats: AggStats
    steamMax: number
    collapsibleOnMobile?: boolean
    defaultCollapsed?: boolean
}) {
    const center = 84
    const radius = 62
    const rings = [0.25, 0.5, 0.75, 1]
    const dimCount = STEAM_DIMS.length
    const points = STEAM_DIMS.map((dim, index) => {
        const angle = (Math.PI * 2 * index) / dimCount - Math.PI / 2
        const value = stats.steamPlayed[dim.key]
        const ratio = Math.min(1, value / steamMax)
        const x = center + Math.cos(angle) * radius * ratio
        const y = center + Math.sin(angle) * radius * ratio
        return {
            dim,
            x,
            y,
            value,
            ratio,
            axisX: center + Math.cos(angle) * radius,
            axisY: center + Math.sin(angle) * radius,
        }
    })
    const polygonPoints = points.map((point) => `${point.x},${point.y}`).join(" ")

    const panelHeader = (
        <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-base font-black tracking-tight">STEAM 能力维度进度</h2>
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:inline-flex">
                每局游戏都会点亮维度
            </span>
        </div>
    )

    const panelBody = (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-center">
                <div className="mx-auto w-full max-w-[220px]">
                    <svg viewBox="0 0 168 168" className="h-auto w-full" aria-label="STEAM 能力雷达图">
                        {rings.map((ring) => {
                            const ringPoints = STEAM_DIMS.map((_, index) => {
                                const angle = (Math.PI * 2 * index) / dimCount - Math.PI / 2
                                const x = center + Math.cos(angle) * radius * ring
                                const y = center + Math.sin(angle) * radius * ring
                                return `${x},${y}`
                            }).join(" ")
                            return (
                                <polygon
                                    key={ring}
                                    points={ringPoints}
                                    fill="none"
                                    stroke="hsl(var(--surface-border)/0.7)"
                                    strokeWidth="1"
                                />
                            )
                        })}
                        {points.map((point) => (
                            <line
                                key={`axis-${point.dim.key}`}
                                x1={center}
                                y1={center}
                                x2={point.axisX}
                                y2={point.axisY}
                                stroke="hsl(var(--surface-border)/0.8)"
                                strokeWidth="1"
                            />
                        ))}
                        <polygon
                            points={polygonPoints}
                            fill="hsl(var(--brand-blue)/0.28)"
                            stroke="hsl(var(--brand-blue))"
                            strokeWidth="2"
                        />
                        {points.map((point) => (
                            <circle
                                key={`point-${point.dim.key}`}
                                cx={point.x}
                                cy={point.y}
                                r="3.8"
                                className={cn("fill-current", point.dim.color)}
                            />
                        ))}
                    </svg>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
                    {STEAM_DIMS.map((dim) => {
                        const count = stats.steamPlayed[dim.key]
                        const gamesInDim = GAMES.filter((game) => game.tags.includes(dim.key)).length
                        const playedInDim = GAMES.filter((game) => game.tags.includes(dim.key) && (stats.perGame.get(game.href)?.played ?? 0) > 0).length
                        const pct = count > 0 ? Math.round((count / steamMax) * 100) : 0
                        const Icon = dim.icon
                        return (
                            <div key={dim.key} className="surface-subtle flex items-center justify-between gap-3 px-3 py-2.5">
                                <div className="flex min-w-0 items-center gap-2.5">
                                    <span className={cn("grid h-8 w-8 place-items-center rounded-sm", dim.bg, dim.color)}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black">{dim.label}</p>
                                        <p className="text-[11px] text-muted-foreground">{playedInDim}/{gamesInDim} 款已体验</p>
                                    </div>
                                </div>
                                <span className="text-xs font-black tabular-nums text-muted-foreground">{pct}%</span>
                            </div>
                        )
                    })}
                </div>
            </div>
    )

    if (collapsibleOnMobile) {
        return (
            <>
                <details
                    className="surface-panel group px-4 py-4 sm:px-5 xl:hidden"
                    open={defaultCollapsed ? undefined : true}
                >
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex items-center justify-between gap-3">
                            {panelHeader}
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
                        </div>
                    </summary>
                    <div className="mt-4">{panelBody}</div>
                </details>
                <section className="surface-panel hidden px-4 py-4 sm:px-5 xl:block">
                    <div className="mb-4">{panelHeader}</div>
                    {panelBody}
                </section>
            </>
        )
    }

    return (
        <section className="surface-panel px-4 py-4 sm:px-5">
            <div className="mb-4">{panelHeader}</div>
            {panelBody}
        </section>
    )
}

function GameTile({ game, index, played }: { game: GameCard; index: number; played: number }) {
    const status = getStatus(index, played)
    const Icon = game.icon

    return (
        <Link
            href={game.href}
            className="surface-card surface-card-interactive group relative flex min-h-[140px] gap-3 overflow-hidden p-3.5 sm:min-h-[156px]"
        >
            <GameArtwork game={game} />
            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-2">
                    <h3 className="truncate text-base font-black tracking-tight text-foreground sm:text-lg">{game.name}</h3>
                    {game.subtitle ? <span className="hidden truncate text-xs font-semibold text-muted-foreground sm:inline">{game.subtitle}</span> : null}
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{game.description}</p>
                <div className="mt-auto flex items-end justify-between gap-2 pt-3 sm:gap-3">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                        {game.tags.map((tag) => (
                            <ToneBadge key={tag} tone={STEAM_TAG_TONE[tag]} className="rounded-full px-2 py-0.5 text-[11px]">
                                {TAG_LABELS[tag]}
                            </ToneBadge>
                        ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                        <Badge className={cn("border-transparent px-2.5 py-1 text-xs font-bold", status.className)}>{status.label}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                </div>
            </div>
            <Icon className={cn("pointer-events-none absolute -bottom-6 -right-5 h-20 w-20 opacity-[0.05]", game.color)} />
        </Link>
    )
}

function GameArtwork({ game }: { game: GameCard }) {
    const imageArtwork = IMAGE_ARTWORKS[game.visual]

    return (
        <div className="surface-subtle relative h-[80px] w-[80px] shrink-0 overflow-hidden sm:h-[92px] sm:w-[92px]">
            {imageArtwork ? (
                <>
                    <Image
                        src={imageArtwork.light}
                        alt=""
                        width={92}
                        height={92}
                        className="h-full w-full object-contain dark:hidden"
                        aria-hidden="true"
                    />
                    <Image
                        src={imageArtwork.dark}
                        alt=""
                        width={92}
                        height={92}
                        className="hidden h-full w-full object-contain dark:block"
                        aria-hidden="true"
                    />
                </>
            ) : (
                <>
                    {game.visual === "mines" ? <MinesArtwork /> : null}
                    {game.visual === "gomoku" ? <GomokuArtwork /> : null}
                    {game.visual === "life" ? <LifeArtwork /> : null}
                    {game.visual === "2048" ? <Game2048Artwork /> : null}
                    {game.visual === "24" ? <Game24Artwork /> : null}
                    {game.visual === "hanoi" ? <HanoiArtwork /> : null}
                    {game.visual === "sorting" ? <SortingArtwork /> : null}
                    {game.visual === "sudoku" ? <SudokuArtwork /> : null}
                    {game.visual === "nqueens" ? <NQueensArtwork /> : null}
                    {game.visual === "circuit" ? <CircuitArtwork /> : null}
                </>
            )}
        </div>
    )
}

function MinesArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-sky-50 dark:fill-slate-900" />
            <rect x="8" y="62" width="18" height="18" rx="4" className="fill-white stroke-sky-100 dark:fill-white/8 dark:stroke-white/10" />
            <rect x="27" y="62" width="18" height="18" rx="4" className="fill-white stroke-sky-100 dark:fill-white/8 dark:stroke-white/10" />
            <rect x="46" y="62" width="18" height="18" rx="4" className="fill-white stroke-sky-100 dark:fill-white/8 dark:stroke-white/10" />
            <rect x="65" y="62" width="18" height="18" rx="4" className="fill-white stroke-sky-100 dark:fill-white/8 dark:stroke-white/10" />
            <text x="17" y="75" textAnchor="middle" className="fill-sky-600 text-[10px] font-black dark:fill-sky-300">2</text>
            <text x="36" y="75" textAnchor="middle" className="fill-emerald-600 text-[10px] font-black dark:fill-emerald-300">3</text>
            <text x="55" y="75" textAnchor="middle" className="fill-violet-600 text-[10px] font-black dark:fill-violet-300">1</text>
            <text x="74" y="75" textAnchor="middle" className="fill-sky-600 text-[10px] font-black dark:fill-sky-300">7</text>
            <g className="fill-slate-600 dark:fill-slate-300">
                <path d="M45 17 L49 27 L60 24 L54 34 L63 42 L51 43 L52 56 L44 47 L34 56 L37 43 L25 40 L36 34 L31 23 L42 28 Z" className="fill-slate-500/50 dark:fill-slate-400/35" />
                <circle cx="44" cy="37" r="18" />
                <circle cx="37" cy="30" r="3.5" className="fill-white/70 dark:fill-white/55" />
                <path d="M29 38 C34 50 49 55 59 45" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-foreground/80" />
            </g>
        </svg>
    )
}

function GomokuArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-orange-50 dark:fill-amber-950/50" />
            <rect x="12" y="12" width="68" height="68" rx="10" className="fill-orange-100/55 dark:fill-amber-900/28" />
            {[22, 34, 46, 58, 70].map((pos) => (
                <g key={pos} className="stroke-orange-300 dark:stroke-amber-500/45">
                    <line x1="16" y1={pos} x2="76" y2={pos} strokeWidth="1.2" />
                    <line x1={pos} y1="16" x2={pos} y2="76" strokeWidth="1.2" />
                </g>
            ))}
            {[
                [34, 22],
                [46, 34],
                [58, 46],
                [46, 58],
                [70, 58],
            ].map(([cx, cy]) => (
                <circle key={`black-${cx}-${cy}`} cx={cx} cy={cy} r="5.5" className="fill-slate-950 dark:fill-slate-100" />
            ))}
            {[
                [34, 46],
                [58, 22],
                [70, 34],
                [58, 70],
            ].map(([cx, cy]) => (
                <circle key={`white-${cx}-${cy}`} cx={cx} cy={cy} r="5.5" className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-200" strokeWidth="1.2" />
            ))}
        </svg>
    )
}

function LifeArtwork() {
    const activeCells = new Set([10, 11, 12, 16, 18, 23, 24, 25, 30, 32, 36, 37, 38])

    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-emerald-950 dark:fill-emerald-950" />
            <rect x="10" y="10" width="72" height="72" rx="13" className="fill-emerald-900/70 dark:fill-emerald-900/80" />
            {Array.from({ length: 49 }).map((_, index) => {
                const col = index % 7
                const row = Math.floor(index / 7)
                const alive = activeCells.has(index)
                return (
                    <circle
                        key={index}
                        cx={18 + col * 9.5}
                        cy={18 + row * 9.5}
                        r={alive ? 3.4 : 3.1}
                        className={alive ? "fill-emerald-200 dark:fill-emerald-100" : "fill-emerald-500/35 dark:fill-emerald-500/30"}
                    />
                )
            })}
        </svg>
    )
}

function Game2048Artwork() {
    return (
        <div className="grid h-full grid-cols-2 gap-1.5 bg-muted/70 p-2">
            {[
                ["2", "bg-blue-400"],
                ["0", "bg-rose-400"],
                ["4", "bg-amber-400"],
                ["8", "bg-emerald-400"],
            ].map(([value, color]) => (
                <span key={value} className={cn("grid place-items-center rounded-sm text-2xl font-black text-white", color)}>
                    {value}
                </span>
            ))}
        </div>
    )
}

function Game24Artwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <defs>
                <linearGradient id="game24-gradient" x1="14" y1="12" x2="78" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#2563eb" />
                </linearGradient>
            </defs>
            <rect width="92" height="92" rx="18" fill="url(#game24-gradient)" />
            <text x="46" y="45" textAnchor="middle" className="fill-white text-[32px] font-black">24</text>
            <text x="46" y="68" textAnchor="middle" className="fill-white text-[17px] font-black">+ - × ÷</text>
            <path d="M20 74 H72" className="stroke-white/45" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}

function HanoiArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-sky-50 dark:fill-slate-900" />
            <rect x="42" y="14" width="8" height="24" rx="4" className="fill-slate-500 dark:fill-slate-300" />
            <rect x="29" y="40" width="34" height="10" rx="5" className="fill-orange-400 dark:fill-orange-300" />
            <rect x="22" y="56" width="48" height="11" rx="5.5" className="fill-amber-300 dark:fill-amber-200" />
            <rect x="14" y="72" width="64" height="12" rx="6" className="fill-blue-500 dark:fill-blue-400" />
            <rect x="18" y="84" width="56" height="3" rx="1.5" className="fill-blue-200 dark:fill-blue-900" />
        </svg>
    )
}

function SortingArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-slate-50 dark:fill-slate-900" />
            <rect x="13" y="12" width="66" height="68" rx="10" className="fill-white stroke-slate-200 dark:fill-white/7 dark:stroke-white/10" />
            <rect x="23" y="48" width="6" height="25" rx="2" className="fill-emerald-400 dark:fill-emerald-300" />
            <rect x="35" y="26" width="6" height="47" rx="2" className="fill-blue-500 dark:fill-blue-300" />
            <rect x="47" y="41" width="6" height="32" rx="2" className="fill-violet-400 dark:fill-violet-300" />
            <rect x="59" y="20" width="6" height="53" rx="2" className="fill-cyan-500 dark:fill-cyan-300" />
        </svg>
    )
}

function SudokuArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-white dark:fill-slate-900" />
            <rect x="11" y="11" width="70" height="70" rx="8" className="fill-blue-50 stroke-blue-100 dark:fill-white/7 dark:stroke-white/10" />
            {[34, 58].map((pos) => (
                <g key={pos} className="stroke-blue-200 dark:stroke-white/18" strokeWidth="1.4">
                    <line x1={pos} y1="11" x2={pos} y2="81" />
                    <line x1="11" y1={pos} x2="81" y2={pos} />
                </g>
            ))}
            {[
                [22, 27, "1"],
                [46, 27, "2"],
                [70, 27, "3"],
                [22, 51, "6"],
                [46, 51, "4"],
                [22, 75, "7"],
                [46, 75, "8"],
                [70, 75, "9"],
            ].map(([x, y, value]) => (
                <text key={`${x}-${y}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 text-[15px] font-black dark:fill-slate-100">
                    {value}
                </text>
            ))}
        </svg>
    )
}

function NQueensArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-yellow-50 dark:fill-amber-950/45" />
            <path d="M21 55 L17 27 L34 43 L46 19 L58 43 L75 27 L71 55 Z" className="fill-amber-300 stroke-amber-600 dark:fill-amber-300/90 dark:stroke-amber-200" strokeWidth="4" strokeLinejoin="round" />
            <rect x="27" y="62" width="38" height="6" rx="3" className="fill-amber-600 dark:fill-amber-200" />
            <rect x="31" y="73" width="30" height="5" rx="2.5" className="fill-amber-500 dark:fill-amber-300" />
        </svg>
    )
}

function CircuitArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-teal-950 dark:fill-teal-950" />
            <path d="M14 22 H34 V43 H58 V22 H78 M14 72 H32 V55 H60 V72 H78 M46 43 V55" fill="none" className="stroke-teal-200 dark:stroke-teal-100" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            {[14, 78, 32, 60, 46, 34, 58].map((cx, index) => (
                <circle key={index} cx={cx} cy={[22, 22, 55, 55, 49, 43, 43][index]} r="5" className="fill-teal-200 dark:fill-teal-100" />
            ))}
            <circle cx="24" cy="72" r="2.5" className="fill-white/55" />
            <circle cx="70" cy="22" r="2.5" className="fill-white/55" />
        </svg>
    )
}

function RecommendationPanel({ games }: { games: GameCard[] }) {
    return (
        <section className="surface-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-[hsl(var(--tone-engineering))]" />
                    <h2 className="font-sans font-black">推荐探索</h2>
                </div>
                <Button type="button" variant="ghost" size="sm" className="min-h-11 gap-1 text-primary">
                    换一换
                    <RotateCw className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="space-y-2.5">
                {games.map((game) => {
                    const Icon = game.icon
                    return (
                        <Link
                            key={game.href}
                            href={game.href}
                            className="surface-card surface-card-interactive group flex min-h-11 items-center gap-3 p-3"
                        >
                            <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-sm", game.iconBg, game.color)}>
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black">{game.name}</span>
                                <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{game.description}</span>
                            </span>
                            <span className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary px-4 text-sm font-semibold text-primary-foreground">
                                开始
                            </span>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}

function BadgePanel() {
    return (
        <section className="surface-panel p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                    <h2 className="font-sans font-black">游乐场共 {BADGE_COUNT} 枚可解锁徽章</h2>
                    <p className="mt-1 text-xs text-muted-foreground">通关、破纪录、连续挑战都会点亮徽章。</p>
                </div>
                <Link href="/profile#profile-badges-anchor" className="shrink-0 text-xs font-bold text-primary hover:text-primary/80">
                    查看全部
                </Link>
            </div>
            <div className="grid grid-cols-4 gap-3">
                {BADGE_PREVIEW_BADGES.map((badge) => (
                    <div key={badge.id} className="text-center">
                        <div className="group mx-auto w-fit">
                            <BadgeIcon icon={badge.icon} tier={badge.tier} seriesKey={badge.seriesKey} size="sm" showGlow />
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-tight text-muted-foreground">{badge.name}</p>
                    </div>
                ))}
            </div>
            <div className="mt-4 rounded-sm bg-muted/35 px-3 py-2 text-xs font-medium leading-relaxed text-muted-foreground">
                覆盖跨游戏探索、累计胜利和高难度彩蛋三类目标。
            </div>
        </section>
    )
}
