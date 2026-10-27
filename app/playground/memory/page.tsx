"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Brain, Globe, RotateCcw, Sparkles, Timer, Trophy, User } from "lucide-react"
import {
    MEMORY_CONCEPT_OPTIONS,
    useMemoryMatch,
    type MemoryDifficulty,
} from "@/hooks/playground/use-memory-match"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MemoryOnlineView } from "@/components/features/playground/memory-online-view"

type PageMode = "single" | "online"

const DIFFICULTIES: Array<{ key: MemoryDifficulty; label: string }> = [
    { key: "easy", label: "4×4" },
    { key: "normal", label: "4×5" },
    { key: "hard", label: "6×6" },
]

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export default function MemoryPage() {
    return (
        <Suspense fallback={null}>
            <MemoryPageInner />
        </Suspense>
    )
}

function MemoryPageInner() {
    const searchParams = useSearchParams()
    const initialRoomCode = searchParams.get("room")
    // 带 room 参数时直接进入在线模式
    const [mode, setMode] = useState<PageMode>(initialRoomCode ? "online" : "single")
    const game = useMemoryMatch("easy", "physics")
    const { checkBadges } = useGamification()

    useEffect(() => {
        if (game.status !== "won") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            memoryWins: game.stats.wins,
        })
    }, [checkBadges, game.status, game.stats.wins])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 hidden items-center justify-between gap-3 sm:flex">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10">
                                <Brain className="h-5 w-5 text-fuchsia-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">记忆翻牌</h1>
                                <p className="text-sm text-muted-foreground">把物理或数学名词，和它的解释配对。</p>
                            </div>
                        </div>
                        {mode === "single" ? (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11"
                                onClick={() => game.startNewGame()}
                                aria-label="重新开始"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>

                    {/* 单机 / 在线模式切换；手机端把重新开始并到同一行 */}
                    <div className="mb-4 flex items-center gap-2">
                    <div
                        className="flex h-11 w-full items-center rounded-full border border-border/60 bg-muted/40 p-0.5 sm:h-9 sm:w-auto"
                        role="group"
                        aria-label="游戏模式"
                    >
                        {(
                            [
                                { value: "single" as const, label: "单机", icon: User },
                                { value: "online" as const, label: "在线", icon: Globe },
                            ]
                        ).map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setMode(value)}
                                className={cn(
                                    "inline-flex h-full flex-1 items-center justify-center gap-1 rounded-full px-3 text-[15px] font-semibold transition-colors sm:flex-none sm:px-4 sm:text-[13px]",
                                    mode === value
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "text-muted-foreground hover:text-foreground",
                                )}
                                aria-pressed={mode === value}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                    {mode === "single" ? (
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 shrink-0 rounded-full sm:hidden"
                            onClick={() => game.startNewGame()}
                            aria-label="重新开始"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    ) : null}
                    </div>

                    {mode === "online" ? (
                        <MemoryOnlineView initialRoomCode={initialRoomCode} />
                    ) : null}

                    <div className={cn("mb-3 flex flex-wrap items-center gap-2", mode === "online" && "hidden")}>
                        <span className="text-sm font-bold text-muted-foreground">难度</span>
                        {DIFFICULTIES.map((item) => (
                            <Button
                                key={item.key}
                                size="sm"
                                variant={game.difficulty === item.key ? "default" : "outline"}
                                className="min-h-11 px-4"
                                onClick={() => game.startNewGame({ difficulty: item.key })}
                            >
                                {item.label}
                            </Button>
                        ))}
                        <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-bold">
                            {game.moves} 次配对 · {formatTime(game.time)}
                        </span>
                    </div>

                    <div className={cn("mb-4 flex flex-wrap items-center gap-2", mode === "online" && "hidden")}>
                        <span className="text-sm font-bold text-muted-foreground">题库</span>
                        {MEMORY_CONCEPT_OPTIONS.map((item) => {
                            const selected = game.pack === item.key
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => game.startNewGame({ pack: item.key })}
                                    className={cn(
                                        "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition-colors",
                                        selected
                                            ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                    )}
                                    aria-pressed={selected}
                                >
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>

                    <div
                        className={cn("grid gap-2 sm:gap-2.5", mode === "online" && "hidden")}
                        style={{ gridTemplateColumns: `repeat(${game.columns}, minmax(0, 1fr))` }}
                    >
                        {game.cards.map((card) => (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => game.flipCard(card.id)}
                                disabled={card.open || game.status === "won"}
                                aria-label={card.open ? (card.face === "term" ? `名词 ${card.label}` : `解释 ${card.label}`) : "未翻开的牌"}
                                className={cn(
                                    "memory-card-scene aspect-square rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60",
                                    card.matched && "memory-card-matched",
                                )}
                            >
                                <div
                                    className={cn(
                                        "memory-card-face relative h-full w-full",
                                        card.open && "memory-card-face-open",
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "memory-card-side absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg border shadow-sm",
                                            "border-fuchsia-300/50 bg-[linear-gradient(145deg,oklch(0.72_0.14_330),oklch(0.55_0.18_310))] text-white",
                                            "dark:border-fuchsia-400/30 dark:bg-[linear-gradient(145deg,oklch(0.42_0.12_320),oklch(0.28_0.1_300))]",
                                        )}
                                    >
                                        <div
                                            className="absolute inset-0 opacity-30"
                                            style={{
                                                backgroundImage:
                                                    "radial-gradient(circle at 30% 25%, white 0 1.5px, transparent 2px), radial-gradient(circle at 70% 70%, white 0 1.2px, transparent 1.8px)",
                                                backgroundSize: "14px 14px, 18px 18px",
                                            }}
                                        />
                                        <Brain className="relative h-[28%] w-[28%] text-white/85 drop-shadow-sm" />
                                    </div>
                                    <div
                                        className={cn(
                                            "memory-card-side memory-card-front absolute inset-0 flex items-center justify-center rounded-lg border p-1.5 shadow-sm sm:p-2",
                                            card.matched
                                                ? "border-emerald-400/50 bg-emerald-500/15"
                                                : card.face === "term"
                                                  ? "border-violet-300/50 bg-violet-50 dark:border-violet-400/40 dark:bg-violet-500/15"
                                                  : "border-amber-300/45 bg-amber-50 dark:border-amber-400/35 dark:bg-amber-500/15",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "select-none text-center font-black leading-snug text-foreground",
                                                card.face === "term"
                                                    ? game.columns >= 6
                                                        ? "text-base sm:text-xl"
                                                        : "text-lg sm:text-2xl"
                                                    : game.columns >= 6
                                                      ? "text-xs sm:text-sm"
                                                      : "text-sm sm:text-base",
                                            )}
                                        >
                                            {card.label}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {mode === "single" && game.status === "won" && (
                        <div className="mt-4 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-fuchsia-500" />
                            <p className="font-black">全部配对完成！</p>
                            <p className="text-xs text-muted-foreground">{game.moves} 次配对 · {formatTime(game.time)}</p>
                        </div>
                    )}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-fuchsia-500" />
                            最佳记录
                        </h2>
                        <div className="space-y-2 text-xs">
                            {DIFFICULTIES.map((item) => (
                                <div key={item.key} className="flex justify-between rounded-sm bg-muted/30 p-3">
                                    <span>{item.label}</span>
                                    <span className="font-mono">
                                        {game.stats.bestMoves[item.key] ? `${game.stats.bestMoves[item.key]} 次 / ${formatTime(game.stats.bestTimes[item.key] ?? 0)}` : "暂无"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">怎么配对</h3>
                        <p className="leading-relaxed text-foreground">
                            紫色牌是名词，黄色牌是解释。找出意思相同的一对即可。一边练记忆，一边记概念。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-sm bg-muted/20 p-4 text-sm text-foreground">
                        <Timer className="h-4 w-4 shrink-0" />
                        <span>先记住名词位置，再翻解释去对，比乱翻更省步数。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
