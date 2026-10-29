"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Brain, Check, ChevronDown, Globe, Lock, RotateCcw, Sparkles, Timer, Trophy, User, X } from "lucide-react"
import { useMemoryMatch } from "@/hooks/playground/use-memory-match"
import { getMemoryLevelTheme, MEMORY_LEVEL_THEMES } from "@/lib/playground/memory-levels"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { MemoryOnlineView } from "@/components/features/playground/memory-online-view"
import { ChallengeOnlineView } from "@/components/features/playground/challenge-online-view"

type PageMode = "single" | "online"

/** 配对成功后两张牌共用的柔和色（同一对同色） */
const PAIR_TONES = [
    "bg-emerald-100 text-emerald-950 dark:bg-emerald-500/25 dark:text-emerald-50",
    "bg-amber-100 text-amber-950 dark:bg-amber-500/25 dark:text-amber-50",
    "bg-rose-100 text-rose-950 dark:bg-rose-500/25 dark:text-rose-50",
    "bg-violet-100 text-violet-950 dark:bg-violet-500/25 dark:text-violet-50",
    "bg-sky-100 text-sky-950 dark:bg-sky-500/25 dark:text-sky-50",
    "bg-lime-100 text-lime-950 dark:bg-lime-500/25 dark:text-lime-50",
    "bg-orange-100 text-orange-950 dark:bg-orange-500/25 dark:text-orange-50",
    "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-500/25 dark:text-fuchsia-50",
]

