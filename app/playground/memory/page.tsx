"use client"

import { useEffect } from "react"
import { Brain, RotateCcw, Sparkles, Timer, Trophy } from "lucide-react"
import {
    MEMORY_THEMES,
    useMemoryMatch,
    type MemoryDifficulty,
} from "@/hooks/playground/use-memory-match"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
    const game = useMemoryMatch("easy", "animals")
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
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-fuchsia-400/40 bg-fuchsia-500/10">
                                <Brain className="h-5 w-5 text-fuchsia-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">记忆翻牌</h1>
                                <p className="text-xs text-muted-foreground">选一套图案，记住位置，找出所有配对。</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-11 w-11"
                            onClick={() => game.startNewGame()}
                            aria-label="重新开始"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">难度</span>
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

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">图案</span>
                        {MEMORY_THEMES.map((item) => {
                            const selected = game.theme === item.key
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => game.startNewGame({ theme: item.key })}
                                    className={cn(
                                        "inline-flex min-h-11 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors",
                                        selected
                                            ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-foreground"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                    )}
                                    aria-pressed={selected}
                                >
                                    <span className="flex gap-0.5 text-sm leading-none" aria-hidden="true">
                                        {item.preview.slice(0, 2).map((emoji) => (
                                            <span key={emoji}>{emoji}</span>
                                        ))}
                                    </span>
                                    {item.label}
                                </button>
                            )
                        })}
                    </div>

                    <div
                        className="grid gap-2 sm:gap-2.5"
                        style={{ gridTemplateColumns: `repeat(${game.columns}, minmax(0, 1fr))` }}
                    >
                        {game.cards.map((card) => (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => game.flipCard(card.id)}
                                disabled={card.open || game.status === "won"}
                                aria-label={card.open ? `图案 ${card.symbol}` : "未翻开的牌"}
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
                                            "memory-card-side memory-card-front absolute inset-0 flex items-center justify-center rounded-lg border shadow-sm",
                                            card.matched
                                                ? "border-emerald-400/50 bg-emerald-500/15"
                                                : "border-amber-300/45 bg-amber-50 dark:border-amber-400/35 dark:bg-amber-500/15",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "select-none leading-none",
                                                game.columns >= 6 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
                                            )}
                                            aria-hidden="true"
                                        >
                                            {card.symbol}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {game.status === "won" && (
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
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">工作记忆</h3>
                        <p className="leading-relaxed">
                            翻牌游戏训练的是工作记忆：短时间保存并更新信息。你会在脑中建立一张空间地图，把图案与位置关联起来。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-sm bg-muted/20 p-4 text-xs text-muted-foreground">
                        <Timer className="h-4 w-4" />
                        <span>减少重复翻牌，比单纯追求速度更重要。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
