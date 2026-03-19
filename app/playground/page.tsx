"use client"

import { useEffect, useState } from "react"
import { getPlaygroundItem } from "@/lib/playground/storage"
import {
    ArrowRight,
    Terminal,
    Bomb,
    Bot,
    Dna,
    Grid3X3,
    Calculator,
    Layers,
    BarChart3,
    Hash,
    Crown,
    Zap,
    Gamepad2,
    Trophy,
    Sparkles,
    Flame,
    Compass,
    Award,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type GameCard = {
    name: string
    subtitle: string
    href: string
    icon: LucideIcon
    color: string
    bgGradient: string
    tags: SteamTag[]
    description: string
    statsKey: string
    getPlayed: (raw: unknown) => number
    getWins: (raw: unknown) => number
}

type SteamTag = "Science" | "Technology" | "Engineering" | "Arts" | "Math"

const GAMES: GameCard[] = [
    {
        name: "扫雷",
        subtitle: "Minesweeper",
        href: "/playground/minesweeper",
        icon: Bomb,
        color: "text-blue-500",
        bgGradient: "from-blue-500/10 to-blue-600/5",
        tags: ["Science", "Math"],
        description: "概率推演、矩阵运算与逻辑推理。挑战三种难度，解锁高阶定式。",
        statsKey: "minesweeper_best_times",
        getPlayed: (r) => (r && typeof r === "object" ? Object.keys(r).length : 0),
        getWins: (r) => (r && typeof r === "object" ? Object.keys(r).length : 0),
    },
    {
        name: "五子棋",
        subtitle: "Gomoku",
        href: "/playground/gomoku",
        icon: Bot,
        color: "text-purple-500",
        bgGradient: "from-purple-500/10 to-purple-600/5",
        tags: ["Technology"],
        description: "博弈论与极小极大算法。与 AI 对弈，体验搜索树决策过程。",
        statsKey: "gomoku_records",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "wins"),
    },
    {
        name: "生命游戏",
        subtitle: "Game of Life",
        href: "/playground/life",
        icon: Dna,
        color: "text-emerald-500",
        bgGradient: "from-emerald-500/10 to-emerald-600/5",
        tags: ["Science"],
        description: "细胞自动机与涌现理论。两条简单规则如何创造无限复杂。",
        statsKey: "game_of_life_stats",
        getPlayed: (r) => safeNum(r, "totalSessions"),
        getWins: (r) => safeNum(r, "totalSessions"),
    },
    {
        name: "2048",
        subtitle: "",
        href: "/playground/2048",
        icon: Grid3X3,
        color: "text-amber-500",
        bgGradient: "from-amber-500/10 to-amber-600/5",
        tags: ["Math", "Technology"],
        description: "2 的幂次与贪心策略。滑动合并方块，冲击最高分纪录。",
        statsKey: "game_2048_stats",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "wins"),
    },
    {
        name: "24 点",
        subtitle: "24 Game",
        href: "/playground/24game",
        icon: Calculator,
        color: "text-violet-500",
        bgGradient: "from-violet-500/10 to-violet-600/5",
        tags: ["Math"],
        description: "四则运算与组合数学。限时 60 秒，用 4 张牌凑出 24。",
        statsKey: "game_24_stats",
        getPlayed: (r) => safeNum(r, "totalRounds"),
        getWins: (r) => safeNum(r, "solvedCount"),
    },
    {
        name: "汉诺塔",
        subtitle: "Hanoi",
        href: "/playground/hanoi",
        icon: Layers,
        color: "text-orange-500",
        bgGradient: "from-orange-500/10 to-orange-600/5",
        tags: ["Technology", "Engineering"],
        description: "递归与分治的完美载体。用最少步数搬完塔，或观赏自动求解。",
        statsKey: "hanoi_stats",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "wins"),
    },
    {
        name: "排序可视化",
        subtitle: "Sorting Race",
        href: "/playground/sorting",
        icon: BarChart3,
        color: "text-cyan-500",
        bgGradient: "from-cyan-500/10 to-cyan-600/5",
        tags: ["Technology"],
        description: "五大经典排序算法 PK。实时比较交换次数，直观感受 O(n²) vs O(n log n)。",
        statsKey: "sorting_race_stats",
        getPlayed: (r) => safeNum(r, "totalRuns"),
        getWins: (r) => safeNum(r, "totalRuns"),
    },
    {
        name: "数独",
        subtitle: "Sudoku",
        href: "/playground/sudoku",
        icon: Hash,
        color: "text-rose-500",
        bgGradient: "from-rose-500/10 to-rose-600/5",
        tags: ["Math"],
        description: "约束满足问题 (CSP) 经典载体。笔记标记、冲突检测、回溯求解一应俱全。",
        statsKey: "sudoku_stats",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "wins"),
    },
    {
        name: "N 皇后",
        subtitle: "N-Queens",
        href: "/playground/nqueens",
        icon: Crown,
        color: "text-yellow-500",
        bgGradient: "from-yellow-500/10 to-yellow-600/5",
        tags: ["Technology", "Engineering"],
        description: "在棋盘上放置 N 个皇后互不攻击。手动挑战或观赏回溯算法逐步求解。",
        statsKey: "nqueens_stats",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "manualSolves"),
    },
    {
        name: "电路拼图",
        subtitle: "Circuit",
        href: "/playground/circuit",
        icon: Zap,
        color: "text-teal-500",
        bgGradient: "from-teal-500/10 to-teal-600/5",
        tags: ["Science", "Engineering"],
        description: "在网格上连接电路元件，点亮灯泡。体验串并联和逻辑门的奥秘。",
        statsKey: "circuit_stats",
        getPlayed: (r) => safeNum(r, "totalGames"),
        getWins: (r) => safeNum(r, "solvedCount"),
    },
]

