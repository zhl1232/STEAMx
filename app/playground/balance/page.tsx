"use client"

import { useEffect } from "react"
import { RotateCcw, Scale, Sparkles, Trophy } from "lucide-react"
import { BALANCE_LEVELS, useBalance } from "@/hooks/playground/use-balance"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

export default function BalancePage() {
    const game = useBalance()
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
            balanceSolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    const tilt =
        game.lastResult === "left" ? "rotate-[-6deg]" : game.lastResult === "right" ? "rotate-[6deg]" : "rotate-0"

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-teal-400/40 bg-teal-500/10">
                                <Scale className="h-5 w-5 text-teal-600 dark:text-teal-300" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">天平称重 · {game.level.name}</h1>
                                <p className="text-xs text-muted-foreground">
                                    假币{game.level.fakeLighter ? "更轻" : "更重"} · 最多称 {game.level.maxWeighings} 次
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                                {game.weighings}/{game.level.maxWeighings} · {formatTime(game.time)}
                            </span>
                            <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => game.startLevel(game.levelIndex)} aria-label="重开">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                        {BALANCE_LEVELS.map((level, index) => (
                            <Button key={level.id} size="sm" variant={game.levelIndex === index ? "default" : "outline"} onClick={() => game.startLevel(index)}>
                                {level.name}
                                {game.stats.solvedLevels.includes(level.id) ? <span className="ml-1">✓</span> : null}
                            </Button>
                        ))}
                    </div>

                    <p className="mb-4 text-xs text-muted-foreground">{game.level.hint}</p>

                    <div className={cn("mb-4 rounded-lg border bg-muted/20 p-4 transition-transform", tilt)}>
                        <div className="mb-3 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
                            <span>左盘</span>
                            <span className="h-px w-16 bg-border" />
                            <Scale className="h-4 w-4" />
                            <span className="h-px w-16 bg-border" />
                            <span>右盘</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="min-h-24 rounded-md border border-dashed border-border p-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {game.left.map((coin) => (
                                        <button
                                            key={`L-${coin}`}
                                            type="button"
                                            className="min-h-11 min-w-11 rounded-full border border-teal-400/50 bg-teal-500/20 text-sm font-black"
                                            onClick={() => game.toggleCoin(coin, "left")}
                                        >
                                            {coin + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="min-h-24 rounded-md border border-dashed border-border p-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {game.right.map((coin) => (
                                        <button
                                            key={`R-${coin}`}
                                            type="button"
                                            className="min-h-11 min-w-11 rounded-full border border-amber-400/50 bg-amber-500/20 text-sm font-black"
                                            onClick={() => game.toggleCoin(coin, "right")}
                                        >
                                            {coin + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" onClick={game.doWeigh} disabled={game.status !== "playing"}>
                                称量
                            </Button>
                            <Button size="sm" variant="outline" onClick={game.clearPans} disabled={game.status !== "playing"}>
                                清空托盘
                            </Button>
                            {game.lastResult ? (
                                <span className="self-center text-xs font-bold text-teal-700 dark:text-teal-300">
                                    结果：{game.lastResult === "equal" ? "平衡" : game.lastResult === "left" ? "左边更重" : "右边更重"}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="mb-3">
                        <p className="mb-2 text-xs font-bold text-muted-foreground">待测硬币（点选放入托盘）</p>
                        <div className="flex flex-wrap gap-2">
                            {game.availableCoins.map((coin) => (
                                <div key={coin} className="flex gap-1">
                                    <Button size="sm" variant="outline" className="min-h-11 px-3" onClick={() => game.toggleCoin(coin, "left")}>
                                        {coin + 1}→左
                                    </Button>
                                    <Button size="sm" variant="outline" className="min-h-11 px-3" onClick={() => game.toggleCoin(coin, "right")}>
                                        {coin + 1}→右
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mb-3">
                        <p className="mb-2 text-xs font-bold text-muted-foreground">指认假币</p>
                        <div className="flex flex-wrap gap-2">
                            {Array.from({ length: game.level.coinCount }, (_, coin) => (
                                <Button
                                    key={`guess-${coin}`}
                                    size="sm"
                                    variant="secondary"
                                    className="min-h-11 min-w-11"
                                    disabled={game.status !== "playing"}
                                    onClick={() => game.guess(coin)}
                                >
                                    {coin + 1}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {game.message ? (
                        <div
                            className={cn(
                                "rounded-lg border p-4 text-center",
                                game.status === "solved" && "border-emerald-400/40 bg-emerald-500/10",
                                game.status === "failed" && "border-rose-400/40 bg-rose-500/10",
                                game.status === "playing" && "border-border bg-muted/40",
                            )}
                        >
                            {game.status === "solved" ? <Sparkles className="mx-auto mb-2 h-6 w-6 text-emerald-500" /> : null}
                            <p className="font-black">{game.message}</p>
                        </div>
                    ) : null}

                    {game.history.length > 0 ? (
                        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
                            {game.history.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-teal-500" />
                            最少称量
                        </h2>
                        <div className="space-y-2 text-xs">
                            {BALANCE_LEVELS.map((level) => (
                                <div key={level.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                                    <span>{level.name}</span>
                                    <span className="font-bold">
                                        {game.stats.bestWeighings[level.id] != null ? `${game.stats.bestWeighings[level.id]} 次` : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <p className="text-xs text-muted-foreground">科学推理：每次称量把可能性分成三组——左重、右重、平衡。</p>
                </div>
            </aside>
        </div>
    )
}
