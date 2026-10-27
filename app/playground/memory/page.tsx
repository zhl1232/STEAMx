"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Brain, Check, Globe, Lock, RotateCcw, Sparkles, Timer, Trophy, User } from "lucide-react"
import { useMemoryMatch } from "@/hooks/playground/use-memory-match"
import { getMemoryLevelTheme, MEMORY_LEVEL_THEMES } from "@/lib/playground/memory-levels"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { MemoryOnlineView } from "@/components/features/playground/memory-online-view"

type PageMode = "single" | "online"

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
    const game = useMemoryMatch()
    const currentTheme = getMemoryLevelTheme(game.level.themeId)
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
                                <p className="text-sm text-muted-foreground">选一个主题闯关，把名词和它的解释配对。</p>
                            </div>
                        </div>
                        {mode === "single" ? (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11"
                                onClick={() => game.startLevel()}
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
                            onClick={() => game.startLevel()}
                            aria-label="重新开始"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    ) : null}
                    </div>

                    {mode === "online" ? (
                        <MemoryOnlineView initialRoomCode={initialRoomCode} />
                    ) : null}

                    <div className={cn("mb-4 space-y-3", mode === "online" && "hidden")}>
                        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="主题">
                            {MEMORY_LEVEL_THEMES.map((t) => {
                                const selected = game.level.themeId === t.id
                                const done = t.levels.filter((lv) => game.stats.clearedLevels.includes(lv.id)).length
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={selected}
                                        onClick={() => {
                                            const firstOpen = [...t.levels].reverse().find((lv) => game.isUnlocked(lv) && !game.stats.clearedLevels.includes(lv.id)) ?? t.levels[0]
                                            game.startLevel(firstOpen.id)
                                        }}
                                        className={cn(
                                            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] font-bold transition-colors",
                                            selected
                                                ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-foreground"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                        )}
                                    >
                                        <span aria-hidden>{t.emoji}</span>
                                        {t.label}
                                        <span className="text-sm font-semibold text-muted-foreground">{done}/{t.levels.length}</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {currentTheme.levels.map((lv) => {
                                const unlocked = game.isUnlocked(lv)
                                const cleared = game.stats.clearedLevels.includes(lv.id)
                                const selected = game.level.id === lv.id
                                return (
                                    <button
                                        key={lv.id}
                                        type="button"
                                        disabled={!unlocked}
                                        onClick={() => game.startLevel(lv.id)}
                                        aria-pressed={selected}
                                        aria-label={`第 ${lv.index + 1} 关 ${lv.name}${unlocked ? "" : "（未解锁）"}`}
                                        className={cn(
                                            "flex min-h-14 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors",
                                            selected
                                                ? "border-fuchsia-400/70 bg-fuchsia-500/15"
                                                : "border-border bg-background hover:bg-muted/60",
                                            !unlocked && "cursor-not-allowed opacity-60",
                                        )}
                                    >
                                        <span className="flex items-center gap-1 text-[15px] font-black">
                                            {unlocked ? (cleared ? <Check className="h-4 w-4 text-emerald-500" /> : null) : <Lock className="h-4 w-4" />}
                                            第 {lv.index + 1} 关
                                        </span>
                                        <span className="text-sm leading-tight text-muted-foreground">{lv.name}</span>
                                        <span className="text-sm leading-tight text-muted-foreground">{lv.pairCount} 对</span>
                                    </button>
                                )
                            })}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm font-bold text-muted-foreground">
                            <span>配对 {game.cards.filter((c) => c.matched).length / 2}/{game.level.pairCount}</span>
                            <span className="rounded-full bg-muted px-3 py-1 text-foreground">
                                {game.moves} 次翻对 · {formatTime(game.time)}
                            </span>
                        </div>
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
                                    "memory-card-scene aspect-[4/5] rounded-lg sm:aspect-square focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60",
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
                                                    ? "text-base sm:text-xl"
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
                        <div className="mt-4 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 p-4 text-center" role="status">
                            <Sparkles className="mx-auto mb-2 h-6 w-6 text-fuchsia-500" />
                            <p className="text-lg font-black">第 {game.level.index + 1} 关「{game.level.name}」通过！</p>
                            <p className="mb-2 text-sm text-muted-foreground">{game.moves} 次翻对 · {formatTime(game.time)}</p>
                            <p className="mx-auto max-w-xl rounded-md bg-background/70 p-3 text-left text-[15px] leading-relaxed text-foreground">
                                💡 {game.level.takeaway}
                            </p>
                            <div className="mt-3 flex flex-wrap justify-center gap-2">
                                <Button variant="outline" className="min-h-11" onClick={() => game.startLevel()}>
                                    再玩一次
                                </Button>
                                {game.nextLevel ? (
                                    <Button className="min-h-11" onClick={() => game.startLevel(game.nextLevel!.id)}>
                                        下一关：{game.nextLevel.name}
                                    </Button>
                                ) : (
                                    <span className="self-center text-[15px] font-bold">🎉 {currentTheme.label}主题全部通关</span>
                                )}
                            </div>
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
                        <div className="space-y-2 text-sm">
                            {currentTheme.levels.map((lv) => (
                                <div key={lv.id} className="flex justify-between rounded-sm bg-muted/30 p-3">
                                    <span>{currentTheme.label} · 第 {lv.index + 1} 关</span>
                                    <span className="font-mono">
                                        {game.stats.bestMoves[lv.id] ? `${game.stats.bestMoves[lv.id]} 次 / ${formatTime(game.stats.bestTimes[lv.id] ?? 0)}` : "暂无"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                        <h3 className="mb-2 font-bold text-foreground">怎么配对</h3>
                        <p className="leading-relaxed text-foreground">
                            紫色牌是名词，黄色牌是解释或图示。每个主题 3 关，配对数逐关增加；过关会解锁下一关，并告诉你背后的道理。
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