function splitEmoji(label: string): { icon: string | null; text: string } {
    const m = label.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u)
    return m ? { icon: m[1], text: label.slice(m[0].length) } : { icon: null, text: label }
}

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
    const [legacyOnline, setLegacyOnline] = useState(false)
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
    const [pickerThemeId, setPickerThemeId] = useState(game.level.themeId)
    const pickerTheme = getMemoryLevelTheme(pickerThemeId)
    const matchedPairs = game.cards.filter((c) => c.matched).length / 2
    const symbolOrder = new Map(currentTheme.pairs.map((pair, i) => [pair.key, i]))

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
                <div className="w-full max-w-3xl playground-game-board !p-3 sm:min-w-[600px] sm:!p-5">
                    <div className="mb-4 hidden items-center justify-between gap-3 sm:flex">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                                <Brain className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">记忆翻牌</h1>
                                <p className="text-[15px] text-muted-foreground">{mode === "online" ? "同时翻自己的牌，先配完者获胜。" : "选主题闯关，把名词和解释配对。"}</p>
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

                    {mode === "online" ? legacyOnline ? <MemoryOnlineView initialRoomCode={initialRoomCode} /> : <ChallengeOnlineView game="memory" initialRoomCode={initialRoomCode} onLegacyRoom={() => setLegacyOnline(true)} /> : null}

                    <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1", mode === "online" && "hidden")}>
                        <button
                            type="button"
                            onClick={() => { setPickerThemeId(game.level.themeId); setThemeOpen(true) }}
                            aria-haspopup="dialog"
                            className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-full py-1 pr-2 text-left text-base font-black hover:text-primary"
                        >
                            <span aria-hidden className="text-lg">{currentTheme.emoji}</span>
                            <span className="truncate">
                                {currentTheme.label}
                                <span className="mx-1.5 text-muted-foreground">·</span>
                                第 {levelIndex + 1}/{currentTheme.levels.length} 关
                                <span className="ml-1.5 font-bold text-muted-foreground">{game.level.name}</span>
                            </span>
                            {game.stats.clearedLevels.includes(game.level.id) ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                        </button>
                        <span className="text-[15px] font-semibold text-muted-foreground tabular-nums">
                            配对 {matchedPairs}/{game.level.pairCount} · {game.moves} 步 · {formatTime(game.time)}
                        </span>
                    </div>

                    <div
                        className={cn(
                            "grid gap-3 sm:grid-cols-4",
                            game.level.pairCount > 6 ? "grid-cols-3" : "grid-cols-2",
                            mode === "online" && "hidden",
                        )}
                    >
                        {game.cards.map((card) => {
                            const tone = PAIR_TONES[(symbolOrder.get(card.symbol) ?? 0) % PAIR_TONES.length]
                            const { icon, text } = splitEmoji(card.label)
                            const dense = game.level.pairCount > 6
                            return (
                            <button
                                key={card.id}
                                type="button"
                                onClick={() => game.flipCard(card.id)}
                                data-symbol={card.symbol}
                                disabled={card.open || game.status === "won"}
                                aria-label={card.open ? (card.face === "term" ? `名词 ${card.label}` : `解释 ${card.label}`) : "未翻开的牌"}
                                className={cn(
                                    "memory-card-scene rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                    dense ? "aspect-[4/5]" : "aspect-[4/3]",
                                    "sm:aspect-[5/4]",
                                    card.matched && "memory-card-matched",
                                )}
                            >
                                <div className={cn("memory-card-face relative h-full w-full", card.open && "memory-card-face-open")}>
                                    {/* 背面 */}
                                    <div className="memory-card-side absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl bg-primary shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.6)]">
                                        <div
                                            className="absolute inset-0 opacity-[0.18]"
                                            style={{
                                                backgroundImage: "radial-gradient(circle, white 1.2px, transparent 1.6px)",
                                                backgroundSize: "14px 14px",
                                            }}
                                        />
                                        <div className="absolute inset-2 rounded-xl border-2 border-white/25" />
                                        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                                            <Sparkles className="h-5 w-5 text-white" />
                                        </span>
                                    </div>
                                    {/* 正面 */}
                                    <div
                                        className={cn(
                                            "memory-card-side memory-card-front absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl p-2.5 text-center transition-opacity",
                                            card.matched
                                                ? cn(tone, "opacity-90")
                                                : card.face === "term"
                                                    ? "bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_hsl(var(--primary)/0.6)]"
                                                    : "bg-card text-foreground shadow-[0_6px_18px_-8px_rgb(0_0_0/0.25)] dark:bg-zinc-800",
                                        )}
                                    >
                                        {card.matched ? (
                                            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 dark:bg-black/30">
                                                <Check className="h-4 w-4" strokeWidth={3} />
                                            </span>
                                        ) : null}
                                        {card.face === "def" ? (
                                            <span aria-hidden className={cn("leading-none", dense ? "text-xl" : "text-2xl")}>{icon ?? "💡"}</span>
                                        ) : null}
                                        <span
                                            className={cn(
                                                "select-none font-black leading-snug [word-break:keep-all] [text-wrap:balance]",
                                                card.face === "term"
                                                    ? dense ? "text-[15px] sm:text-[17px]" : "text-lg sm:text-[17px]"
                                                    : dense ? "text-[15px] font-bold" : "text-base font-bold sm:text-[15px]",
                                            )}
                                        >
                                            {text}
                                        </span>
                                    </div>
                                </div>
                            </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            <aside className={cn("w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0", mode === "online" && "hidden")}>
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
            {themeOpen ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onClick={() => setThemeOpen(false)}>
                    <div
                        role="dialog"
                        aria-label="选择主题和关卡"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md rounded-t-3xl bg-background p-5 pb-8 shadow-2xl sm:rounded-3xl sm:pb-5"
                    >
                        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted sm:hidden" />
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-lg font-black">选主题和关卡</h2>
                            <button type="button" onClick={() => setThemeOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-muted" aria-label="关闭">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="mb-4 grid grid-cols-3 gap-2">
                            {MEMORY_LEVEL_THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setPickerThemeId(t.id)}
                                    aria-pressed={pickerTheme.id === t.id}
                                    className={cn(
                                        "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl text-[15px] font-bold transition-colors",
                                        pickerTheme.id === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                                    )}
                                >
                                    <span aria-hidden className="text-xl">{t.emoji}</span>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="space-y-2">
                            {pickerTheme.levels.map((lv) => {
                                const unlocked = game.isUnlocked(lv)
                                const cleared = game.stats.clearedLevels.includes(lv.id)
                                const current = lv.id === game.level.id
                                return (
                                    <button
                                        key={lv.id}
                                        type="button"
                                        disabled={!unlocked}
                                        onClick={() => { game.startLevel(lv.id); setThemeOpen(false) }}
                                        className={cn(
                                            "flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-bold transition-colors disabled:opacity-50",
                                            current ? "bg-primary/12 text-primary ring-2 ring-primary/40" : "bg-muted/70 text-foreground",
                                        )}
                                    >
                                        <span className="w-14 shrink-0">第 {lv.index + 1} 关</span>
                                        <span className="min-w-0 flex-1 truncate">{lv.name}</span>
                                        <span className="shrink-0 text-[15px] font-semibold text-muted-foreground">{lv.pairCount} 对</span>
                                        {cleared ? <Check className="h-5 w-5 shrink-0 text-primary" /> : !unlocked ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ) : null}

            {mode === "single" && game.status === "won" ? (
                <div className="memory-win-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center">
                    <div role="dialog" aria-label="过关" className="memory-win-sheet w-full max-w-md rounded-t-3xl bg-background p-6 pb-8 text-center shadow-2xl sm:rounded-3xl">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/12 text-3xl">🎉</div>
                        <p className="text-xl font-black">第 {game.level.index + 1} 关「{game.level.name}」通过！</p>
                        <p className="mt-1 text-[15px] font-semibold text-muted-foreground">{game.moves} 步 · {formatTime(game.time)}</p>
                        <p className="mx-auto mt-3 rounded-2xl bg-muted/60 px-4 py-3 text-left text-base leading-relaxed text-foreground">
                            💡 {game.level.takeaway}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <Button variant="outline" className="min-h-12 rounded-2xl text-base font-bold" onClick={() => game.startLevel()}>
                                再玩一次
                            </Button>
                            {game.nextLevel ? (
                                <Button className="min-h-12 rounded-2xl text-base font-bold" onClick={() => game.startLevel(game.nextLevel!.id)}>
                                    下一关
                                </Button>
                            ) : (
                                <Button className="min-h-12 rounded-2xl text-base font-bold" onClick={() => { setPickerThemeId(game.level.themeId); setThemeOpen(true) }}>
                                    换个主题
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
