"use client"

import { useEffect, useId, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowRight,
    Award,
    Beaker,
    BookOpen,
    Bomb,
    Bot,
    Brain,
    Calculator,
    ChevronRight,
    Code2,
    Cog,
    Compass,
    Crosshair,
    Crown,
    Dna,
    Gamepad2,
    Grid3X3,
    Hash,
    Layers,
    Palette,
    Search,
    Scale,
    Sigma,
    Star,
    TableCellsSplit,
    Trophy,
    type LucideIcon,
} from "lucide-react"

import { BadgeIcon } from "@/components/features/gamification/badge-icon"
import { Button } from "@/components/ui/button"
import { PLAYGROUND_DISCOVERY, PLAYGROUND_GROUPS, type PlaygroundDiscovery } from "@/lib/playground/catalog"
import { BADGES, PLAYGROUND_BADGE_COUNT } from "@/lib/gamification/badges"
import { getPlaygroundItem, PLAYGROUND_CHANGE_EVENT } from "@/lib/playground/storage"
import { readMergedMinesweeperStats } from "@/lib/playground/minesweeper-stats"
import { cn } from "@/lib/utils"

type SteamTag = "Science" | "Technology" | "Engineering" | "Arts" | "Math"
type GameVisual = "mines" | "gomoku" | "life" | "24" | "hanoi" | "sudoku" | "nqueens" | "memory" | "maze" | "nonogram" | "balance" | "functionwars"

type GameCard = {
    name: string
    subtitle: string
    href: string
    icon: LucideIcon
    color: string
    visual: GameVisual
    tags: SteamTag[]
    description: string
    statsKey: string
    getPlayed: (raw: unknown) => number
    getWins: (raw: unknown) => number
}

/** 当前玩法的展示与统计口径；公开目录由 lib/playground/catalog.ts 统一维护。 */
const GAMES: GameCard[] = [
    {
        name: "扫雷",
        subtitle: "Minesweeper",
        href: "/playground/minesweeper",
        icon: Bomb,
        color: "text-primary",
        visual: "mines",
        tags: ["Science", "Math"],
        description: "看数字线索，找出有依据的安全格。",
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
        visual: "gomoku",
        tags: ["Technology"],
        description: "轮流落子，讨论进攻与防守的选择。",
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
        visual: "life",
        tags: ["Science", "Math"],
        description: "摆下细胞，看简单规则如何改变图案。",
        statsKey: "game_of_life_stats",
        getPlayed: (raw) => safeNum(raw, "totalSessions"),
        getWins: (raw) => countStringArray(raw, "challengesSolved"),
    },
    {
        name: "24 点",
        subtitle: "24 Game",
        href: "/playground/24game",
        icon: Calculator,
        color: "text-sky-600 dark:text-sky-300",
        visual: "24",
        tags: ["Math"],
        description: "用四张牌算出 24，找找不同的解法。",
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
        visual: "hanoi",
        tags: ["Math", "Engineering"],
        description: "移动圆盘，试着把大问题拆成小步骤。",
        statsKey: "hanoi_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },

    {
        name: "数独",
        subtitle: "Sudoku",
        href: "/playground/sudoku",
        icon: Hash,
        color: "text-rose-600 dark:text-rose-300",
        visual: "sudoku",
        tags: ["Math", "Technology"],
        description: "根据已有数字，逐步排除不合适的选项。",
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
        visual: "nqueens",
        tags: ["Technology", "Engineering"],
        description: "在 N×N 棋盘上放置 N 个皇后，互不攻击。",
        statsKey: "nqueens_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "manualSolves"),
    },
    {
        name: "记忆翻牌",
        subtitle: "Memory Match",
        href: "/playground/memory",
        icon: Brain,
        color: "text-fuchsia-600 dark:text-fuchsia-300",
        visual: "memory",
        tags: ["Science", "Arts"],
        description: "轮流翻牌，寻找相同图案的位置。",
        statsKey: "memory_match_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "迷宫探险",
        subtitle: "Maze Runner",
        href: "/playground/maze",
        icon: Compass,
        color: "text-lime-600 dark:text-lime-300",
        visual: "maze",
        tags: ["Technology", "Science"],
        description: "走出迷宫，再看看不同算法怎样寻找路线。",
        statsKey: "maze_runner_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => safeNum(raw, "wins"),
    },
    {
        name: "数织",
        subtitle: "Nonogram",
        href: "/playground/nonogram",
        icon: TableCellsSplit,
        color: "text-slate-600 dark:text-slate-300",
        visual: "nonogram",
        tags: ["Math", "Arts"],
        description: "28 关像素谜题，从 3×3 练到 15×15 迷宫与星系。",
        statsKey: "nonogram_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => countStringArray(raw, "solvedLevels"),
    },
    {
        name: "天平称重",
        subtitle: "Balance",
        href: "/playground/balance",
        icon: Scale,
        color: "text-teal-600 dark:text-teal-300",
        visual: "balance",
        tags: ["Science", "Math"],
        description: "先预测，再称量，一步步找出重量不同的硬币。",
        statsKey: "balance_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames"),
        getWins: (raw) => countStringArray(raw, "solvedLevels"),
    },
    {
        name: "函数战争",
        subtitle: "Function Wars",
        href: "/playground/functionwars",
        icon: Crosshair,
        color: "text-emerald-700 dark:text-emerald-300",
        visual: "functionwars",
        tags: ["Math", "Technology"],
        description: "改变函数观察弹道，探索 10 个战役关与 5 个挑战关。",
        statsKey: "function_wars_stats",
        getPlayed: (raw) => safeNum(raw, "totalGames") + safeNum(raw, "onlineGames"),
        getWins: (raw) => countStringArray(raw, "solvedLevels") + safeNum(raw, "onlineWins"),
    },
]

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
    "game24_speed",
    "hanoi_perfect",
    "life_challenge_all",
    "function_wars_all",
    "function_wars_challenge_all",
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

    sudoku: {
        light: "/assets/playground-art/sudoku-transparent-light.png",
        dark: "/assets/playground-art/sudoku-transparent-dark.png",
    },
    nqueens: {
        light: "/assets/playground-art/nqueens-transparent-light.png",
        dark: "/assets/playground-art/nqueens-transparent-dark.png",
    },
    functionwars: {
        light: "/assets/playground-art/functionwars-transparent-light.webp",
        dark: "/assets/playground-art/functionwars-transparent-dark.webp",
    },
}