const TAG_COLORS: Record<string, string> = {
    Science: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    Technology: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    Engineering: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    Arts: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    Math: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
}

const STEAM_DIMS: { key: SteamTag; label: string; icon: string; color: string; barColor: string }[] = [
    { key: "Science", label: "科学 Science", icon: "🔬", color: "text-blue-500", barColor: "bg-blue-500" },
    { key: "Technology", label: "技术 Technology", icon: "💻", color: "text-purple-500", barColor: "bg-purple-500" },
    { key: "Engineering", label: "工程 Engineering", icon: "⚙️", color: "text-orange-500", barColor: "bg-orange-500" },
    { key: "Arts", label: "艺术 Arts", icon: "🎨", color: "text-pink-500", barColor: "bg-pink-500" },
    { key: "Math", label: "数学 Math", icon: "🔢", color: "text-emerald-500", barColor: "bg-emerald-500" },
]

const BADGE_COUNT = 28

function safeNum(raw: unknown, key: string): number {
    if (raw && typeof raw === "object" && key in raw) {
        const v = (raw as Record<string, unknown>)[key]
        return typeof v === "number" ? v : 0
    }
    return 0
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
        const raw = readStats(game.statsKey)
        const played = game.getPlayed(raw)
        const wins = game.getWins(raw)
        totalPlayed += played
        totalWins += wins
        if (played > 0) gamesExplored++
        perGame.set(game.href, { played, wins })
        if (played > 0) {
            for (const tag of game.tags) {
                steamPlayed[tag] += played
            }
        }
    }

    return { totalPlayed, totalWins, gamesExplored, perGame, steamPlayed }
}

