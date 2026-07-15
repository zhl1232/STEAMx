"use client"

import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { Beaker, Check, Clock, RotateCcw, Sparkles, Trophy } from "lucide-react"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { BALL_SORT_LEVELS, canPour, getTopRun, useBallSort } from "@/hooks/playground/use-ball-sort"
import { useRaceOnline } from "@/hooks/playground/use-race-online"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { RaceOnlinePanel } from "@/components/features/playground/race-online-panel"
import { cn } from "@/lib/utils"

type BallPalette = {
    label: string
    base: string
    dark: string
    shine: string
    ring: string
}

const BALL_PALETTE: Record<number, BallPalette> = {
    1: {
        label: "莓红",
        base: "oklch(0.62 0.22 25)",
        dark: "oklch(0.45 0.2 25)",
        shine: "oklch(0.86 0.09 18)",
        ring: "oklch(0.75 0.18 25 / 0.62)",
    },
    2: {
        label: "天蓝",
        base: "oklch(0.66 0.16 235)",
        dark: "oklch(0.48 0.16 245)",
        shine: "oklch(0.88 0.08 220)",
        ring: "oklch(0.75 0.14 235 / 0.62)",
    },
    3: {
        label: "琥珀",
        base: "oklch(0.78 0.16 82)",
        dark: "oklch(0.56 0.13 72)",
        shine: "oklch(0.94 0.07 92)",
        ring: "oklch(0.82 0.14 82 / 0.62)",
    },
    4: {
        label: "松绿",
        base: "oklch(0.67 0.17 154)",
        dark: "oklch(0.47 0.14 158)",
        shine: "oklch(0.9 0.08 150)",
        ring: "oklch(0.76 0.13 154 / 0.62)",
    },
    5: {
        label: "鸢紫",
        base: "oklch(0.61 0.19 294)",
        dark: "oklch(0.43 0.17 294)",
        shine: "oklch(0.86 0.09 300)",
        ring: "oklch(0.72 0.15 294 / 0.62)",
    },
    6: {
        label: "珊瑚",
        base: "oklch(0.69 0.19 45)",
        dark: "oklch(0.49 0.16 42)",
        shine: "oklch(0.9 0.08 58)",
        ring: "oklch(0.78 0.15 45 / 0.62)",
    },
    7: {
        label: "薄荷",
        base: "oklch(0.72 0.13 178)",
        dark: "oklch(0.5 0.11 180)",
        shine: "oklch(0.92 0.06 168)",
        ring: "oklch(0.79 0.11 178 / 0.62)",
    },
    8: {
        label: "靛青",
        base: "oklch(0.57 0.18 264)",
        dark: "oklch(0.39 0.15 268)",
        shine: "oklch(0.84 0.08 252)",
        ring: "oklch(0.68 0.14 264 / 0.62)",
    },
}

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function getBallPalette(color: number) {
    return BALL_PALETTE[color] ?? BALL_PALETTE[1]
}

function getBallStyle(color: number, extra?: CSSProperties): CSSProperties {
    const palette = getBallPalette(color)
    return {
        "--ball": palette.base,
        "--ball-dark": palette.dark,
        "--ball-shine": palette.shine,
        "--ball-ring": palette.ring,
        ...extra,
    } as CSSProperties
}

function getTubeAccentStyle(color: number | null): CSSProperties {
    const palette = color ? getBallPalette(color) : null
    return {
        "--tube-accent": palette?.base ?? "oklch(0.62 0.13 224)",
    } as CSSProperties
}

function isPureFullTube(tube: number[], capacity: number) {
    return tube.length === capacity && tube.every((color) => color === tube[0])
}

function describeTube(tube: number[], index: number, capacity: number, state: string) {
    const content = tube.length > 0
        ? `从下到上 ${tube.map((color) => getBallPalette(color).label).join("、")}`
        : "空管"
    return `试管 ${index + 1}，${content}，${tube.length}/${capacity}${state ? `，${state}` : ""}`
}

