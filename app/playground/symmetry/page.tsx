"use client"

import { useEffect } from "react"
import { FlipHorizontal, RotateCcw, Sparkles, Trophy } from "lucide-react"
import { SYMMETRY_LEVELS, useSymmetry } from "@/hooks/playground/use-symmetry"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export default function SymmetryPage() {
    const game = useSymmetry()
    const { checkBadges } = useGamification()
    const size = game.level.size

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
            symmetrySolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-pink-400/40 bg-pink-500/10">
                                <FlipHorizontal className="h-5 w-5 text-pink-600 dark:text-pink-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">像素对称 · {game.level.name}</h1>
                                <p className="text-xs text-muted-foreground">
                                    {game.level.axis === "vertical" ? "左右镜像" : "上下镜像"}作画，灰色为剪影目标。
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                                {game.progress.matched}/{game.progress.total} · {formatTime(game.time)}
                            </span>
                            <Button variant="outline" size="icon" className="h-11 w-11" onClick={game.clear} aria-label="清空">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {SYMMETRY_LEVELS.map((level, index) => (
                            <Button key={level.id} size="sm" variant={game.levelIndex === index ? "default" : "outline"} onClick={() => game.startLevel(index)}>
                                {level.name}
                                {game.stats.solvedLevels.includes(level.id) ? <span className="ml-1">✓</span> : null}
                            </Button>
                        ))}
                    </div>

                    <p className="mb-4 text-xs text-muted-foreground">{game.level.hint}</p>

                    <div
                        className="mx-auto grid max-w-md gap-1"
                        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
                    >
                        {game.grid.map((row, r) =>
                            row.map((cell, c) => {
                                const target = game.level.target[r][c] === 1
                                return (
                                    <button
                                        key={`${r}-${c}`}
                                        type="button"
                                        onClick={() => game.paint(r, c)}
                                        className={cn(
                                            "aspect-square rounded-sm border transition-colors",
                                            cell === 1
                                                ? "border-pink-500 bg-pink-500"
                                                : target
                                                    ? "border-pink-300/50 bg-pink-500/15"
                                                    : "border-border bg-muted/30 hover:bg-muted/60",
                                        )}
                                        aria-label={`像素 ${r + 1},${c + 1}`}
                                    />
                                )
                            }),
                        )}
                    </div>

                    {game.status === "solved" ? (
                        <div className="mt-4 rounded-lg border border-pink-400/40 bg-pink-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-pink-500" />
                            <p className="font-black">剪影完成！</p>
                            <p className="text-xs text-muted-foreground">{formatTime(game.time)}</p>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-pink-500" />
                            通关用时
                        </h2>
                        <div className="space-y-2 text-xs">
                            {SYMMETRY_LEVELS.map((level) => (
                                <div key={level.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                                    <span>{level.name}</span>
                                    <span className="font-bold">
                                        {game.stats.solvedLevels.includes(level.id)
                                            ? formatTime(game.stats.bestTimes[level.id] ?? 0)
                                            : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <p className="text-xs text-muted-foreground">点击任意格会同时涂上镜像格，练的是轴对称与空间想象。</p>
                </div>
            </aside>
        </div>
    )
}
