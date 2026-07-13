"use client"

import { useEffect } from "react"
import { Beaker, RotateCcw, Sparkles, Trophy } from "lucide-react"
import { BALL_SORT_LEVELS, useBallSort } from "@/hooks/playground/use-ball-sort"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const BALL_COLORS: Record<number, string> = {
    1: "bg-rose-500",
    2: "bg-sky-500",
    3: "bg-amber-400",
    4: "bg-emerald-500",
    5: "bg-violet-500",
}

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export default function BallSortPage() {
    const game = useBallSort()
    const { checkBadges } = useGamification()

    useEffect(() => {
        if (game.status !== "solved") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            ballSortSolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10">
                                <Beaker className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">球排序 · {game.level.name}</h1>
                                <p className="text-xs text-muted-foreground">把同色球倒进同一管，管满且纯色即通关。</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                                {game.moves} 步 · {formatTime(game.time)}
                            </span>
                            <Button variant="outline" size="icon" className="h-11 w-11" onClick={game.reset} aria-label="重开">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {BALL_SORT_LEVELS.map((level, index) => (
                            <Button key={level.id} size="sm" variant={game.levelIndex === index ? "default" : "outline"} onClick={() => game.startLevel(index)}>
                                {level.name}
                                {game.stats.solvedLevels.includes(level.id) ? <span className="ml-1">✓</span> : null}
                            </Button>
                        ))}
                    </div>

                    <p className="mb-4 text-xs text-muted-foreground">{game.level.hint}</p>

                    <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
                        {game.tubes.map((tube, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => game.selectTube(index)}
                                className={cn(
                                    "flex w-14 flex-col justify-end rounded-b-xl border-2 border-t-0 px-1.5 pb-1.5 pt-8 transition-colors sm:w-16",
                                    game.selected === index
                                        ? "border-cyan-500 bg-cyan-500/10"
                                        : "border-border bg-muted/30 hover:bg-muted/50",
                                )}
                                style={{ minHeight: `${game.level.capacity * 28 + 40}px` }}
                                aria-label={`试管 ${index + 1}`}
                            >
                                <div className="flex flex-1 flex-col-reverse gap-1">
                                    {Array.from({ length: game.level.capacity }).map((_, slot) => {
                                        const color = tube[slot]
                                        return (
                                            <div
                                                key={slot}
                                                className={cn(
                                                    "h-6 w-full rounded-full border border-black/5 sm:h-7",
                                                    color ? BALL_COLORS[color] : "bg-transparent",
                                                )}
                                            />
                                        )
                                    })}
                                </div>
                            </button>
                        ))}
                    </div>

                    {game.status === "solved" ? (
                        <div className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-cyan-500" />
                            <p className="font-black">全部归位！</p>
                            <p className="text-xs text-muted-foreground">{game.moves} 步 · {formatTime(game.time)}</p>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-cyan-500" />
                            最佳步数
                        </h2>
                        <div className="space-y-2 text-xs">
                            {BALL_SORT_LEVELS.map((level) => (
                                <div key={level.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                                    <span>{level.name}</span>
                                    <span className="font-bold">
                                        {game.stats.bestMoves[level.id] != null ? `${game.stats.bestMoves[level.id]} 步` : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <p className="text-xs text-muted-foreground">只能把连续同色球倒向空管，或倒向顶部同色且未满的管。</p>
                </div>
            </aside>
        </div>
    )
}
