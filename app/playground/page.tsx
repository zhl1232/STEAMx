"use client"

import { useEffect, useId, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    ArrowRight,
    ChevronDown,
    Bomb,
    Bot,
    Brain,
    Calculator,
    Compass,
    Crosshair,
    Crown,
    Dna,
    Hash,
    Layers,
    Scale,
    TableCellsSplit,
    type LucideIcon,
} from "lucide-react"

import { PLAYGROUND_DISCOVERY } from "@/lib/playground/catalog"
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
        description: "翻开名词和解释，找出对应的一对。",
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
        description: "走出迷宫，看看算法怎样找路。",
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

const IMAGE_ARTWORKS: Partial<Record<GameVisual, string>> = {
    balance: "/assets/playground-art/balance-v2.webp",
    nonogram: "/assets/playground-art/nonogram-v2.webp",
    memory: "/assets/playground-art/memory-v2.webp",
    functionwars: "/assets/playground-art/functionwars-v2.webp",
    maze: "/assets/playground-art/maze-v2.webp",
    life: "/assets/playground-art/life-v2.webp",
    "24": "/assets/playground-art/24-v2.webp",
    mines: "/assets/playground-art/mines-v2.webp",
    gomoku: "/assets/playground-art/gomoku-v2.webp",
    hanoi: "/assets/playground-art/hanoi-v2.webp",
    sudoku: "/assets/playground-art/sudoku-v2.webp",
    nqueens: "/assets/playground-art/nqueens-v2.webp",
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

const SCIENCE_ENTRIES = [
    { name: "物理实验室", hint: "电路、光、声、热、磁、力，动手调参数", href: "/playground/physics-lab", image: "/assets/playground-art/physics-lab-v2.webp" },
    { name: "3D 物理课本", hint: "按章节互动学，观察物理现象", href: "/textbook", image: "/assets/playground-art/textbook-v2.webp" },
]

export default function PlaygroundPage() {
    const [stats, setStats] = useState<AggStats | null>(null)
    useEffect(() => {
        const refreshStats = () => setStats(aggregateStats())
        refreshStats()
        window.addEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)
        return () => window.removeEventListener(PLAYGROUND_CHANGE_EVENT, refreshStats)
    }, [])

    const displayStats = stats ?? EMPTY_STATS
    const featuredGames = DIRECTORY_GAMES.filter(({ discovery }) => discovery.featured)
    const otherGames = DIRECTORY_GAMES.filter(({ discovery }) => !discovery.featured)
    const renderGames = (entries: typeof DIRECTORY_GAMES) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:gap-4">
            {entries.map(({ game }) => (
                <GameTile key={game.href} game={game} played={displayStats.perGame.get(game.href)?.played ?? 0} />
            ))}
        </div>
    )

    return (
        <div className="w-full space-y-5 px-4 py-4 md:px-0 lg:space-y-6 lg:py-6">
            <h1 className="sr-only hidden lg:block">游乐场</h1>
            <ScienceEntries />
            <section aria-label="全部玩法" className="space-y-5 lg:space-y-7">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
                    {featuredGames.map(({ game }) => <FeaturedGame key={game.href} game={game} played={displayStats.perGame.get(game.href)?.played ?? 0} />)}
                </div>
                {renderGames(otherGames)}
            </section>
            <details className="group/records border-t border-border">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold">我的探索记录</span>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{displayStats.gamesExplored ? `已体验 ${displayStats.gamesExplored} 款 · ${displayStats.totalPlayed} 次记录` : "还没有游玩记录"}</span>
                        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open/records:rotate-180" />
                    </span>
                </summary>
                <ExplorationRecords stats={displayStats} />
            </details>
        </div>
    )
}

function ScienceEntries() {
    return (
        <nav aria-label="游乐场科学入口" className="grid grid-cols-2 gap-3 lg:gap-5">
            {SCIENCE_ENTRIES.map(({ name, hint, href, image }) => (
                <Link key={href} href={href} className="group relative flex min-h-44 flex-col overflow-hidden rounded-lg border border-border bg-background/70 p-4 hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:min-h-64 lg:justify-center lg:p-7">
                    <span className="relative z-10 lg:w-[52%]">
                        <span className="block font-sans text-base font-bold text-foreground group-hover:text-primary lg:text-3xl">{name}</span>
                        <span className="mt-3 hidden text-sm leading-6 text-foreground/75 lg:block">{hint}</span>
                        <ArrowRight className="mt-5 hidden h-5 w-5 text-primary lg:block" aria-hidden />
                    </span>
                    <Image src={image} alt="" width={640} height={640} sizes="(min-width: 1024px) 320px, 150px" className="pointer-events-none mt-2 h-28 w-full object-contain lg:absolute lg:right-2 lg:top-1/2 lg:mt-0 lg:h-60 lg:w-[46%] lg:-translate-y-1/2" />
                </Link>
            ))}
        </nav>
    )
}