function safeNum(raw: unknown, key: string): number {
    if (raw && typeof raw === "object" && key in raw) {
        const value = (raw as Record<string, unknown>)[key]
        return typeof value === "number" ? value : 0
    }
    return 0
}

function countStringArray(raw: unknown, key: string): number {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0
    const value = (raw as Record<string, unknown>)[key]
    return Array.isArray(value) ? value.filter((item) => typeof item === "string").length : 0
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

const DIRECTORY_GAMES = PLAYGROUND_DISCOVERY.flatMap((discovery) => {
    const game = GAMES.find((item) => item.href === discovery.href)
    return game ? [{ game, discovery }] : []
})

export default function PlaygroundPage() {
    const [stats, setStats] = useState<AggStats | null>(null)
    const [query, setQuery] = useState("")

    useEffect(() => {
        const refreshStats = () => setStats(aggregateStats())
        refreshStats()
        window.addEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)
        return () => window.removeEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)
    }, [])

    const displayStats = stats ?? EMPTY_STATS
    const search = query.trim().toLocaleLowerCase().replace(/\s+/g, "")
    const matches = DIRECTORY_GAMES.filter(({ game }) =>
        `${game.name} ${game.subtitle} ${game.description}`.toLocaleLowerCase().replace(/\s+/g, "").includes(search),
    )
    const renderGames = (entries: typeof DIRECTORY_GAMES) => (
        <div className="grid grid-cols-2 gap-3 group-open:mt-4 lg:grid-cols-3 lg:gap-4 xl:grid-cols-4 max-lg:[&>*:last-child:nth-child(odd)]:col-span-2">
            {entries.map(({ game, discovery }) => (
                <GameTile key={game.href} game={game} discovery={discovery} played={displayStats.perGame.get(game.href)?.played ?? 0} />
            ))}
        </div>
    )

    return (
        <div className="w-full space-y-6 px-4 py-4 sm:py-5 lg:space-y-8 lg:px-8 lg:py-8">
            <div className="flex flex-col gap-6">
                <div className="order-2 flex items-center justify-between gap-4 lg:order-1">
                    <h1 className="hidden text-page-title lg:block">游乐场</h1>
                    <SearchBox query={query} onChange={setQuery} className="w-full lg:w-72" />
                </div>
                <div className="order-1 lg:order-2">
                    <MobileQuickEntries />
                    <DesktopFeatureEntries />
                </div>
            </div>
            {search ? (
                <section aria-labelledby="playground-search-heading" className="space-y-3">
                    <h2 id="playground-search-heading" className="text-panel-title">搜索结果 · {matches.length} 个玩法</h2>
                    {matches.length ? renderGames(matches) : <p className="py-8 text-sm text-muted-foreground">没找到这个玩法，试试其他名字。</p>}
                    <Button variant="ghost" onClick={() => setQuery("")}>返回分类浏览</Button>
                </section>
            ) : PLAYGROUND_GROUPS.map((group) => {
                const entries = DIRECTORY_GAMES.filter(({ discovery }) => discovery.group === group.id)
                return group.id === "more" ? (
                    <details key={group.id} id={`playground-${group.id}`} className="group scroll-mt-24 border-y border-border py-4">
                        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                            <h2 className="text-panel-title">{group.title} <span className="text-base font-normal text-foreground/70">· {entries.length} 个玩法</span></h2>
                            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                        </summary>
                        {renderGames(entries)}
                    </details>
                ) : (
                    <section key={group.id} id={`playground-${group.id}`} aria-labelledby={`heading-${group.id}`} className="scroll-mt-24 space-y-4">
                        <h2 id={`heading-${group.id}`} className="text-panel-title">{group.title}</h2>
                        {renderGames(entries)}
                    </section>
                )
            })}
            <details className="surface-panel p-4 sm:p-5">
                <summary className="min-h-11 cursor-pointer text-base font-semibold">我的探索记录</summary>
                <ExplorationRecords stats={displayStats} />
                <BadgePanel />
            </details>
        </div>
    )
}

