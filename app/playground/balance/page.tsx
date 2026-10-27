"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowLeftRight, Check, ChevronLeft, ChevronRight, Clock, Coins, RotateCcw, Scale, Sparkles, Trophy } from "lucide-react"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { BALANCE_LEVELS, useBalance, type WeighResult } from "@/hooks/playground/use-balance"
import { useRaceOnline } from "@/hooks/playground/use-race-online"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { DensityMode, LeverMode } from "@/components/features/playground/balance-physics-modes"
import { RaceOnlineDisclosure, RaceOnlinePanel } from "@/components/features/playground/race-online-panel"
import { cn } from "@/lib/utils"

type PanSide = "left" | "right"

const PAN_META: Record<PanSide, {
    label: string
    shortLabel: string
    color: string
    active: string
    disc: string
    tray: string
    badge: string
}> = {
    left: {
        label: "左盘",
        shortLabel: "左",
        color: "text-primary",
        active: "bg-primary text-primary-foreground shadow-xs",
        disc: "border-primary/40 bg-primary/15 text-foreground shadow-[0_8px_18px_-14px_hsl(var(--primary)/0.55)]",
        tray: "bg-primary/10 ring-2 ring-primary/35",
        badge: "bg-primary text-primary-foreground",
    },
    right: {
        label: "右盘",
        shortLabel: "右",
        color: "text-foreground",
        active: "bg-foreground text-background shadow-xs",
        disc: "border-foreground/25 bg-muted text-foreground shadow-[0_8px_18px_-14px_hsl(var(--surface-shadow)/0.45)]",
        tray: "bg-muted/80 ring-2 ring-foreground/20",
        badge: "bg-foreground text-background",
    },
}

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function formatResult(result: WeighResult | null) {
    if (result === "equal") return "平衡"
    if (result === "left") return "左边更重"
    if (result === "right") return "右边更重"
    return "等待称量"
}

function getBeamTilt(result: WeighResult | null) {
    if (result === "left") return "-rotate-[9deg]"
    if (result === "right") return "rotate-[9deg]"
    return "rotate-0"
}

function getBeamTiltVar(result: WeighResult | null) {
    if (result === "left") return "-9deg"
    if (result === "right") return "9deg"
    return "0deg"
}

function getPanShift(side: PanSide, result: WeighResult | null) {
    if (!result || result === "equal") return "translate-y-0"
    if (result === side) return "translate-y-5"
    return "-translate-y-4"
}

function getPanStatusText(leftCount: number, rightCount: number, weighings: number, maxWeighings: number) {
    if (weighings >= maxWeighings) return "称量次数已用完，请直接指认假币"
    if (leftCount === 0 && rightCount === 0) return "先把硬币放到左右盘"
    if (leftCount !== rightCount) return `左右数量需相同：左 ${leftCount} / 右 ${rightCount}`
    return `左右各 ${leftCount} 枚，可以称量`
}

function BalanceCoin({
    coin,
    side,
    selected,
    disabled,
    onClick,
    label,
}: {
    coin: number
    side?: PanSide | null
    selected?: boolean
    disabled?: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
            className={cn(
                "balance-coin-pop group relative grid h-12 w-12 shrink-0 place-items-center rounded-full border text-sm font-black tabular-nums transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-55 sm:h-[3.25rem] sm:w-[3.25rem]",
                side ? PAN_META[side].disc : "border-slate-300 bg-white text-slate-800 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.7)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100",
                selected && "ring-2 ring-primary/45 ring-offset-2 ring-offset-background",
                !disabled && "active:scale-[0.96] motion-safe:hover:-translate-y-0.5",
            )}
        >
            <span
                aria-hidden
                className="absolute inset-1.5 rounded-full bg-[radial-gradient(circle_at_32%_25%,rgba(255,255,255,0.82),rgba(255,255,255,0)_42%),linear-gradient(145deg,rgba(255,255,255,0.36),rgba(255,255,255,0)_68%)]"
            />
            <span className="relative">{coin + 1}</span>
            {side ? (
                <span
                    className={cn(
                        "absolute -bottom-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-black shadow-sm",
                        PAN_META[side].badge,
                    )}
                >
                    {PAN_META[side].shortLabel}
                </span>
            ) : null}
        </button>
    )
}

