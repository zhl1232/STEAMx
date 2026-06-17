"use client"

import { useEffect } from "react"
import { Grid3X3, RotateCcw, Sparkles, Timer, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react"
import { useFifteenPuzzle, type FifteenSize } from "@/hooks/playground/use-fifteen-puzzle"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

const SIZES: FifteenSize[] = [3, 4, 5]

export default function FifteenPuzzlePage() {
    const game = useFifteenPuzzle(4)
    const { checkBadges } = useGamification()

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const map: Record<string, "up" | "down" | "left" | "right" | undefined> = {
                ArrowUp: "up",
                ArrowDown: "down",
                ArrowLeft: "left",
                ArrowRight: "right",
            }
            const direction = map[event.key]
            if (direction) {
                event.preventDefault()
                game.moveByDirection(direction)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [game])

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
            fifteenWins: game.stats.wins,
        })
    }, [checkBadges, game.status, game.stats.wins])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-cyan-400/40 bg-cyan-500/10">
                                <Grid3X3 className="h-5 w-5 text-cyan-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">数字华容道</h1>
                                <p className="text-xs text-muted-foreground">滑动数字，还原顺序。</p>
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

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {SIZES.map((size) => (
                            <Button
                                key={size}
                                variant={game.size === size ? "default" : "outline"}
                                size="sm"
                                className="min-h-11 px-4"
                                onClick={() => game.startNewGame(size)}
                            >
                                {size}×{size}
                            </Button>
                        ))}
                        <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-bold">
                            {game.moves} 步 · {formatTime(game.time)}
                        </span>
                    </div>

                    <div
                        className="grid gap-2 rounded-lg bg-muted/30 p-3 touch-none select-none"
                        style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` }}
                        onTouchStart={game.onTouchStart}
                        onTouchEnd={game.onTouchEnd}
                    >
                        {game.board.map((tile, index) => (
                            <button
                                key={`${tile}-${index}`}
                                type="button"
                                onClick={() => game.tapTile(index)}
                                disabled={tile === 0 || game.status === "solved"}
                                className={cn(
                                    "aspect-square rounded-sm text-lg font-black transition-all sm:text-2xl",
                                    tile === 0
                                        ? "bg-transparent"
                                        : game.canMove(index)
                                            ? "bg-cyan-500 text-white shadow-lg hover:-translate-y-0.5"
                                            : "bg-background text-foreground shadow-sm",
                                )}
                            >
                                {tile || ""}
                            </button>
                        ))}
                    </div>

                    {game.status === "solved" && (
                        <div className="mt-4 rounded-lg border border-cyan-400/40 bg-cyan-500/10 p-4 text-center">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-cyan-500" />
                            <p className="font-black">复原成功！</p>
                            <p className="text-xs text-muted-foreground">{game.moves} 步 · {formatTime(game.time)}</p>
                        </div>
                    )}

                    {/* 移动端方向按钮 */}
                    <div className="flex xl:hidden justify-center mt-4">
                        <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-[148px] h-[148px]">
                            <div />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => game.moveByDirection("up")}
                                className="w-full h-full rounded-sm"
                                aria-label="向上移动"
                            >
                                <ArrowUp className="w-5 h-5" aria-hidden />
                            </Button>
                            <div />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => game.moveByDirection("left")}
                                className="w-full h-full rounded-sm"
                                aria-label="向左移动"
                            >
                                <ArrowLeft className="w-5 h-5" aria-hidden />
                            </Button>
                            <div />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => game.moveByDirection("right")}
                                className="w-full h-full rounded-sm"
                                aria-label="向右移动"
                            >
                                <ArrowRight className="w-5 h-5" aria-hidden />
                            </Button>
                            <div />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => game.moveByDirection("down")}
                                className="w-full h-full rounded-sm"
                                aria-label="向下移动"
                            >
                                <ArrowDown className="w-5 h-5" aria-hidden />
                            </Button>
                            <div />
                        </div>
                    </div>
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-cyan-500" />
                            最佳记录
                        </h2>
                        <div className="space-y-2 text-xs">
                            {SIZES.map((size) => (
                                <div key={size} className="flex justify-between rounded-sm bg-muted/30 p-3">
                                    <span>{size}×{size}</span>
                                    <span className="font-mono">
                                        {game.stats.bestMoves[size] ? `${game.stats.bestMoves[size]} 步 / ${formatTime(game.stats.bestTimes[size] ?? 0)}` : "暂无"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">为什么有些打乱无解？</h3>
                        <p className="leading-relaxed">
                            数字华容道的可解性由逆序数和空格所在行共同决定。本游戏通过从完成态随机滑动生成棋盘，天然保证每一局都可解。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-sm bg-muted/20 p-4 text-xs text-muted-foreground">
                        <Timer className="h-4 w-4" />
                        <span>尝试减少无效移动，用更少步数复原。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
