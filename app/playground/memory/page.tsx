"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Brain, Check, ChevronLeft, ChevronRight, Globe, Lock, RotateCcw, Sparkles, Timer, Trophy, User } from "lucide-react"
import { useMemoryMatch } from "@/hooks/playground/use-memory-match"
import { getMemoryLevelTheme, MEMORY_LEVEL_THEMES } from "@/lib/playground/memory-levels"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
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
    const [mode, setMode] = useState<PageMode>(initialRoomCode ? "online" : "single")
    const [themeOpen, setThemeOpen] = useState(false)
    const game = useMemoryMatch()
    const currentTheme = getMemoryLevelTheme(game.level.themeId)
    const { checkBadges } = useGamification()
    const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()
    useEffect(() => {
        setTutorOverride({ subtitle: "正在玩记忆翻牌", hideFabOnMobile: true })
        return clearTutorOverride
    }, [clearTutorOverride, setTutorOverride])
    const levelIndex = game.level.index
    const canPrev = levelIndex > 0 && game.isUnlocked(currentTheme.levels[levelIndex - 1])
    const canNext = levelIndex < currentTheme.levels.length - 1 && game.isUnlocked(currentTheme.levels[levelIndex + 1])

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
            <div className="playground-game-main playground-game-center pb-10">
                <div className="w-full max-w-3xl playground-game-board !p-3 sm:!p-5">
                    <div className="mb-4 hidden items-center justify-between gap-3 sm:flex">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <Brain className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">记忆翻牌</h1>
                                <p className="text-[15px] text-muted-foreground">选主题闯关，把名词和解释配对。</p>
                            </div>
                        </div>
                        {mode === "single" ? (
                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={() => game.startLevel()} aria-label="重新开始">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>

                    <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-11 flex-1 items-center rounded-full bg-muted/50 p-1 sm:flex-none" role="group" aria-label="游戏模式">
                            {([
                                { value: "single" as const, label: "单机", icon: User },
                                { value: "online" as const, label: "在线", icon: Globe },
                            ]).map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setMode(value)}
                                    className={cn(
                                        "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition-colors sm:flex-none",
                                        mode === value ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                                    )}
                                    aria-pressed={mode === value}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                        {mode === "single" ? (
                            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full sm:hidden" onClick={() => game.startLevel()} aria-label="重新开始">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>

                    {mode === "online" ? <MemoryOnlineView initialRoomCode={initialRoomCode} /> : null}

                    <div className={cn("mb-3 space-y-3", mode === "online" && "hidden")}>
                        {/* 主题：自动换行，不横向裁切 */}
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => setThemeOpen((v) => !v)}
                                aria-expanded={themeOpen}
                                aria-controls="memory-theme-sheet"
                                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-full bg-muted/50 px-4 text-[15px] font-bold"
                            >
                                <span className="inline-flex min-w-0 items-center gap-2 truncate">
                                    <span aria-hidden>{currentTheme.emoji}</span>
                                    {currentTheme.label}
                                    <span className="font-semibold text-muted-foreground">
                                        {currentTheme.levels.filter((lv) => game.stats.clearedLevels.includes(lv.id)).length}/{currentTheme.levels.length}
                                    </span>
                                </span>
                                <span className="shrink-0 text-muted-foreground">{themeOpen ? "收起" : "换主题"}</span>
                            </button>
                            {themeOpen ? (
                                <div id="memory-theme-sheet" className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="listbox" aria-label="选择主题">
                                    {MEMORY_LEVEL_THEMES.map((t) => {
                                        const selected = game.level.themeId === t.id
                                        const done = t.levels.filter((lv) => game.stats.clearedLevels.includes(lv.id)).length
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                role="option"
                                                aria-selected={selected}
                                                onClick={() => {
                                                    const firstOpen = [...t.levels].reverse().find((lv) => game.isUnlocked(lv) && !game.stats.clearedLevels.includes(lv.id)) ?? t.levels[0]
                                                    game.startLevel(firstOpen.id)
                                                    setThemeOpen(false)
                                                }}
                                                className={cn(
                                                    "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-[15px] font-bold transition-colors",
                                                    selected ? "bg-primary text-primary-foreground shadow-xs" : "bg-background/70 text-foreground hover:bg-background",
                                                )}
                                            >
                                                <span aria-hidden>{t.emoji}</span>
                                                <span className="min-w-0 flex-1 truncate">{t.label}</span>
                                                <span className={cn("shrink-0 text-sm font-semibold", selected ? "opacity-90" : "text-muted-foreground")}>{done}/{t.levels.length}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            ) : null}
                        </div>

                        {/* 关卡步进 */}
                        <div className="flex items-center gap-2" role="group" aria-label="关卡">
                            <button
                                type="button"
                                disabled={!canPrev}
                                onClick={() => game.startLevel(currentTheme.levels[levelIndex - 1].id)}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                                aria-label="上一关"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <div className="min-w-0 flex-1 text-center">
                                <p className="text-[15px] font-black">
                                    第 {levelIndex + 1} 关
                                    <span className="mx-1 font-semibold text-muted-foreground">/</span>
                                    {currentTheme.levels.length}
                                    {game.stats.clearedLevels.includes(game.level.id) ? (
                                        <Check className="ml-1 inline h-4 w-4 text-primary" />
                                    ) : !game.isUnlocked(game.level) ? (
                                        <Lock className="ml-1 inline h-4 w-4 text-muted-foreground" />
                                    ) : null}
                                </p>
                                <p className="truncate text-[15px] font-semibold text-muted-foreground">
                                    {game.level.name} · {game.level.pairCount} 对
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={!canNext}
                                onClick={() => game.startLevel(currentTheme.levels[levelIndex + 1].id)}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                                aria-label="下一关"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[15px] font-bold">
                            <span className="text-muted-foreground">
                                配对 {game.cards.filter((c) => c.matched).length / 2}/{game.level.pairCount}
                            </span>
                            <span className="rounded-full bg-muted/70 px-3 py-1.5 text-foreground">
                                {game.moves} 次 · {formatTime(game.time)}
                            </span>
                        </div>
                    </div>

                    <div
                        className={cn("grid gap-2.5 sm:gap-3", mode === "online" && "hidden")}
                        style={{ gridTemplateColumns: `repeat(${game.columns}, minmax(0, 1fr))` }}
                    >
                        {game.cards.map((card) => (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => game.flipCard(card.id)}
                                data-symbol={card.symbol}
                                disabled={card.open || game.status === "won"}
                                aria-label={card.open ? (card.face === "term" ? `名词 ${card.label}` : `解释 ${card.label}`) : "未翻开的牌"}
                                className={cn(
                                    "memory-card-scene aspect-[4/5] rounded-xl sm:aspect-square focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                    card.matched && "memory-card-matched",
                                )}
                            >
                                <div className={cn("memory-card-face relative h-full w-full", card.open && "memory-card-face-open")}>
                                    {/* 背面 */}
                                    <div
                                        className={cn(
                                            "memory-card-side absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl",
                                            "bg-gradient-to-br from-primary/90 to-primary shadow-[0_8px_20px_-10px_hsl(var(--primary)/0.55)]",
                                            "dark:from-primary/80 dark:to-primary/60",
                                        )}
                                    >
                                        <div
                                            className="absolute inset-0 opacity-25"
                                            style={{
                                                backgroundImage:
                                                    "radial-gradient(circle at 28% 28%, white 0 1.4px, transparent 2px), radial-gradient(circle at 72% 68%, white 0 1px, transparent 1.6px)",
                                                backgroundSize: "16px 16px, 20px 20px",
                                            }}
                                        />
                                        <Brain className="relative h-[30%] w-[30%] text-primary-foreground/90 drop-shadow-sm" />
                                    </div>
                                    {/* 正面 */}
                                    <div
                                        className={cn(
                                            "memory-card-side memory-card-front absolute inset-0 flex items-center justify-center rounded-xl p-2 shadow-[0_8px_18px_-12px_hsl(var(--surface-shadow)/0.5)] sm:p-2.5",
                                            card.matched
                                                ? "bg-primary/10 ring-2 ring-primary/35"
                                                : "bg-card ring-1 ring-border/60",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "select-none text-center font-black leading-snug text-foreground",
                                                card.face === "term" ? "text-base sm:text-xl" : "text-sm sm:text-[15px]",
                                            )}
                                        >
                                            {card.label}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {mode === "single" && game.status === "won" ? (
                        <div
                            className="mt-4 mb-8 rounded-2xl bg-muted/40 p-4 text-center sm:p-5"
                            role="status"
                        >
                            <Sparkles className="mx-auto mb-1.5 h-6 w-6 text-primary" />
                            <p className="text-lg font-black">第 {game.level.index + 1} 关「{game.level.name}」通过！</p>
                            <p className="mb-2 text-[15px] text-muted-foreground">{game.moves} 次翻对 · {formatTime(game.time)}</p>
                            <p className="mx-auto mb-3 max-w-xl text-left text-[15px] leading-relaxed text-foreground">
                                💡 {game.level.takeaway}
                            </p>
                            <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
                                <Button variant="outline" className="min-h-11 w-full rounded-full" onClick={() => game.startLevel()}>
                                    再玩一次
                                </Button>
                                {game.nextLevel ? (
                                    <Button className="min-h-11 w-full rounded-full" onClick={() => game.startLevel(game.nextLevel!.id)}>
                                        下一关：{game.nextLevel.name}
                                    </Button>
                                ) : (
                                    <span className="self-center text-[15px] font-bold">🎉 {currentTheme.label}主题全部通关</span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-primary" />
                            最佳记录
                        </h2>
                        <div className="space-y-2 text-[15px]">
                            {currentTheme.levels.map((lv) => (
                                <div key={lv.id} className="flex justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                                    <span>第 {lv.index + 1} 关</span>
                                    <span className="font-mono">
                                        {game.stats.bestMoves[lv.id] ? `${game.stats.bestMoves[lv.id]} 次 / ${formatTime(game.stats.bestTimes[lv.id] ?? 0)}` : "暂无"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section className="rounded-xl bg-muted/30 p-4 text-[15px]">
                        <h3 className="mb-2 font-bold">怎么配对</h3>
                        <p className="leading-relaxed text-foreground">
                            翻开两张：一张是名词，一张是解释。每个主题 3 关，配对数逐关增加；过关解锁下一关，并告诉你背后的道理。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-xl bg-muted/30 p-4 text-[15px] text-foreground">
                        <Timer className="h-4 w-4 shrink-0 text-primary" />
                        <span>先记住名词位置，再翻解释去对，比乱翻更省步数。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