function PanTray({
    side,
    coins,
    selectedPan,
    result,
    disabled,
    onSelect,
    onRemove,
}: {
    side: PanSide
    coins: number[]
    selectedPan: PanSide
    result: WeighResult | null
    disabled: boolean
    onSelect: (side: PanSide) => void
    onRemove: (coin: number, side: PanSide) => void
}) {
    const active = selectedPan === side
    const meta = PAN_META[side]

    return (
        <div className={cn("absolute top-[6.5rem] w-[43%] transition-transform duration-300", side === "left" ? "left-0" : "right-0", getPanShift(side, result))}>
            <button
                type="button"
                onClick={() => onSelect(side)}
                disabled={disabled}
                className={cn(
                    "mb-2 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-black transition-colors disabled:cursor-default disabled:opacity-70",
                    active ? meta.active : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-pressed={active}
            >
                {active ? <Check className="h-3.5 w-3.5" /> : null}
                放入{meta.label}
            </button>
            <div
                className={cn(
                    "balance-stage-settle min-h-[7.25rem] rounded-2xl p-2 transition-[background-color,box-shadow] sm:min-h-[8rem] sm:p-3",
                    active ? meta.tray : "bg-muted/40",
                )}
            >
                <div className="flex min-h-[5.5rem] flex-wrap content-start justify-center gap-1.5 sm:gap-2">
                    {coins.length > 0 ? (
                        coins.map((coin) => (
                            <BalanceCoin
                                key={`${side}-${coin}`}
                                coin={coin}
                                side={side}
                                disabled={disabled}
                                onClick={() => onRemove(coin, side)}
                                label={`从${meta.label}移除 ${coin + 1} 号硬币`}
                            />
                        ))
                    ) : (
                        <span className="grid min-h-[5.5rem] place-items-center text-center text-sm font-semibold leading-5 text-muted-foreground">
                            {active ? "点击下方硬币放入这里" : "空盘"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

function CoinMode({ modeTabs }: { modeTabs: React.ReactNode }) {
    const game = useBalance()
    const race = useRaceOnline("balance", { levelId: game.level.id, levelIndex: game.levelIndex })
    const raceIsWaiting = race.isWaiting
    const raceIsPlaying = race.isPlaying
    const raceHasSubmitted = race.hasSubmitted
    const raceLevelId = race.settings.levelId
    const submitRaceResult = race.submitResult
    const { checkBadges } = useGamification()
    const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()
    const [selectedPan, setSelectedPan] = useState<PanSide>("left")
    const prevStatusRef = useRef(game.status)

    const coins = useMemo(
        () => Array.from({ length: game.level.coinCount }, (_, coin) => coin),
        [game.level.coinCount],
    )
    const currentBestWeighing = game.stats.bestWeighings[game.level.id]
    const currentBestTime = game.stats.bestTimes[game.level.id]
    const remainingWeighings = Math.max(0, game.level.maxWeighings - game.weighings)
    const panStatusText = getPanStatusText(game.left.length, game.right.length, game.weighings, game.level.maxWeighings)
    const statusText =
        game.status === "solved"
            ? `推理完成：${game.weighings} 次称量锁定假币`
            : game.status === "failed"
              ? "本局结束，答案已揭晓"
              : game.message || (game.lastResult ? `本次结果：${formatResult(game.lastResult)}` : panStatusText)
    const showIssue = game.status === "playing" && Boolean(game.message)
    const canPlay = game.status === "playing"

    useEffect(() => {
        setTutorOverride({
            subtitle: "正在看天平称重关卡",
            quickPrompts: ["天平称重怎么玩？", "怎么分组更省次数？", "为什么三分法有效？"],
            hideFabOnMobile: true,
        })
        return clearTutorOverride
    }, [clearTutorOverride, setTutorOverride])

    useEffect(() => {
        setSelectedPan("left")
    }, [game.level.id])

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
            weighings: game.weighings,
            timeSeconds: game.time,
        })
    }, [
        game.level.id,
        game.levelIndex,
        game.status,
        game.time,
        game.weighings,
        raceHasSubmitted,
        raceIsPlaying,
        raceLevelId,
        submitRaceResult,
    ])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main justify-start pb-44 py-3 sm:py-6 xl:py-8">
                <div className="w-full max-w-5xl playground-game-board !p-3 sm:!p-5">
                    {modeTabs}
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 sm:grid">
                                <Scale className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="hidden truncate text-lg font-black sm:block sm:text-xl">天平称重 · {game.level.name}</h1>
                                <p className="text-[15px] font-semibold text-foreground/80 sm:text-sm sm:font-normal sm:text-muted-foreground">
                                    <span className="sm:hidden">{game.level.name} · </span>假币{game.level.fakeLighter ? "更轻" : "更重"} · 最多称 {game.level.maxWeighings} 次 · {game.level.coinCount} 枚硬币
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <span className="inline-flex h-11 items-center gap-1 rounded-full bg-muted/70 px-3 text-[15px] font-bold tabular-nums">
                                <Scale className="h-4 w-4" />
                                {game.weighings}/{game.level.maxWeighings}
                            </span>
                            <span className="inline-flex h-11 items-center gap-1 rounded-full bg-muted/70 px-3 font-mono text-[15px] font-bold tabular-nums">
                                <Clock className="h-4 w-4" />
                                {formatTime(game.time)}
                            </span>
                            <span className="inline-flex h-11 items-center gap-1 rounded-full bg-muted/70 px-3 text-[15px] font-bold">
                                <Trophy className="h-4 w-4 text-primary" />
                                {currentBestWeighing != null ? `${currentBestWeighing} 次` : "暂无"}
                            </span>
                            <Button variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={() => game.startLevel(game.levelIndex)} aria-label="重开">
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="mb-3 flex items-center gap-2" role="group" aria-label="关卡">
                        <button
                            type="button"
                            disabled={game.levelIndex <= 0 || raceActive}
                            onClick={() => game.startLevel(game.levelIndex - 1)}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                            aria-label="上一关"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="min-w-0 flex-1 text-center">
                            <p className="text-[15px] font-black">
                                第 {game.levelIndex + 1} 关
                                <span className="mx-1 font-semibold text-muted-foreground">/</span>
                                {BALANCE_LEVELS.length}
                                {game.stats.solvedLevels.includes(game.level.id) ? <Check className="ml-1 inline h-4 w-4 text-primary" /> : null}
                            </p>
                            <p className="truncate text-[15px] font-semibold text-muted-foreground">{game.level.name}</p>
                        </div>
                        <button
                            type="button"
                            disabled={game.levelIndex >= BALANCE_LEVELS.length - 1 || raceActive}
                            onClick={() => game.startLevel(game.levelIndex + 1)}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/70 disabled:opacity-40"
                            aria-label="下一关"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>

                    <RaceOnlineDisclosure phase={race.phase}>
                        <RaceOnlinePanel online={race} gamePath="/playground/balance" />
                    </RaceOnlineDisclosure>

                    <div className="mb-3 text-center" aria-live="polite">
                        <p className={cn("text-[15px] font-bold leading-relaxed", game.status === "solved" ? "text-primary" : "text-foreground")}>
                            {game.stepFeedback || statusText}
                        </p>
                        {game.status === "playing" && !showIssue ? (
                            <p className="mt-0.5 text-[15px] font-semibold text-muted-foreground">
                                左 {game.left.length} · 右 {game.right.length} · 剩余 {remainingWeighings} 次
                            </p>
                        ) : null}
                    </div>

                    <div className="relative mb-4 overflow-hidden rounded-2xl bg-muted/35 p-3 dark:bg-muted/25 sm:p-5">
                        <div className="relative min-h-[18.75rem] sm:min-h-[20rem]">
                            <div className="absolute left-1/2 top-[5.75rem] z-20 h-32 w-3 -translate-x-1/2 rounded-full bg-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-slate-300" />
                            <div className="absolute left-1/2 top-[12.6rem] z-10 h-0 w-0 -translate-x-1/2 border-x-[2.2rem] border-b-[4.1rem] border-x-transparent border-b-slate-700 dark:border-b-slate-300" />
                            <div className="absolute left-1/2 top-[4.9rem] z-30 grid h-10 w-10 -translate-x-1/2 place-items-center rounded-full border border-slate-500/45 bg-white text-slate-700 shadow-md dark:bg-slate-900 dark:text-slate-100">
                                <Scale className="h-5 w-5" />
                            </div>
                            <div
                                key={`beam-${game.weighings}-${game.lastResult ?? "idle"}`}
                                className={cn(
                                    "absolute left-[11%] right-[11%] top-[6rem] z-10 h-2.5 origin-center rounded-full bg-slate-700 shadow-[0_8px_16px_-12px_rgba(15,23,42,0.85)] dark:bg-slate-300",
                                    game.lastResult ? "balance-beam-swing" : "transition-transform duration-300",
                                    getBeamTilt(game.lastResult),
                                )}
                                style={{ ["--balance-tilt" as string]: getBeamTiltVar(game.lastResult) }}
                            />
                            <PanTray
                                side="left"
                                coins={game.left}
                                selectedPan={selectedPan}
                                result={game.lastResult}
                                disabled={!canPlay}
                                onSelect={setSelectedPan}
                                onRemove={game.toggleCoin}
                            />
                            <PanTray
                                side="right"
                                coins={game.right}
                                selectedPan={selectedPan}
                                result={game.lastResult}
                                disabled={!canPlay}
                                onSelect={setSelectedPan}
                                onRemove={game.toggleCoin}
                            />
                            <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-background/95 px-4 py-2 text-sm font-black shadow-sm backdrop-blur">
                                <span className={cn(game.lastResult ? "balance-result-pulse text-primary" : "text-foreground")}>
                                    {formatResult(game.lastResult)}
                                </span>
                            </div>
                        </div>

                        <div className="relative z-20 mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-background/90 px-3 py-2 text-[15px] font-bold text-foreground shadow-xs">
                                    剩余 {remainingWeighings} 次
                                </span>
                                <span className="rounded-full bg-background/90 px-3 py-2 text-[15px] font-bold text-foreground shadow-xs">
                                    {panStatusText}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={game.doWeigh} disabled={!canPlay || game.weighings >= game.level.maxWeighings} className="min-h-11 flex-1 rounded-full sm:flex-none">
                                    <Scale className="mr-1.5 h-4 w-4" />
                                    称量
                                </Button>
                                <Button variant="outline" onClick={game.clearPans} disabled={!canPlay} className="min-h-11 flex-1 rounded-full sm:flex-none">
                                    清空
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.72fr)]">
                        <section className="rounded-2xl bg-muted/30 p-3">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Coins className="h-4 w-4 text-primary" />
                                    <h2 className="text-[15px] font-black">硬币台</h2>
                                </div>
                                <div className="inline-flex h-11 items-center rounded-full bg-muted/60 p-1">
                                    {(["left", "right"] as PanSide[]).map((side) => (
                                        <button
                                            key={side}
                                            type="button"
                                            onClick={() => setSelectedPan(side)}
                                            disabled={!canPlay}
                                            aria-pressed={selectedPan === side}
                                            className={cn(
                                                "h-9 rounded-full px-3.5 text-[15px] font-black transition-colors disabled:cursor-default disabled:opacity-60",
                                                selectedPan === side ? PAN_META[side].active : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {PAN_META[side].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap justify-center gap-3">
                                {coins.map((coin) => {
                                    const side = game.left.includes(coin) ? "left" : game.right.includes(coin) ? "right" : null
                                    return (
                                        <div key={`coin-cell-${coin}`} className="flex flex-col items-center gap-1.5">
                                            <BalanceCoin
                                                coin={coin}
                                                side={side}
                                                selected={side === selectedPan}
                                                disabled={!canPlay}
                                                onClick={() => game.toggleCoin(coin, selectedPan)}
                                                label={`${coin + 1} 号硬币${side ? `，当前在${PAN_META[side].label}` : ""}，点击放入${PAN_META[selectedPan].label}`}
                                            />
                                            <span className={cn("text-sm font-bold", side ? PAN_META[side].color : "text-muted-foreground")}>
                                                {side ? PAN_META[side].label : `去${PAN_META[selectedPan].shortLabel}盘`}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>

                        <section className="rounded-2xl bg-muted/30 p-3">
                            <div className="mb-3 flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-primary" />
                                <h2 className="text-[15px] font-black">指认假币</h2>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-2">
                                {coins.map((coin) => {
                                    const isAnswer = coin === game.level.fakeIndex
                                    const reveal = game.status !== "playing" && isAnswer
                                    return (
                                        <button
                                            key={`guess-${coin}`}
                                            type="button"
                                            disabled={!canPlay}
                                            onClick={() => game.guess(coin)}
                                            className={cn(
                                                "min-h-11 rounded-xl text-[15px] font-black transition-[background-color,color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-70",
                                                reveal
                                                    ? "bg-primary text-primary-foreground"
                                                    : "bg-background/80 text-foreground hover:bg-primary/10",
                                                canPlay && "active:scale-[0.97]",
                                            )}
                                        >
                                            {coin + 1}
                                        </button>
                                    )
                                })}
                            </div>
                            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                                {game.level.hint}
                            </p>
                        </section>
                    </div>

                    {game.status !== "playing" ? (
                        <div className="mt-4 mb-8 rounded-2xl bg-muted/40 p-4 text-center sm:p-5" role="status">
                            {game.status === "solved" ? (
                                <Sparkles className="mx-auto mb-1.5 h-6 w-6 text-primary" />
                            ) : (
                                <AlertCircle className="mx-auto mb-1.5 h-6 w-6 text-foreground" />
                            )}
                            <p className="text-lg font-black">{game.status === "solved" ? "推理完成" : "本局结束"}</p>
                            <p className="mb-1 text-[15px] font-semibold text-foreground">{game.message}</p>
                            <p className="mb-3 text-[15px] text-muted-foreground">{game.weighings} 次称量 · {formatTime(game.time)}</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {game.status === "solved" && game.levelIndex < game.levelCount - 1 ? (
                                    <Button className="min-h-11 rounded-full" onClick={() => game.startLevel(game.levelIndex + 1)}>下一关</Button>
                                ) : (
                                    <Button className="min-h-11 rounded-full" variant="outline" onClick={() => game.startLevel(game.levelIndex)}>再来一局</Button>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {game.history.length > 0 ? (
                        <section className="mt-4 rounded-2xl bg-muted/30 p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <ArrowLeftRight className="h-4 w-4 text-primary" />
                                <h2 className="text-[15px] font-black">称量记录</h2>
                            </div>
                            <ol className="space-y-2 text-[15px] leading-relaxed text-foreground">
                                {game.history.map((line) => (
                                    <li key={line} className="rounded-xl bg-background/60 px-3 py-2.5">
                                        {line}
                                    </li>
                                ))}
                            </ol>
                        </section>
                    ) : null}
                </div>
            </div>

            <aside className="hidden w-full border-t border-border bg-card/50 p-5 xl:block xl:w-80 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <RaceOnlinePanel collapsible online={race} gamePath="/playground/balance" />
                    <section>
                        <h2 className="mb-3 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-primary" />
                            最佳记录
                        </h2>
                        <div className="space-y-2 text-[15px]">
                            {BALANCE_LEVELS.map((level) => {
                                const bestWeighing = game.stats.bestWeighings[level.id]
                                const bestTime = game.stats.bestTimes[level.id]
                                return (
                                    <div
                                        key={level.id}
                                        className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
                                    >
                                        <span className="min-w-0 truncate font-medium">{level.name}</span>
                                        <span className="shrink-0 text-right font-bold tabular-nums">
                                            {bestWeighing != null ? `${bestWeighing} 次` : "-"}
                                            {bestTime != null ? (
                                                <span className="ml-1 text-muted-foreground">{formatTime(bestTime)}</span>
                                            ) : null}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                    <section className="rounded-xl bg-muted/35 p-3">
                        <h3 className="mb-2 text-[15px] font-black">推理节奏</h3>
                        <p className="text-[15px] leading-relaxed text-muted-foreground">
                            每次称量会把候选硬币分成左重、右重、平衡三类结果。优先让左右数量相同，信息量才稳定。
                        </p>
                    </section>
                    {currentBestWeighing != null ? (
                        <p className="text-[15px] leading-relaxed text-muted-foreground">
                            当前关卡最佳：{currentBestWeighing} 次称量
                            {currentBestTime != null ? ` · ${formatTime(currentBestTime)}` : ""}。
                        </p>
                    ) : null}
                </div>
            </aside>
        </div>
    )
}

type BalanceMode = "coin" | "lever" | "density"

const BALANCE_MODES: Array<{ key: BalanceMode; label: string; desc: string }> = [
    { key: "coin", label: "找假币", desc: "用最少的称量次数找出假币" },
    { key: "lever", label: "杠杆平衡", desc: "F₁ × L₁ = F₂ × L₂" },
    { key: "density", label: "密度比较", desc: "ρ = m ÷ V" },
]

export default function BalancePage() {
    const [mode, setMode] = useState<BalanceMode>("coin")
    const { setOverride: setTutorOverride, clearOverride: clearTutorOverride } = useTutorContext()
    useEffect(() => {
        if (mode === "coin") return
        setTutorOverride({ subtitle: "正在看天平称重关卡", hideFabOnMobile: true })
        return clearTutorOverride
    }, [clearTutorOverride, mode, setTutorOverride])
    const tabs = (
        <div className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-muted/50 p-1" role="tablist" aria-label="玩法">
            {BALANCE_MODES.map((m) => (
                <button
                    key={m.key}
                    type="button"
                    role="tab"
                    aria-selected={mode === m.key}
                    onClick={() => setMode(m.key)}
                    title={m.desc}
                    className={cn(
                        "flex min-h-11 items-center justify-center rounded-full px-2 text-[15px] font-black transition-colors",
                        mode === m.key ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {m.label}
                </button>
            ))}
        </div>
    )
    if (mode === "coin") return <CoinMode modeTabs={tabs} />
    return (
        <div className="playground-game-page">
            <div className="playground-game-main justify-start pb-44 py-3 sm:py-6 xl:py-8">
                <div className="w-full max-w-3xl playground-game-board !p-3 sm:!p-5">
                    {tabs}
                    <h1 className="mb-2 hidden text-xl font-black sm:block">天平称重 · {mode === "lever" ? "杠杆平衡" : "密度比较"}</h1>
                    {mode === "lever" ? <LeverMode /> : <DensityMode />}
                </div>
            </div>
        </div>
    )
}