function StatsGrid({ stats }: { stats: AggStats }) {
    return (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
                icon={Gamepad2}
                iconClassName="bg-primary/10 text-primary"
                label="累计游玩记录"
                value={stats.totalPlayed}
            />
            <StatCard
                icon={Trophy}
                iconClassName="bg-[hsl(var(--tone-science-soft))] text-[hsl(var(--tone-science))]"
                label="胜利 / 解题记录"
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
                label="接触过的主题"
                value={`${Object.values(stats.steamPlayed).filter((value) => value > 0).length} / 5`}
            />
        </div>
    )
}

/** 手机端首屏：四个大入口替代长篇介绍，桌面端仍用 HeroPanel。 */
function MobileQuickEntries() {
    const entries = [
        { name: "物理实验室", hint: "电路 · 光 · 声", href: "/playground/physics-lab", icon: Beaker, tone: "bg-primary/10 text-primary" },
        { name: "3D 物理课本", hint: "按章节互动学", href: "/textbook", icon: BookOpen, tone: "bg-[hsl(var(--tone-science-soft))] text-[hsl(var(--tone-science))]" },
        { name: "迷宫探险", hint: "从这里开始", href: "/playground/maze", icon: Compass, tone: "bg-[hsl(var(--tone-tech-soft))] text-[hsl(var(--tone-tech))]" },
        { name: "更多玩法", hint: "逻辑挑战", href: "#playground-more", icon: Grid3X3, tone: "bg-muted text-foreground" },
    ]
    return (
        <nav aria-label="游乐场主要入口" className="grid grid-cols-2 gap-3 lg:hidden">
            {entries.map(({ name, hint, href, icon: Icon, tone }) => (
                <Link key={href} href={href} onClick={href === "#playground-more" ? () => {
                    const more = document.getElementById("playground-more")
                    if (more instanceof HTMLDetailsElement) more.open = true
                } : undefined} className="surface-card flex min-h-[104px] flex-col justify-between gap-2.5 p-4 active:bg-muted/60">
                    <span className={cn("grid h-10 w-10 place-items-center rounded-md", tone)}><Icon className="h-5 w-5" aria-hidden /></span>
                    <span>
                        <span className="block text-base font-black leading-6 text-foreground">{name}</span>
                        <span className="block truncate text-[15px] leading-5 text-foreground/75">{hint}</span>
                    </span>
                </Link>
            ))}
        </nav>
    )
}

function SearchBox({ query, onChange, className }: { query: string; onChange: (value: string) => void; className?: string }) {
    return (
        <div className={cn("relative", className)}>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
            <input aria-label="搜索游乐场玩法" type="search" value={query} onChange={(event) => onChange(event.target.value)}
                placeholder="搜索玩法" className="control-field min-h-12 w-full pl-10 pr-3 text-base" />
        </div>
    )
}

