"use client"

import { useEffect } from "react"
import {
    CheckCircle2,
    FlipHorizontal,
    MousePointerClick,
    RotateCcw,
    Sparkles,
    Star,
    Target,
    Timer,
    Trophy,
} from "lucide-react"
import {
    isSymmetryPlayableCell,
    isSymmetrySourceCell,
    SYMMETRY_LEVELS,
    type SymmetryLevel,
    useSymmetry,
} from "@/hooks/playground/use-symmetry"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function axisLabel(level: SymmetryLevel) {
    return level.axis === "vertical" ? "竖轴镜像" : "横轴镜像"
}

function sourceLabel(level: SymmetryLevel) {
    switch (level.sourceSide) {
        case "left":
            return "左半边样本"
        case "right":
            return "右半边样本"
        case "top":
            return "上半边样本"
        case "bottom":
            return "下半边样本"
    }
}

function renderStars(count: number, className?: string) {
    return (
        <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${count} 星`}>
            {Array.from({ length: 3 }, (_, index) => (
                <Star
                    key={index}
                    className={cn(
                        "h-4 w-4",
                        index < count
                            ? "fill-amber-400 text-amber-500"
                            : "fill-muted text-muted-foreground/40",
                    )}
                />
            ))}
        </span>
    )
}

export default function SymmetryPage() {
    const game = useSymmetry()
    const { checkBadges } = useGamification()
    const size = game.level.size
    const nextLevelIndex = game.levelIndex + 1 < game.levelCount ? game.levelIndex + 1 : 0
    const boardMaxWidth = size >= 10 ? "max-w-[34rem]" : size >= 8 ? "max-w-[29rem]" : "max-w-[23rem]"

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
                <div className="w-full max-w-5xl playground-game-board">
                    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-rose-400/35 bg-rose-500/10">
                                <FlipHorizontal className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-xl font-black">像素对称 · {game.level.name}</h1>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {sourceLabel(game.level)} · {axisLabel(game.level)} · 补全挑战半边。
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:flex sm:items-center">
                            <span className="inline-flex min-h-10 items-center justify-center gap-1 rounded-sm border border-border bg-muted/50 px-3 font-bold">
                                <Timer className="h-4 w-4 text-muted-foreground" />
                                {formatTime(game.time)}
                            </span>
                            <span className="inline-flex min-h-10 items-center justify-center gap-1 rounded-sm border border-border bg-muted/50 px-3 font-bold">
                                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                                {game.moves} 步
                            </span>
                            <span className="inline-flex min-h-10 items-center justify-center gap-1 rounded-sm border border-border bg-muted/50 px-3 font-bold">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                剩 {game.progress.remaining}
                            </span>
                            <Button variant="outline" size="icon" className="h-10 w-full sm:w-10" onClick={game.clear} aria-label="重置本关">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar" aria-label="像素对称关卡">
                        {SYMMETRY_LEVELS.map((level, index) => {
                            const solved = game.stats.solvedLevels.includes(level.id)
                            const stars = game.stats.bestStars[level.id] ?? 0
                            return (
                                <Button
                                    key={level.id}
                                    size="sm"
                                    variant={game.levelIndex === index ? "default" : "outline"}
                                    className="min-h-10 shrink-0 gap-1.5"
                                    onClick={() => game.startLevel(index)}
                                >
                                    {level.name}
                                    {solved ? (
                                        <span className="inline-flex items-center gap-0.5">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span className="text-[11px]">{stars || 1}</span>
                                        </span>
                                    ) : null}
                                </Button>
                            )
                        })}
                    </div>

                    <div className="mb-4 grid gap-3 rounded-md border border-rose-200/70 bg-rose-50/80 p-3 text-xs dark:border-rose-400/20 dark:bg-rose-400/8 sm:grid-cols-[1fr_auto] sm:items-center">
                        <p className="leading-5 text-rose-950/80 dark:text-rose-50/80">{game.level.hint}</p>
                        <div className="flex items-center gap-3 font-bold">
                            <span>连击 {game.streak}</span>
                            <span>误点 {game.mistakes}</span>
                            {renderStars(game.stars)}
                        </div>
                    </div>

                    <div className="mx-auto rounded-lg border border-border/80 bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.55))] p-3 shadow-inner sm:p-4">
                        <div
                            className={cn("mx-auto grid gap-1", boardMaxWidth)}
                            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
                        >
                            {game.grid.map((row, r) =>
                                row.map((cell, c) => {
                                    const source = isSymmetrySourceCell(game.level, r, c)
                                    const playable = isSymmetryPlayableCell(game.level, r, c)
                                    const target = game.level.target[r][c] === 1
                                    const filled = cell === 1
                                    const correct = playable && filled && target
                                    const wrong = playable && filled && !target
                                    const feedback = game.lastFeedback?.row === r && game.lastFeedback.col === c
                                    const axisEdge =
                                        game.level.axis === "vertical"
                                            ? c === size / 2 - 1
                                                ? "border-r-2 border-r-rose-500/80"
                                                : c === size / 2
                                                    ? "border-l-2 border-l-rose-500/80"
                                                    : ""
                                            : r === size / 2 - 1
                                                ? "border-b-2 border-b-rose-500/80"
                                                : r === size / 2
                                                    ? "border-t-2 border-t-rose-500/80"
                                                    : ""

                                    return (
                                        <button
                                            key={`${r}-${c}`}
                                            type="button"
                                            onClick={() => game.paint(r, c)}
                                            disabled={!playable || game.status === "solved"}
                                            className={cn(
                                                "relative aspect-square rounded-[3px] border text-[0] transition duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default",
                                                "before:pointer-events-none before:absolute before:inset-[18%] before:rounded-[1px]",
                                                source && filled
                                                    ? "border-rose-700/45 bg-rose-500 shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] before:bg-white/18"
                                                    : source
                                                        ? "border-rose-200/80 bg-rose-50 dark:border-rose-400/15 dark:bg-rose-400/10"
                                                        : correct
                                                            ? "border-sky-700/50 bg-sky-500 shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] before:bg-white/20"
                                                            : wrong
                                                                ? "border-amber-600 bg-amber-300 ring-2 ring-amber-400/50 dark:bg-amber-500"
                                                                : "border-border bg-background hover:border-sky-400/70 hover:bg-sky-100/70 dark:hover:bg-sky-400/12",
                                                source && "opacity-95",
                                                feedback && correct && "scale-95 ring-2 ring-sky-300/70",
                                                feedback && wrong && "scale-95 ring-2 ring-amber-500",
                                                axisEdge,
                                            )}
                                            aria-label={`${source ? "样本" : "挑战"}像素 ${r + 1},${c + 1}`}
                                        />
                                    )
                                }),
                            )}
                        </div>
                    </div>

                    {game.status === "solved" ? (
                        <div className="mt-4 rounded-lg border border-sky-400/40 bg-sky-500/10 p-4">
                            <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
                                <div>
                                    <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                                        <Sparkles className="h-5 w-5 text-sky-500" />
                                        <p className="font-black">镜像完成</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {formatTime(game.time)} · {game.moves} 步 · 误点 {game.mistakes} · 获得 {game.stars} 星
                                    </p>
                                </div>
                                <div className="flex items-center justify-center gap-3">
                                    {renderStars(game.stars, "scale-110")}
                                    <Button size="sm" onClick={() => game.startLevel(nextLevelIndex)}>
                                        {nextLevelIndex === 0 ? "回到第一关" : "下一关"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-rose-500" />
                            最佳成绩
                        </h2>
                        <div className="space-y-2 text-xs">
                            {SYMMETRY_LEVELS.map((level) => {
                                const solved = game.stats.solvedLevels.includes(level.id)
                                return (
                                    <div key={level.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                                        <span>{level.name}</span>
                                        <span className="flex items-center gap-2 font-bold">
                                            {solved ? renderStars(game.stats.bestStars[level.id] ?? 1) : null}
                                            {solved ? formatTime(game.stats.bestTimes[level.id] ?? 0) : "未完成"}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                    <section className="rounded-md border border-border bg-background/70 p-3 text-xs leading-5 text-muted-foreground">
                        <p>
                            暖色像素是锁定样本，蓝色像素是你的镜像答案。误点不会直接失败，但会压低星级。
                        </p>
                    </section>
                </div>
            </aside>
        </div>
    )
}
