"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, CircleHelp, Heart, Lock, PaintBucket, RotateCcw, Sparkles, Table, Trophy, X } from "lucide-react"
import { NONOGRAM_LEVELS, useNonogram, type NonogramTool } from "@/hooks/playground/use-nonogram"
import { NonogramVictoryArt } from "@/components/features/playground/nonogram-victory-art"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`
}

function cellFromPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    const node = document.elementFromPoint(clientX, clientY)
    const cell = node instanceof Element ? node.closest<HTMLElement>("[data-nonogram-cell]") : null
    if (!cell || cell.dataset.locked === "1") return null
    const row = Number(cell.dataset.row)
    const col = Number(cell.dataset.col)
    if (!Number.isFinite(row) || !Number.isFinite(col)) return null
    return { row, col }
}

export default function NonogramPage() {
    const game = useNonogram()
    const { checkBadges } = useGamification()
    const {
        setOverride: setTutorOverride,
        clearOverride: clearTutorOverride,
    } = useTutorContext()
    const boardRef = useRef<HTMLDivElement>(null)
    const paintingRef = useRef(false)
    const [showHelp, setShowHelp] = useState(false)
    const size = game.size
    const maxRowClueCount = Math.max(1, ...game.clues.rows.map((clue) => clue.length))
    const maxColClueCount = Math.max(1, ...game.clues.cols.map((clue) => clue.length))
    // 预留线索宽度/高度，避免数字溢出到格子下方被盖住
    const clueGutter = `${Math.max(2.4, maxRowClueCount * 0.72 + 1.1).toFixed(2)}rem`
    const colClueMinHeight = `${Math.max(1.75, maxColClueCount * 0.78 + 0.85).toFixed(2)}rem`
    const celebrating = game.status === "solved"

    useEffect(() => {
        setTutorOverride({
            subtitle: "正在看数织关卡",
            quickPrompts: ["数织怎么玩？", "线索是什么意思？", "填错了怎么办？"],
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
            nonogramSolved: game.stats.solvedLevels.length,
        })
    }, [checkBadges, game.stats.solvedLevels.length, game.status])

    const startAtPoint = useCallback(
        (clientX: number, clientY: number, strokeTool: NonogramTool) => {
            const cell = cellFromPoint(clientX, clientY)
            if (!cell) return
            paintingRef.current = true
            game.beginStroke(cell.row, cell.col, strokeTool)
        },
        [game],
    )

    const moveAtPoint = useCallback(
        (clientX: number, clientY: number) => {
            if (!paintingRef.current) return
            const cell = cellFromPoint(clientX, clientY)
            if (!cell) return
            game.continueStroke(cell.row, cell.col)
        },
        [game],
    )

    const stopPainting = useCallback(() => {
        paintingRef.current = false
        game.endStroke()
    }, [game])

    const startLevel = useCallback(
        (index: number) => {
            game.startLevel(index)
        },
        [game],
    )

    return (
        <div className="playground-game-page">
            <div className="playground-game-main justify-start py-3 sm:py-5">
                <div className="w-full max-w-3xl playground-game-board !p-3 sm:!p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-400/40 bg-slate-500/10">
                                <Table className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="truncate text-lg font-black sm:text-xl">数织 · {game.level.name}</h1>
                                <p className="text-[11px] text-muted-foreground sm:text-xs">
                                    {size}×{size} · {game.levelCount} 关 · 滑动连填 · 每局 3 次试错
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <div
                                className="flex items-center gap-0.5 rounded-full bg-muted px-2 py-1"
                                title={`试错 ${game.mistakes}/${game.maxMistakes}`}
                                aria-label={`剩余试错 ${game.maxMistakes - game.mistakes} 次`}
                            >
                                {Array.from({ length: game.maxMistakes }, (_, index) => {
                                    const broken = index < game.mistakes
                                    return (
                                        <Heart
                                            key={index}
                                            className={cn(
                                                "h-3.5 w-3.5",
                                                broken
                                                    ? "fill-muted-foreground/25 text-muted-foreground/40"
                                                    : "fill-rose-500 text-rose-500",
                                            )}
                                        />
                                    )
                                })}
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-bold tabular-nums">
                                {formatTime(game.time)}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11"
                                onClick={() => startLevel(game.levelIndex)}
                                aria-label="重开本关"
                            >
                                <RotateCcw className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                        {NONOGRAM_LEVELS.map((level, index) => {
                            const solved = game.stats.solvedLevels.includes(level.id)
                            const unlocked = index < game.unlockedCount
                            const active = game.levelIndex === index
                            return (
                                <button
                                    key={level.id}
                                    type="button"
                                    disabled={!unlocked}
                                    onClick={() => {
                                        if (!unlocked) return
                                        startLevel(index)
                                    }}
                                    className={cn(
                                        "min-h-10 shrink-0 rounded-sm border px-3 text-xs font-bold transition-colors",
                                        !unlocked && "cursor-not-allowed opacity-45",
                                        unlocked && active
                                            ? "border-slate-700 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900"
                                            : unlocked
                                              ? "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                                              : "border-border bg-muted/40 text-muted-foreground",
                                    )}
                                    title={unlocked ? level.name : "先通关前面的关卡"}
                                    aria-label={unlocked ? level.name : `${level.name}（未解锁）`}
                                >
                                    {!unlocked ? <Lock className="mr-1 inline h-3 w-3" /> : null}
                                    {level.name}
                                    {solved ? <span className="ml-1 text-emerald-400">✓</span> : null}
                                </button>
                            )
                        })}
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => game.setTool(game.tool === "fill" ? "mark" : "fill")}
                            className="grid h-11 shrink-0 grid-cols-2 gap-0.5 rounded-sm border border-border/80 bg-muted/50 p-0.5 shadow-xs transition-transform active:scale-[0.98]"
                            aria-label={game.tool === "mark" ? "当前叉号模式，点击切换到填色" : "当前填色模式，点击切换到叉号"}
                            aria-pressed={game.tool === "mark"}
                            data-testid="nonogram-tool-toggle"
                            disabled={game.status !== "playing"}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    "flex min-w-[3.25rem] items-center justify-center gap-1 rounded-xs px-2 text-xs font-bold",
                                    game.tool === "fill"
                                        ? "bg-slate-800 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900"
                                        : "text-muted-foreground",
                                )}
                            >
                                <PaintBucket className="h-3.5 w-3.5" />
                                填色
                            </span>
                            <span
                                aria-hidden
                                className={cn(
                                    "flex min-w-[3.25rem] items-center justify-center gap-1 rounded-xs px-2 text-xs font-bold",
                                    game.tool === "mark" ? "bg-rose-500 text-white shadow-xs" : "text-muted-foreground",
                                )}
                            >
                                <X className="h-3.5 w-3.5" />
                                叉号
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowHelp((value) => !value)}
                            className="grid h-11 w-11 place-items-center rounded-sm border border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-expanded={showHelp}
                            aria-label="操作说明"
                        >
                            <CircleHelp className="h-4 w-4" />
                        </button>
                    </div>

                    {showHelp ? (
                        <div className="mb-3 rounded-sm border border-border bg-background px-3 py-2.5 text-xs leading-5 text-muted-foreground">
                            <p>
                                <strong className="text-foreground">空行/空列：</strong>
                                线索为 0 的整行/列开局就打叉锁定，不能再点。
                            </p>
                            <p>
                                <strong className="text-foreground">填色：</strong>
                                点按或滑动涂黑；涂错会扣 1 次试错并留下叉号（共 3 次）。
                            </p>
                            <p>
                                <strong className="text-foreground">叉号：</strong>
                                标记确定的空格，不计入试错；行列填对后会自动补叉并变绿。
                            </p>
                        </div>
                    ) : null}

                    <div
                        ref={boardRef}
                        role="application"
                        aria-label="数织棋盘"
                        className="mx-auto w-full max-w-[min(100%,36rem)] scroll-mt-[calc(var(--mobile-global-header-height,0px)+4.5rem)] select-none touch-none rounded-md border border-slate-300/70 bg-slate-100/80 p-2 dark:border-slate-600/50 dark:bg-slate-900/40 sm:p-3"
                        onPointerDown={(event) => {
                            if (game.status !== "playing") return
                            if (event.pointerType === "mouse" && event.button === 2) return
                            if (event.pointerType === "mouse" && event.button !== 0) return
                            // 阻止移动端把格子滚进视口，避免顶部/左侧线索被 sticky 栏挡住
                            event.preventDefault()
                            if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur()
                            }
                            boardRef.current?.setPointerCapture(event.pointerId)
                            startAtPoint(event.clientX, event.clientY, game.tool)
                        }}
                        onPointerMove={(event) => {
                            if (!paintingRef.current || game.status !== "playing") return
                            event.preventDefault()
                            moveAtPoint(event.clientX, event.clientY)
                        }}
                        onPointerUp={(event) => {
                            if (boardRef.current?.hasPointerCapture(event.pointerId)) {
                                boardRef.current.releasePointerCapture(event.pointerId)
                            }
                            stopPainting()
                        }}
                        onPointerCancel={stopPainting}
                        onContextMenu={(event) => {
                            event.preventDefault()
                            if (game.status !== "playing") return
                            const cell = cellFromPoint(event.clientX, event.clientY)
                            if (!cell) return
                            const alt: NonogramTool = game.tool === "fill" ? "mark" : "fill"
                            paintingRef.current = true
                            game.beginStroke(cell.row, cell.col, alt)
                            requestAnimationFrame(() => stopPainting())
                        }}
                    >
                        <div
                            className="grid w-full gap-px"
                            style={{ gridTemplateColumns: `${clueGutter} minmax(0, 1fr)` }}
                        >
                            <div
                                className="sticky left-0 top-[calc(var(--mobile-global-header-height,0px)+3.75rem)] z-30 bg-slate-100/95 dark:bg-slate-900/95"
                                style={{ minHeight: colClueMinHeight }}
                            />
                            <div
                                className="sticky top-[calc(var(--mobile-global-header-height,0px)+3.75rem)] z-30 grid gap-px bg-slate-100/95 pb-1 dark:bg-slate-900/95"
                                style={{
                                    gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                                    minHeight: colClueMinHeight,
                                }}
                            >
                                {game.clues.cols.map((clue, index) => {
                                    const done = game.lineCompletion.cols[index]
                                    const zero = game.zeroLines.cols[index]
                                    return (
                                        <div
                                            key={`col-${index}`}
                                            className={cn(
                                                "flex min-h-full flex-col items-center justify-end gap-0.5 px-0.5 text-[10px] font-bold leading-none tabular-nums sm:text-[11px]",
                                                done || zero
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-600 dark:text-slate-300",
                                            )}
                                        >
                                            {done || zero ? <Check className="mb-0.5 h-3 w-3 shrink-0" /> : null}
                                            {clue.map((n, i) => (
                                                <span key={i} className={cn(zero && "line-through opacity-80")}>
                                                    {n}
                                                </span>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>

                            <div
                                className="sticky left-0 z-20 grid gap-px bg-slate-100/95 dark:bg-slate-900/95"
                                style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}
                            >
                                {game.clues.rows.map((clue, r) => {
                                    const rowDone = game.lineCompletion.rows[r]
                                    const rowZero = game.zeroLines.rows[r]
                                    return (
                                        <div
                                            key={`row-clue-${r}`}
                                            className={cn(
                                                "flex items-center justify-end gap-0.5 pr-1.5 text-[10px] font-bold leading-none tabular-nums sm:text-[11px]",
                                                rowDone || rowZero
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-600 dark:text-slate-300",
                                            )}
                                        >
                                            {rowDone || rowZero ? <Check className="h-3 w-3 shrink-0" /> : null}
                                            {clue.map((n, i) => (
                                                <span key={i} className={cn("shrink-0", rowZero && "line-through opacity-80")}>
                                                    {n}
                                                </span>
                                            ))}
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="relative z-10 min-w-0 [perspective:900px]">
                                {celebrating ? (
                                    <NonogramVictoryArt
                                        levelId={game.level.id}
                                        solution={game.level.solution}
                                        name={game.level.name}
                                        className="nonogram-art-in z-10"
                                    />
                                ) : null}

                                <div
                                    className={cn("relative grid gap-px", celebrating && "pointer-events-none")}
                                    style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
                                >
                                    {game.grid.map((row, r) =>
                                        row.map((cell, c) => {
                                            const isError = game.errorCell?.row === r && game.errorCell?.col === c
                                            const locked = game.isLocked(r, c)
                                            const rowDone = game.lineCompletion.rows[r]
                                            const colDone = game.lineCompletion.cols[c]
                                            return (
                                                <div
                                                    key={`${r}-${c}`}
                                                    data-nonogram-cell
                                                    data-row={r}
                                                    data-col={c}
                                                    data-locked={locked ? "1" : "0"}
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "relative aspect-square min-h-0 rounded-[3px] border text-[10px] font-black [-webkit-tap-highlight-color:transparent] sm:text-xs",
                                                        locked &&
                                                            "cursor-not-allowed border-slate-300/80 bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(148,163,184,0.18)_3px,rgba(148,163,184,0.18)_6px)] text-slate-400 dark:border-slate-600 dark:text-slate-500",
                                                        !locked &&
                                                            cell === 1 &&
                                                            "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900",
                                                        !locked &&
                                                            cell === 2 &&
                                                            "border-rose-200 bg-rose-50 text-rose-500 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-300",
                                                        !locked &&
                                                            cell === 0 &&
                                                            "border-slate-200/90 bg-white dark:border-slate-700 dark:bg-slate-800/80",
                                                        (c + 1) % 5 === 0 && c !== size - 1 && "border-r-slate-400/70 dark:border-r-slate-500",
                                                        (r + 1) % 5 === 0 && r !== size - 1 && "border-b-slate-400/70 dark:border-b-slate-500",
                                                        rowDone && colDone && cell === 1 && "ring-1 ring-emerald-400/50",
                                                        isError &&
                                                            "z-10 animate-pulse border-rose-500 bg-rose-500 text-white shadow-[0_0_0_2px_rgba(244,63,94,0.45)]",
                                                        celebrating && "nonogram-cell-flip",
                                                    )}
                                                    style={
                                                        celebrating
                                                            ? { animationDelay: `${(r + c) * 48}ms` }
                                                            : undefined
                                                    }
                                                >
                                                    {(cell === 2 || locked) && !isError ? (
                                                        <span className="pointer-events-none absolute inset-0 grid place-items-center">×</span>
                                                    ) : null}
                                                    {isError ? (
                                                        <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm">!</span>
                                                    ) : null}
                                                </div>
                                            )
                                        }),
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                            {game.tool === "fill" ? <PaintBucket className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                            当前：{game.tool === "fill" ? "填色 / 擦除" : "叉号 / 清除"}
                        </span>
                        <span>
                            试错 {game.mistakes}/{game.maxMistakes} · 通关 {game.stats.solvedLevels.length}/{game.levelCount}
                        </span>
                    </div>

                    {game.status === "solved" ? (
                        <div className="relative mt-3 overflow-hidden rounded-md border border-emerald-400/35 bg-emerald-50/80 p-4 dark:bg-emerald-950/22">
                            <div
                                aria-hidden
                                className="absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-300/18 dark:bg-emerald-400/8"
                            />
                            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-3 text-left">
                                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_8px_20px_-10px_rgba(16,185,129,0.9)]">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-black tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                                            像素作品已收集
                                        </p>
                                        <p className="truncate text-base font-black text-foreground">
                                            {game.level.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            用时 {formatTime(game.time)}
                                            {game.mistakes === 0 ? " · 零失误通关" : ` · 试错 ${game.mistakes} 次`}
                                        </p>
                                    </div>
                                </div>
                                {game.levelIndex < game.levelCount - 1 ? (
                                    <Button
                                        className="w-full shrink-0 sm:w-auto"
                                        size="sm"
                                        onClick={() => startLevel(game.levelIndex + 1)}
                                    >
                                        解锁下一幅
                                    </Button>
                                ) : (
                                    <span className="self-start rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 sm:self-auto">
                                        全部完成
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {game.status === "failed" ? (
                        <div className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 p-4 text-center">
                            <X className="mx-auto mb-2 h-6 w-6 text-rose-500" />
                            <p className="font-black">试错已用完</p>
                            <p className="text-xs text-muted-foreground">填错实心格会扣次数；叉号不影响。再开一局仔细推线索。</p>
                            <Button className="mt-3" size="sm" variant="outline" onClick={() => startLevel(game.levelIndex)}>
                                重开本关
                            </Button>
                        </div>
                    ) : null}
                </div>
            </div>

            <aside className="hidden w-full border-t border-border bg-card/50 p-6 xl:block xl:w-80 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section>
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-slate-500" />
                            通关记录
                        </h2>
                        <div className="no-scrollbar max-h-[28rem] space-y-1.5 overflow-y-auto text-xs">
                            {NONOGRAM_LEVELS.map((level) => (
                                <div key={level.id} className="flex justify-between rounded-md bg-muted/50 px-3 py-2">
                                    <span className="truncate pr-2">{level.name}</span>
                                    <span className="shrink-0 font-bold tabular-nums">
                                        {game.stats.solvedLevels.includes(level.id)
                                            ? formatTime(game.stats.bestTimes[level.id] ?? 0)
                                            : "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <p className="text-xs text-muted-foreground">
                        通关后格子会波浪翻开，直接露出彩色插画成品。
                    </p>
                </div>
            </aside>
        </div>
    )
}