function ExplorationRecords({ stats }: { stats: AggStats }) {
    return (
        <div className="pb-4">
            <dl className="grid grid-cols-3 divide-x divide-border py-3">
                {[
                    { label: "累计游玩记录", value: stats.totalPlayed },
                    { label: "胜利 / 解题记录", value: stats.totalWins },
                    { label: "已体验游戏", value: `${stats.gamesExplored} / ${GAMES.length}` },
                ].map(({ label, value }) => (
                    <div key={label} className="px-3 first:pl-0 sm:px-6">
                        <dd className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
                        <dt className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</dt>
                    </div>
                ))}
            </dl>
            <div className="mt-3 flex items-start justify-between gap-4">
                <details className="min-w-0 flex-1 text-sm text-muted-foreground">
                    <summary className="flex min-h-11 w-fit cursor-pointer items-center">记录说明</summary>
                    <p className="max-w-prose pb-2 leading-6">按已有游玩、胜利和解题记录汇总，旧版最佳成绩按条目计数，可能不覆盖每一局；不代表能力测评或学习效果。</p>
                </details>
                <Link href="/profile#profile-badges-anchor" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-primary">查看我的徽章<ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </div>
        </div>
    )
}

function FeaturedGame({ game, played }: { game: GameCard; played: number }) {
    const tone = game.visual === "functionwars" ? "bg-emerald-950 text-emerald-50" : game.visual === "balance" ? "bg-teal-100 text-teal-950 dark:bg-teal-900 dark:text-teal-50" : "bg-lime-100 text-lime-950 dark:bg-lime-950 dark:text-lime-50"
    return (
        <article className={cn("overflow-hidden rounded-lg", tone)}>
            <Link href={game.href} prefetch={false} className="group relative flex h-full min-h-40 flex-col justify-between gap-4 p-5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-current lg:min-h-44 lg:p-6">
                <div className="relative z-10 max-w-[65%] sm:max-w-full lg:max-w-[64%]">
                    <h2 className="font-sans text-xl font-bold tracking-tight lg:text-2xl">{game.name}</h2>
                    <p className="mt-2 text-sm leading-6 opacity-80">{game.description}</p>
                </div>
                <div aria-hidden className="pointer-events-none absolute right-4 top-6 [&>div]:!h-20 [&>div]:!w-20 [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none sm:static sm:self-end lg:absolute lg:right-4 lg:top-7 lg:[&>div]:!h-28 lg:[&>div]:!w-28">
                    <GameArtwork game={game} />
                </div>
                <span className="relative z-10 inline-flex w-fit items-center gap-2 text-sm font-semibold">
                    {played > 0 ? `已玩 ${played} · 继续探索` : "开始探索"}<ArrowRight className="h-4 w-4" aria-hidden />
                </span>
            </Link>
        </article>
    )
}

function GameTile({ game, played }: { game: GameCard; played: number }) {
    return (
        <article className="rounded-lg border border-border bg-background/80 transition-colors hover:bg-background">
            <Link href={game.href} prefetch={false} className="group flex h-full items-center gap-4 rounded-lg p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:p-5">
                <span className="shrink-0 [&>div]:!h-16 [&>div]:!w-16 [&>div]:border-0 [&>div]:shadow-none"><GameArtwork game={game} /></span>
                <div className="min-w-0 flex-1">
                    <h3 className="font-sans text-base font-semibold leading-6 group-hover:text-primary lg:text-lg">{game.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-foreground/75">{game.description}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary">{played > 0 ? `已玩 ${played} · 继续探索` : "开始探索"}<ArrowRight aria-hidden className="h-4 w-4" /></p>
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
                "relative shrink-0 overflow-hidden",
                wide ? "flex h-32 w-full items-center justify-center rounded-b-none [&>*]:!h-28 [&>*]:!w-28 [&>svg]:!h-28" : compact ? "h-11 w-11 rounded-sm" : "h-[80px] w-[80px] sm:h-[92px] sm:w-[92px]",
            )}
        >
            {imageArtwork ? (
                <Image src={imageArtwork} alt="" width={256} height={256} sizes="128px" className="h-full w-full object-contain" aria-hidden="true" />
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