export default function PlaygroundPage() {
    const [stats, setStats] = useState<AggStats | null>(null)

    useEffect(() => {
        setStats(aggregateStats())
    }, [])

    const hasAnyData = stats && stats.totalPlayed > 0
    const steamMax = stats
        ? Math.max(1, ...Object.values(stats.steamPlayed))
        : 1

    return (
        <div className="flex flex-col items-center min-h-screen p-6 lg:p-16">
            <div className="max-w-5xl w-full space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">

                {/* Hero */}
                <div className="text-center space-y-5">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
                        <Terminal className="w-4 h-4" />
                        <span>Hello, World! 欢迎进入数智空间</span>
                    </div>

                    <h1 className="text-4xl lg:text-7xl font-extrabold tracking-tight text-foreground drop-shadow-sm">
                        STEAM{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_auto] animate-text-gradient">
                            Playground
                        </span>
                    </h1>

                    <p className="text-base lg:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                        在这里，游戏不只是消遣。每一局对战都是一节 STEAM 微课——
                        <br className="hidden md:block" />
                        从概率论到博弈树，从涌现理论到组合数学。
                    </p>
                </div>

                {/* Personal Stats Overview */}
                {hasAnyData && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard
                            icon={<Gamepad2 className="w-5 h-5 text-primary" />}
                            value={stats.totalPlayed}
                            label="总游玩局数"
                        />
                        <StatCard
                            icon={<Trophy className="w-5 h-5 text-amber-500" />}
                            value={stats.totalWins}
                            label="总胜利数"
                        />
                        <StatCard
                            icon={<Sparkles className="w-5 h-5 text-violet-500" />}
                            value={`${stats.gamesExplored} / ${GAMES.length}`}
                            label="已体验游戏"
                        />
                        <StatCard
                            icon={<Flame className="w-5 h-5 text-orange-500" />}
                            value={Object.values(stats.steamPlayed).filter((v) => v > 0).length}
                            label="STEAM 维度覆盖"
                            suffix="/ 5"
                        />
                    </div>
                )}

                {/* STEAM Dimension Progress */}
                {hasAnyData && (
                    <div className="p-5 rounded-2xl bg-card/60 backdrop-blur-xl border border-border shadow-sm">
                        <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                            STEAM 探索进度
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            {STEAM_DIMS.map((dim) => {
                                const count = stats.steamPlayed[dim.key]
                                const pct = Math.min(100, (count / steamMax) * 100)
                                const gamesInDim = GAMES.filter((g) =>
                                    g.tags.includes(dim.key),
                                ).length
                                const playedInDim = GAMES.filter(
                                    (g) =>
                                        g.tags.includes(dim.key) &&
                                        (stats.perGame.get(g.href)?.played ?? 0) > 0,
                                ).length
                                return (
                                    <div key={dim.key} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium flex items-center gap-1.5">
                                                <span>{dim.icon}</span>
                                                <span className={dim.color}>{dim.key[0]}</span>
                                            </span>
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {playedInDim}/{gamesInDim} 游戏
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                                            <div
                                                className={cn(
                                                    "h-full rounded-full transition-all duration-700",
                                                    dim.barColor,
                                                    count === 0 && "w-0",
                                                )}
                                                style={{ width: count > 0 ? `${Math.max(8, pct)}%` : "0%" }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            {count > 0 ? `${count} 次活动` : "尚未探索"}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Game Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {GAMES.map((game) => {
                        const gd = stats?.perGame.get(game.href)
                        const played = gd?.played ?? 0
                        return (
                            <Link
                                key={game.href}
                                href={game.href}
                                className={cn(
                                    "group relative p-5 rounded-2xl border border-border bg-gradient-to-br backdrop-blur-md",
                                    "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300",
                                    game.bgGradient,
                                )}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-background/80 border border-border flex items-center justify-center shadow-sm">
                                        <game.icon className={cn("w-5 h-5", game.color)} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {played > 0 && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary tabular-nums">
                                                已玩 {played}
                                            </span>
                                        )}
                                        <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-foreground mb-0.5">
                                    {game.name}
                                    {game.subtitle && (
                                        <span className="text-muted-foreground/50 text-sm font-normal ml-1.5">
                                            {game.subtitle}
                                        </span>
                                    )}
                                </h3>

                                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                                    {game.description}
                                </p>

                                <div className="flex flex-wrap gap-1.5">
                                    {game.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className={cn(
                                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                                TAG_COLORS[tag] ?? "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {/* Recommendation section */}
                {stats && (() => {
                    const unexploredGames = GAMES.filter(
                        (g) => (stats.perGame.get(g.href)?.played ?? 0) === 0,
                    )
                    if (unexploredGames.length === 0) return null
                    const missingDims = STEAM_DIMS.filter(
                        (d) => stats.steamPlayed[d.key] === 0,
                    )
                    const recommended = missingDims.length > 0
                        ? unexploredGames.filter((g) =>
                              g.tags.some((t) =>
                                  missingDims.some((d) => d.key === t),
                              ),
                          )
                        : unexploredGames
                    const toShow = (recommended.length > 0 ? recommended : unexploredGames).slice(0, 3)
                    return (
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/5 to-violet-500/5 border border-primary/20 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <Compass className="w-5 h-5 text-primary" />
                                <h2 className="text-sm font-bold text-foreground">推荐探索</h2>
                                {missingDims.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                        你还没有涉足
                                        {missingDims.map((d) => (
                                            <span key={d.key} className={cn("font-bold mx-0.5", d.color)}>
                                                {d.key[0]}
                                            </span>
                                        ))}
                                        维度
                                    </span>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {toShow.map((game) => (
                                    <Link
                                        key={game.href}
                                        href={game.href}
                                        className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-background/60 hover:border-primary/30 hover:bg-primary/5 transition-all"
                                    >
                                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", `bg-gradient-to-br ${game.bgGradient}`)}>
                                            <game.icon className={cn("w-4 h-4", game.color)} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-foreground truncate">
                                                {game.name}
                                            </p>
                                            <div className="flex gap-1 mt-0.5">
                                                {game.tags.map((t) => (
                                                    <span key={t} className={cn("text-[8px] font-bold uppercase px-1 py-px rounded", TAG_COLORS[t])}>
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )
                })()}

                {/* Bottom info cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-8 border-t border-border text-left">
                    <div className="p-5 rounded-2xl bg-card border border-border backdrop-blur-md hover:bg-accent/50 transition-colors group">
                        <h3 className="text-base font-bold mb-1.5 text-foreground group-hover:text-primary transition-colors">
                            Play & Learn
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            每个游戏右侧都有互动知识面板，手把手解析背后的 STEAM 原理与算法思想。
                        </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-card border border-border backdrop-blur-md hover:bg-accent/50 transition-colors group">
                        <div className="flex items-center gap-2 mb-1.5">
                            <Award className="w-4 h-4 text-amber-500" />
                            <h3 className="text-base font-bold text-foreground group-hover:text-amber-500 transition-colors">
                                Earn Badges
                            </h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            通关、破纪录、连胜——每个成就都对应专属徽章与 XP 奖励，展示在你的个人主页。
                            <span className="block text-xs mt-1.5 text-primary/80 font-medium">
                                游乐场共 {BADGE_COUNT} 枚可解锁徽章
                            </span>
                        </p>
                    </div>
                    <div className="p-5 rounded-2xl bg-card border border-border backdrop-blur-md hover:bg-accent/50 transition-colors group">
                        <h3 className="text-base font-bold mb-1.5 text-foreground group-hover:text-blue-500 transition-colors">
                            Code Arena
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            即将开启：编写自定义 AI 脚本，上传至云端与其他玩家的算法一决高下。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({
    icon,
    value,
    label,
    suffix,
}: {
    icon: React.ReactNode
    value: number | string
    label: string
    suffix?: string
}) {
    return (
        <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-xl border border-border flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-background/80 border border-border flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-xl font-black text-foreground tabular-nums leading-tight">
                    {value}
                    {suffix && (
                        <span className="text-sm font-normal text-muted-foreground ml-0.5">
                            {suffix}
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">
                    {label}
                </p>
            </div>
        </div>
    )
}