/** 桌面端两大科学入口：横排大卡，替代原首屏长文案与实验室横条。 */
function DesktopFeatureEntries() {
    const entries = [
        { name: "物理实验室", hint: "66 个可调参数的实验：电路、光、声、热、磁、力", href: "/playground/physics-lab", icon: Beaker, tone: "bg-primary/10 text-primary" },
        { name: "3D 物理课本", hint: "按章节互动学，小学到高中都会陆续加入", href: "/textbook", icon: BookOpen, tone: "bg-[hsl(var(--tone-science-soft))] text-[hsl(var(--tone-science))]" },
    ]
    return (
        <nav aria-label="游乐场科学入口" className="hidden gap-4 lg:grid lg:grid-cols-2">
            {entries.map(({ name, hint, href, icon: Icon, tone }) => (
                <Link key={href} href={href} className="surface-card group flex min-h-[112px] items-center gap-5 p-5 transition-colors hover:bg-muted/50">
                    <span className={cn("grid h-16 w-16 shrink-0 place-items-center rounded-md", tone)}><Icon className="h-8 w-8" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-xl font-black text-foreground group-hover:text-primary">{name}</span>
                        <span className="mt-1 block text-base text-foreground/80">{hint}</span>
                    </span>
                    <ArrowRight className="h-6 w-6 shrink-0 text-foreground/70 group-hover:text-primary" aria-hidden />
                </Link>
            ))}
        </nav>
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
                <div className="mt-1.5 truncate text-sm font-semibold text-foreground/75">{label}</div>
            </div>
        </div>
    )
}

