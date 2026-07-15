"use client"

import { useEffect, useRef } from "react"
import { Calculator, Delete, RotateCcw, Sparkles, Trophy, Zap } from "lucide-react"
import { useQuickMath } from "@/hooks/playground/use-quick-math"
import { useRaceOnline } from "@/hooks/playground/use-race-online"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { RaceOnlinePanel } from "@/components/features/playground/race-online-panel"

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "-", "0"]

export default function QuickMathPage() {
    const game = useQuickMath()
    const race = useRaceOnline("quickmath", { durationSeconds: 60 })
    const raceIsPlaying = race.isPlaying
    const raceHasSubmitted = race.hasSubmitted
    const submitRaceResult = race.submitResult
    const { checkBadges } = useGamification()
    const prevStatusRef = useRef(game.status)

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key >= "0" && event.key <= "9") game.appendInput(event.key)
            if (event.key === "-") game.appendInput("-")
            if (event.key === "Backspace") game.backspace()
            if (event.key === "Enter") game.submit()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [game])

    useEffect(() => {
        if (game.status !== "finished") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            quickMathBestScore: Math.max(game.stats.bestScore, game.score),
            quickMathBestStreak: Math.max(game.stats.bestStreak, game.bestRoundStreak),
        })
    }, [checkBadges, game.bestRoundStreak, game.score, game.stats, game.status])

    useEffect(() => {
        const justFinished = prevStatusRef.current !== "finished" && game.status === "finished"
        prevStatusRef.current = game.status
        if (!justFinished || !raceIsPlaying || raceHasSubmitted) return
        void submitRaceResult({
            score: game.score,
            streak: game.bestRoundStreak,
            durationSeconds: 60,
        })
    }, [
        game.bestRoundStreak,
        game.score,
        game.status,
        raceHasSubmitted,
        raceIsPlaying,
        submitRaceResult,
    ])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-lg playground-game-board text-center">
                    <div className="mb-5 flex items-center justify-between text-left">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-amber-400/40 bg-amber-500/10">
                                <Calculator className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">速算闪电战</h1>
                                <p className="text-xs text-muted-foreground">60 秒四则运算连击挑战。</p>
                            </div>
                        </div>
                        <Button variant="outline" size="icon" onClick={game.start} aria-label="重新开始">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mb-5 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-sm bg-muted/30 p-3">
                            <div className="text-muted-foreground">剩余</div>
                            <div className="text-2xl font-black">{game.secondsLeft}</div>
                        </div>
                        <div className="rounded-sm bg-muted/30 p-3">
                            <div className="text-muted-foreground">得分</div>
                            <div className="text-2xl font-black">{game.score}</div>
                        </div>
                        <div className="rounded-sm bg-muted/30 p-3">
                            <div className="text-muted-foreground">连击</div>
                            <div className="text-2xl font-black">{game.streak}</div>
                        </div>
                    </div>

                    {game.status === "idle" ? (
                        <Button size="lg" onClick={game.start} className="mb-5 w-full gap-2">
                            <Zap className="h-4 w-4" />
                            开始 60 秒挑战
                        </Button>
                    ) : (
                        <div className="mb-5 rounded-lg border border-amber-400/30 bg-amber-500/10 p-6">
                            <div className="text-sm text-muted-foreground">难度 Level {game.question.level}</div>
                            <div className="my-4 text-5xl font-black tracking-tight">{game.question.text}</div>
                            <div className="mx-auto h-14 rounded-sm border border-border bg-background px-4 py-2 text-3xl font-black">
                                {game.input || "?"}
                            </div>
                        </div>
                    )}

                    {game.status === "finished" && (
                        <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                            <p className="font-black">本轮结束</p>
                            <p className="text-xs text-muted-foreground">得分 {game.score} · 最长连击 {game.bestRoundStreak}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {KEYS.map((key) => (
                            <Button key={key} variant="outline" onClick={() => game.appendInput(key)} disabled={game.status !== "playing"}>
                                {key}
                            </Button>
                        ))}
                        <Button variant="outline" onClick={game.backspace} disabled={game.status !== "playing"} aria-label="删除">
                            <Delete className="h-4 w-4" />
                        </Button>
                        <Button className="col-span-3" onClick={game.submit} disabled={game.status !== "playing"}>
                            提交答案
                        </Button>
                    </div>
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <RaceOnlinePanel online={race} gamePath="/playground/quickmath" />
                    <section className="rounded-sm bg-muted/30 p-4">
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            记录
                        </h2>
                        <div className="text-sm">最高分：<strong>{game.stats.bestScore}</strong></div>
                        <div className="text-sm">最长连击：<strong>{game.stats.bestStreak}</strong></div>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">速算策略</h3>
                        <p className="leading-relaxed">
                            连续答对会提升题目难度，也会增加得分奖励。先保证准确率，再追求速度，错误会清空连击。
                        </p>
                    </section>
                </div>
            </aside>
        </div>
    )
}