export default function BallSortPage() {
    const game = useBallSort()
    const race = useRaceOnline("ballsort", { levelId: game.level.id, levelIndex: game.levelIndex })
    const raceIsWaiting = race.isWaiting
    const raceIsPlaying = race.isPlaying
    const raceHasSubmitted = race.hasSubmitted
    const raceLevelId = race.settings.levelId
    const submitRaceResult = race.submitResult
    const { checkBadges } = useGamification()
    const {
        setOverride: setTutorOverride,
        clearOverride: clearTutorOverride,
    } = useTutorContext()
    const prevStatusRef = useRef(game.status)
    const selectedRun = useMemo(
        () => (game.selected == null ? null : getTopRun(game.tubes[game.selected] ?? [])),
        [game.selected, game.tubes],
    )
    const availableTargets = useMemo(() => {
        if (game.selected == null) return game.tubes.map(() => false)
        const from = game.tubes[game.selected] ?? []
        return game.tubes.map((tube, index) => index !== game.selected && canPour(from, tube, game.level.capacity))
    }, [game.level.capacity, game.selected, game.tubes])
    const completedTubes = useMemo(
        () => game.tubes.filter((tube) => isPureFullTube(tube, game.level.capacity)).length,
        [game.level.capacity, game.tubes],
    )
    const targetTubes = useMemo(() => new Set(game.level.tubes.flat()).size, [game.level])
    const statusLine = game.invalidFeedback
        ? "这根试管不能接住当前颜色，换一根同色或空管。"
        : selectedRun
          ? `已拿起 ${selectedRun.count} 颗${getBallPalette(selectedRun.color).label}球。`
          : game.level.hint
    const tubeHeight = game.level.capacity * 38 + 48

    useEffect(() => {
        setTutorOverride({
            subtitle: "正在看球排序关卡",
            quickPrompts: ["球排序怎么玩？", "为什么不能倒？", "复杂关怎么规划？"],
            hideFabOnMobile: true,
        })
        return clearTutorOverride
    }, [clearTutorOverride, setTutorOverride])

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

    const raceLevelIndex = typeof race.settings.levelIndex === "number" ? race.settings.levelIndex : null
    const raceActive = raceIsWaiting || raceIsPlaying

    useEffect(() => {
        if (!raceActive || raceLevelIndex === null || raceLevelIndex === game.levelIndex) return
        game.startLevel(raceLevelIndex)
    }, [game, raceActive, raceLevelIndex])

    useEffect(() => {
        const justSolved = prevStatusRef.current === "playing" && game.status === "solved"
        prevStatusRef.current = game.status
        if (!justSolved || !raceIsPlaying || raceHasSubmitted) return
        if (raceLevelId !== game.level.id) return
        void submitRaceResult({
            levelId: game.level.id,
            levelIndex: game.levelIndex,
            moves: game.moves,
            timeSeconds: game.time,
        })
    }, [
        game.level.id,
        game.levelIndex,
        game.moves,
        game.status,
        game.time,
        raceHasSubmitted,
        raceIsPlaying,
        raceLevelId,
        submitRaceResult,
    ])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main justify-start py-3 sm:py-6 xl:py-8">
                <div className="w-full max-w-4xl playground-game-board !p-3 sm:!p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-sky-400/45 bg-sky-500/10">
                                <Beaker className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-lg font-black sm:text-xl">球排序 · {game.level.name}</h1>
                                <p className="text-[11px] text-muted-foreground sm:text-xs">
                                    同色连续倒入 · 空管中转 · 管满纯色通关
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 text-xs font-bold">
                                {game.moves} 步
                            </span>
                            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-muted px-3 font-mono text-xs font-bold tabular-nums">
                                <Clock className="h-3.5 w-3.5" />
                                {formatTime(game.time)}
                            </span>
                            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-emerald-500/10 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                <Check className="h-3.5 w-3.5" />
                                {completedTubes}/{targetTubes}
                            </span>
                            <Button variant="outline" size="icon" className="h-11 w-11" onClick={game.reset} aria-label="重开">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
                        {BALL_SORT_LEVELS.map((level, index) => {
                            const active = game.levelIndex === index
                            const solved = game.stats.solvedLevels.includes(level.id)
                            return (
                                <button
                                    key={level.id}
                                    type="button"
                                    onClick={() => game.startLevel(index)}
                                    className={cn(
                                        "min-h-10 shrink-0 rounded-sm border px-3 text-left text-xs font-bold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98]",
                                        active
                                            ? "border-sky-700 bg-sky-800 text-white dark:border-sky-200 dark:bg-sky-100 dark:text-sky-950"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                    aria-pressed={active}
                                >
                                    {level.name}
                                    {solved ? <Check className="ml-1 inline h-3 w-3 text-emerald-400" /> : null}
                                </button>
                            )
                        })}
                    </div>

                    <RaceOnlinePanel className="mb-4 xl:hidden" online={race} gamePath="/playground/ballsort" />

                    <div
                        className={cn(
                            "mb-4 flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs transition-colors",
                            game.invalidFeedback
                                ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200"
                                : selectedRun
                                  ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-400/35 dark:bg-sky-500/10 dark:text-sky-200"
                                  : "border-border bg-muted/40 text-muted-foreground",
                        )}
                    >
                        <span className="min-w-0 leading-5">{statusLine}</span>
                        {selectedRun ? (
                            <span
                                className="ball-sort-ball h-7 w-7 shrink-0 rounded-full"
                                style={getBallStyle(selectedRun.color)}
                                aria-hidden
                            />
                        ) : null}
                    </div>

                    <div className="relative overflow-hidden rounded-md border border-slate-200/80 bg-[linear-gradient(180deg,oklch(0.985_0.012_92),oklch(0.948_0.022_72))] px-3 py-5 shadow-inner dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,oklch(0.22_0.018_232),oklch(0.165_0.015_236))] sm:px-5">
                        <div
                            aria-hidden
                            className="absolute inset-x-0 bottom-0 h-10 bg-[repeating-linear-gradient(90deg,oklch(0.72_0.035_72_/_0.22)_0,oklch(0.72_0.035_72_/_0.22)_1px,transparent_1px,transparent_42px)] dark:bg-[repeating-linear-gradient(90deg,oklch(0.55_0.025_232_/_0.18)_0,oklch(0.55_0.025_232_/_0.18)_1px,transparent_1px,transparent_42px)]"
                        />
                        <div className="relative z-10 flex flex-wrap items-end justify-center gap-x-3 gap-y-5 sm:gap-x-4">
                            {game.tubes.map((tube, index) => {
                                const selected = game.selected === index
                                const validTarget = availableTargets[index]
                                const invalid = game.invalidFeedback?.index === index
                                const lastMove = game.moveFeedback
                                const sourceMoving = lastMove?.from === index
                                const targetReceiving = lastMove?.to === index
                                const pureFull = isPureFullTube(tube, game.level.capacity)
                                const selectedTopStart = selected && selectedRun ? tube.length - selectedRun.count : Infinity
                                const state = selected
                                    ? "已选中"
                                    : validTarget
                                      ? "可以倒入"
                                      : pureFull
                                        ? "已完成"
                                        : ""
                                const motionKey = [
                                    index,
                                    sourceMoving ? lastMove?.key : 0,
                                    invalid ? game.invalidFeedback?.key : 0,
                                ].join("-")

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => game.selectTube(index)}
                                        disabled={game.status === "solved"}
                                        aria-label={describeTube(tube, index, game.level.capacity, state)}
                                        aria-pressed={selected}
                                        className="group relative flex shrink-0 flex-col items-center outline-none disabled:cursor-default"
                                    >
                                        <div
                                            key={motionKey}
                                            className={cn(
                                                "relative flex w-[4.15rem] flex-col items-center transition-transform duration-200 ease-out sm:w-[4.55rem]",
                                                selected && "-translate-y-2",
                                                sourceMoving && "ball-sort-tube-pour",
                                                invalid && "ball-sort-invalid-shake",
                                            )}
                                        >
                                            <span
                                                aria-hidden
                                                className={cn(
                                                    "absolute -top-1.5 z-20 h-3 w-[calc(100%+0.42rem)] rounded-full border bg-white/75 shadow-sm backdrop-blur-sm transition-colors dark:bg-slate-800/85",
                                                    selected
                                                        ? "border-sky-400"
                                                        : validTarget
                                                          ? "border-emerald-400"
                                                          : "border-slate-300/90 dark:border-slate-600",
                                                )}
                                            />
                                            <div
                                                className={cn(
                                                    "relative flex w-full flex-col justify-end rounded-b-[2rem] rounded-t-sm border-2 border-t bg-white/52 px-1.5 pb-2 pt-5 shadow-[inset_0_2px_10px_oklch(1_0_0_/_0.62),inset_0_-12px_18px_oklch(0.64_0.03_225_/_0.13)] backdrop-blur-sm transition-[border-color,background-color,box-shadow,transform] duration-200 dark:bg-slate-900/42 dark:shadow-[inset_0_2px_10px_oklch(1_0_0_/_0.08),inset_0_-12px_18px_oklch(0.02_0_0_/_0.32)]",
                                                    selected
                                                        ? "border-sky-500 bg-sky-50/55 shadow-[0_16px_28px_-22px_oklch(0.55_0.15_235_/_0.95),inset_0_2px_10px_oklch(1_0_0_/_0.72)]"
                                                        : validTarget
                                                          ? "border-emerald-500 bg-emerald-50/60"
                                                          : invalid
                                                            ? "border-rose-400 bg-rose-50/70 dark:bg-rose-500/10"
                                                            : pureFull
                                                              ? "border-emerald-400/85 bg-emerald-50/55 dark:bg-emerald-500/10"
                                                              : "border-slate-300/90 dark:border-slate-600/90",
                                                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-sky-500",
                                                )}
                                                style={{
                                                    minHeight: `${tubeHeight}px`,
                                                    ...getTubeAccentStyle(selectedRun?.color ?? null),
                                                }}
                                            >
                                                {targetReceiving ? (
                                                    <span
                                                        key={`stream-${lastMove.key}`}
                                                        aria-hidden
                                                        className="ball-sort-pour-stream"
                                                        style={getBallStyle(lastMove.color)}
                                                    />
                                                ) : null}
                                                <div className="relative z-10 flex flex-col-reverse gap-1.5">
                                                    {Array.from({ length: game.level.capacity }).map((_, slot) => {
                                                        const color = tube[slot]
                                                        const incoming = Boolean(
                                                            color &&
                                                            targetReceiving &&
                                                            lastMove &&
                                                            color === lastMove.color &&
                                                            slot >= tube.length - lastMove.count,
                                                        )
                                                        const incomingIndex = lastMove ? slot - (tube.length - lastMove.count) : 0
                                                        const selectedTop = Boolean(color && selected && slot >= selectedTopStart)
                                                        return (
                                                            <div key={slot} className="grid h-8 place-items-center sm:h-9">
                                                                {color ? (
                                                                    <span
                                                                        key={`${slot}-${color}-${incoming ? lastMove?.key : "steady"}`}
                                                                        className={cn(
                                                                            "ball-sort-ball h-8 w-8 rounded-full transition-transform duration-200 sm:h-9 sm:w-9",
                                                                            incoming && "ball-sort-ball-drop",
                                                                            selectedTop && "-translate-y-1",
                                                                            pureFull && "ball-sort-victory-glow",
                                                                        )}
                                                                        style={getBallStyle(
                                                                            color,
                                                                            incoming
                                                                                ? { animationDelay: `${Math.max(0, incomingIndex) * 68}ms` }
                                                                                : undefined,
                                                                        )}
                                                                    />
                                                                ) : (
                                                                    <span
                                                                        className={cn(
                                                                            "h-8 w-8 rounded-full border border-dashed border-slate-300/65 bg-white/22 opacity-45 transition-opacity sm:h-9 sm:w-9 dark:border-slate-600 dark:bg-slate-800/20",
                                                                            selected && "opacity-70",
                                                                            validTarget && "border-emerald-400/70 bg-emerald-100/35 opacity-80",
                                                                        )}
                                                                        aria-hidden
                                                                    />
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                        <span
                                            className={cn(
                                                "mt-2 inline-flex h-6 min-w-10 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-black transition-colors",
                                                pureFull
                                                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                                    : selected
                                                      ? "bg-sky-500/12 text-sky-700 dark:text-sky-300"
                                                      : validTarget
                                                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                                        : "bg-muted text-muted-foreground",
                                            )}
                                        >
                                            {pureFull ? (
                                                <>
                                                    <Check className="h-3 w-3" />
                                                    完成
                                                </>
                                            ) : validTarget ? (
                                                "可倒"
                                            ) : (
                                                `#${index + 1}`
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {game.status === "solved" ? (
                        <div className="relative mt-4 overflow-hidden rounded-md border border-emerald-400/35 bg-emerald-50/80 p-4 dark:bg-emerald-950/22">
                            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3 text-left">
                                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_8px_20px_-10px_rgba(16,185,129,0.9)]">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                                            排序完成
                                        </p>
                                        <p className="truncate text-base font-black text-foreground">
                                            {game.level.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {game.moves} 步 · {formatTime(game.time)}
                                        </p>
                                    </div>
                                </div>
                                {game.levelIndex < game.levelCount - 1 ? (
                                    <Button
                                        className="w-full shrink-0 sm:w-auto"
                                        size="sm"
                                        onClick={() => game.startLevel(game.levelIndex + 1)}
                                    >
                                        下一关
                                    </Button>
                                ) : (
                                    <span className="self-start rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 sm:self-auto">
                                        全部完成
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="hidden w-full border-t border-border bg-card/50 p-5 xl:block xl:w-80 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <RaceOnlinePanel online={race} gamePath="/playground/ballsort" />
                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-sky-500" />
                            最佳记录
                        </h2>
                        <div className="space-y-2 text-xs">
                            {BALL_SORT_LEVELS.map((level) => {
                                const bestMoves = game.stats.bestMoves[level.id]
                                const bestTime = game.stats.bestTimes[level.id]
                                return (
                                    <div
                                        key={level.id}
                                        className="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2"
                                    >
                                        <span className="min-w-0 truncate font-medium">{level.name}</span>
                                        <span className="shrink-0 text-right font-bold tabular-nums">
                                            {bestMoves != null ? `${bestMoves} 步` : "-"}
                                            {bestTime != null ? (
                                                <span className="ml-1 text-muted-foreground">{formatTime(bestTime)}</span>
                                            ) : null}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                    <p className="text-xs leading-5 text-muted-foreground">
                        顶部连续同色会一起移动；目标管必须为空，或顶部颜色相同且仍有空间。
                    </p>
                </div>
            </aside>
        </div>
    )
}