function ExplorationRecords({ stats }: { stats: AggStats }) {
    return (
        <div className="space-y-4 pb-5">
            <p className="text-[15px] leading-6 text-foreground/75">按当前玩法的已有游玩记录汇总。胜利、解题和已完成关卡沿用各玩法口径；旧版仅存最佳成绩时按成绩条目计数，记录不一定覆盖每一局。</p>
            <StatsGrid stats={stats} />
            <div>
                <h2 className="text-sm font-semibold">探索过的 STEAM 主题</h2>
                <p className="mt-1 text-[15px] leading-6 text-foreground/75">这里只记录玩过什么、记录了多少次，不代表能力测评或学习效果。同一玩法可属于多个主题。</p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {STEAM_DIMS.map((dim) => {
                        const playedInDim = GAMES.filter((game) => game.tags.includes(dim.key) && (stats.perGame.get(game.href)?.played ?? 0) > 0).length
                        const Icon = dim.icon
                        return (
                            <li key={dim.key} className="flex items-center gap-3 py-2">
                                <Icon aria-hidden className={cn("h-5 w-5 shrink-0", dim.color)} />
                                <div>
                                    <p className="text-sm font-semibold">{dim.label}</p>
                                    <p className="mt-1 text-sm text-foreground/75">{playedInDim} 款 · {stats.steamPlayed[dim.key]} 次记录</p>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}

function GameTile({ game, played }: { game: GameCard; discovery: PlaygroundDiscovery; played: number }) {
    return (
        <article className="surface-card flex flex-col p-3.5 lg:p-0">
            <Link href={game.href} prefetch={false} className="group flex min-h-[132px] flex-1 flex-col gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-primary lg:min-h-0 lg:gap-0">
                <span className="lg:hidden"><GameArtwork game={game} compact /></span>
                <span className="hidden lg:block"><GameArtwork game={game} wide /></span>
                <div className="min-w-0 flex-1 lg:p-4">
                    <h3 className="text-base font-black leading-6 group-hover:text-primary lg:text-lg">{game.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-[15px] leading-[22px] text-foreground/80 lg:line-clamp-none lg:mt-1 lg:text-sm lg:leading-6">{game.description}</p>
                    <p className="mt-2 hidden items-center gap-2 text-sm font-semibold text-primary lg:flex">{played > 0 ? `已玩 ${played} · 继续探索` : "开始探索"}<ArrowRight aria-hidden className="h-4 w-4" /></p>
                    {played > 0 ? <p className="mt-1 text-sm font-semibold text-primary lg:hidden">已玩 {played} 次</p> : null}
                </div>
            </Link>
        </article>
    )
}

function GameArtwork({ game, compact = false, wide = false }: { game: GameCard; compact?: boolean; wide?: boolean }) {
    const imageArtwork = IMAGE_ARTWORKS[game.visual]

    return (
        <div
            className={cn(
                "surface-subtle relative shrink-0 overflow-hidden",
                wide ? "flex h-32 w-full items-center justify-center rounded-b-none [&>*]:!h-28 [&>*]:!w-28 [&>svg]:!h-28" : compact ? "h-11 w-11 rounded-sm" : "h-[80px] w-[80px] sm:h-[92px] sm:w-[92px]",
            )}
        >
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
                    {game.visual === "24" ? <Game24Artwork /> : null}
                    {game.visual === "hanoi" ? <HanoiArtwork /> : null}

                    {game.visual === "sudoku" ? <SudokuArtwork /> : null}
                    {game.visual === "nqueens" ? <NQueensArtwork /> : null}
                    {game.visual === "memory" ? <MemoryArtwork /> : null}
                    {game.visual === "maze" ? <MazeArtwork /> : null}
                    {game.visual === "nonogram" ? <NonogramArtwork /> : null}
                    {game.visual === "balance" ? <BalanceArtwork /> : null}
                    {game.visual === "functionwars" ? <FunctionWarsArtwork /> : null}
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

function Game24Artwork() {
    const gradientId = `game24-gradient-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <defs>
                <linearGradient id={gradientId} x1="14" y1="12" x2="78" y2="84" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor="#2563eb" />
                </linearGradient>
            </defs>
            <rect width="92" height="92" rx="18" fill={`url(#${gradientId})`} />
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

function MemoryArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-fuchsia-50 dark:fill-fuchsia-950/45" />
            {[
                [18, 18, "fill-blue-400"], [48, 18, "fill-fuchsia-400"],
                [18, 48, "fill-emerald-400"], [48, 48, "fill-amber-400"],
            ].map(([x, y, color], index) => (
                <rect
                    key={`${x}-${y}`}
                    x={x}
                    y={y}
                    width="26"
                    height="26"
                    rx="7"
                    className={cn("stroke-white/70 dark:stroke-white/20", color as string)}
                    strokeWidth="2"
                    opacity={index === 1 || index === 2 ? "0.55" : "1"}
                />
            ))}
            <path d="M25 31 H37 M31 25 V37 M55 31 H67 M25 61 H37 M55 55 L67 67 M67 55 L55 67" className="stroke-white" strokeWidth="3" strokeLinecap="round" />
        </svg>
    )
}

function MazeArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-lime-50 dark:fill-lime-950/45" />
            <path
                d="M18 18 H74 V30 H30 V42 H62 V54 H42 V74 H18 Z"
                className="fill-none stroke-lime-700 dark:stroke-lime-200"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle cx="20" cy="20" r="5" className="fill-emerald-500 dark:fill-emerald-300" />
            <circle cx="42" cy="74" r="5" className="fill-blue-500 dark:fill-blue-300" />
            <path d="M22 20 C36 22 33 38 48 42 C63 46 56 62 43 72" className="fill-none stroke-blue-400/70 dark:stroke-blue-200/70" strokeWidth="3" strokeDasharray="4 5" strokeLinecap="round" />
        </svg>
    )
}


function NonogramArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-slate-50 dark:fill-slate-950/50" />
            <rect x="13" y="13" width="66" height="66" rx="11" className="fill-white stroke-slate-200 dark:fill-white/8 dark:stroke-white/10" />
            {["3", "1", "2", "4"].map((value, index) => (
                <text key={`top-${value}-${index}`} x={31 + index * 12} y="25" textAnchor="middle" className="fill-slate-400 text-[7px] font-black dark:fill-slate-500">
                    {value}
                </text>
            ))}
            {["1", "3", "2", "1"].map((value, index) => (
                <text key={`left-${value}-${index}`} x="20" y={39 + index * 11} textAnchor="middle" className="fill-slate-400 text-[7px] font-black dark:fill-slate-500">
                    {value}
                </text>
            ))}
            <g className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1">
                {[31, 43, 55, 67].map((pos) => (
                    <line key={`v-${pos}`} x1={pos} y1="29" x2={pos} y2="75" />
                ))}
                {[39, 51, 63].map((pos) => (
                    <line key={`h-${pos}`} x1="25" y1={pos} x2="74" y2={pos} />
                ))}
            </g>
            {[
                [31, 29, "fill-slate-800 dark:fill-slate-100"], [43, 29, "fill-slate-800 dark:fill-slate-100"], [55, 29, "fill-slate-800 dark:fill-slate-100"],
                [43, 41, "fill-cyan-500 dark:fill-cyan-300"],
                [31, 53, "fill-slate-800 dark:fill-slate-100"], [43, 53, "fill-slate-800 dark:fill-slate-100"], [55, 53, "fill-slate-800 dark:fill-slate-100"], [67, 53, "fill-slate-800 dark:fill-slate-100"],
                [31, 65, "fill-slate-800 dark:fill-slate-100"], [67, 65, "fill-slate-800 dark:fill-slate-100"],
            ].map(([x, y, fill]) => (
                <rect key={`${x}-${y}`} x={Number(x)} y={Number(y)} width="11" height="11" rx="2" className={fill as string} />
            ))}
        </svg>
    )
}


function BalanceArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-teal-50 dark:fill-teal-950/45" />
            <rect x="34" y="70" width="24" height="6" rx="3" className="fill-teal-800 dark:fill-teal-100" />
            <path d="M46 19 V70" className="stroke-teal-800 dark:stroke-teal-100" strokeWidth="4" strokeLinecap="round" />
            <path d="M24 35 L70 29" className="stroke-teal-800 dark:stroke-teal-100" strokeWidth="4" strokeLinecap="round" />
            <circle cx="46" cy="32" r="4" className="fill-teal-600 dark:fill-teal-200" />
            <path d="M25 35 L17 56 M25 35 L35 53" className="stroke-teal-700/55 dark:stroke-teal-200/50" strokeWidth="2" strokeLinecap="round" />
            <path d="M70 29 L62 48 M70 29 L79 47" className="stroke-teal-700/55 dark:stroke-teal-200/50" strokeWidth="2" strokeLinecap="round" />
            <path d="M13 56 H39 Q36 67 26 67 H25 Q16 67 13 56 Z" className="fill-teal-500 dark:fill-teal-300" />
            <path d="M58 48 H83 Q80 58 71 58 H70 Q61 58 58 48 Z" className="fill-amber-400 dark:fill-amber-300" />
            {[23, 29, 67, 73].map((cx, index) => (
                <circle key={cx} cx={cx} cy={index < 2 ? 51 : 43} r="4" className={index < 2 ? "fill-white/75 dark:fill-teal-950/70" : "fill-white/80 dark:fill-amber-950/65"} />
            ))}
        </svg>
    )
}


function FunctionWarsArtwork() {
    return (
        <svg viewBox="0 0 92 92" className="h-full w-full" aria-hidden="true">
            <rect width="92" height="92" rx="18" className="fill-emerald-50 dark:fill-emerald-950/45" />
            <path d="M10 69 C22 61 28 66 39 62 C51 58 60 66 82 57 V82 H10 Z" className="fill-emerald-500/35 dark:fill-emerald-300/20" />
            <path d="M11 28 H81 M11 44 H81 M11 60 H81 M27 17 V72 M45 17 V72 M63 17 V72" className="stroke-emerald-900/10 dark:stroke-emerald-100/10" strokeWidth="1" />
            <path d="M15 58 C27 21 42 18 51 42 C60 65 68 45 79 29" className="fill-none stroke-cyan-600 dark:stroke-cyan-300" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 3" />
            <circle cx="78" cy="29" r="4.5" className="fill-amber-400 stroke-amber-600 dark:fill-amber-300 dark:stroke-amber-100" strokeWidth="2" />
            <g transform="translate(13 57)">
                <rect x="0" y="5" width="20" height="11" rx="4" className="fill-emerald-700 dark:fill-emerald-300" />
                <circle cx="5" cy="17" r="3" className="fill-emerald-950 dark:fill-emerald-800" />
                <circle cx="15" cy="17" r="3" className="fill-emerald-950 dark:fill-emerald-800" />
                <path d="M8 7 L19 0" className="stroke-emerald-900 dark:stroke-emerald-100" strokeWidth="4" strokeLinecap="round" />
            </g>
            <g transform="translate(67 51)">
                <rect width="12" height="15" rx="3" className="fill-rose-500 dark:fill-rose-300" />
                <circle cx="4" cy="5" r="1.3" className="fill-white" />
                <circle cx="8" cy="5" r="1.3" className="fill-white" />
            </g>
        </svg>
    )
}

function BadgePanel() {
    return (
        <section className="border-t border-border pt-4">
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
