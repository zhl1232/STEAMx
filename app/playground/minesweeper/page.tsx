"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useMinesweeper, DIFFICULTIES } from "@/hooks/playground/use-minesweeper"
import { getTutorSceneCapabilities } from "@/components/features/tutor/tool-handler-registry"
import { useTutorContext } from "@/components/features/tutor/tutor-context"
import { useGamification } from '@/lib/context/gamification-context'
import { findMinesweeperHint, type MinesweeperHint } from "@/lib/playground/minesweeper-hint"
import { Bomb, Flag, Timer, Trophy, RefreshCw, BookOpen, ChevronRight, MousePointerClick, Medal, Star, Lightbulb } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const DIFF_LABELS: Record<string, { label: string; color: string; xp: number }> = {
    beginner: { label: "初级", color: "text-green-500", xp: 10 },
    intermediate: { label: "中级", color: "text-yellow-500", xp: 15 },
    expert: { label: "高级", color: "text-red-500", xp: 20 },
}

const LONG_PRESS_DELAY_MS = 420
const LONG_PRESS_MOVE_THRESHOLD_PX = 12

function formatTime(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, "0")}s`
}

function formatMineCounter(value: number) {
    if (value >= 0) return value.toString().padStart(3, "0")
    return `-${Math.abs(value).toString().padStart(2, "0")}`
}

type MinesweeperHintFeedback = {
    kind: "clue" | "info"
    message: string
    row?: number
    col?: number
}

function formatCellPosition(row: number, col: number) {
    return `第 ${row + 1} 行第 ${col + 1} 列`
}

function formatHintFeedback(hint: MinesweeperHint): MinesweeperHintFeedback {
    const source = formatCellPosition(hint.source.row, hint.source.col)

    if (hint.kind === "safe") {
        const message = hint.source.adjacentMines === 0
            ? `${source} 是空格。先看看它周围：哪些未翻开的格子还需要担心地雷？`
            : `先观察 ${source}：数字是 ${hint.source.adjacentMines}，周围已经有 ${hint.source.flaggedNeighbors} 面旗。这个数字还需要新的雷吗？`
        return { kind: "clue", message, row: hint.source.row, col: hint.source.col }
    }

    const remainingMines = hint.source.adjacentMines - hint.source.flaggedNeighbors
    return {
        kind: "clue",
        message: `先观察 ${source}：数字是 ${hint.source.adjacentMines}，已有 ${hint.source.flaggedNeighbors} 面旗，还差 ${remainingMines} 颗雷；周围未翻开的格子正好有 ${hint.source.hiddenNeighbors} 个。它们应该怎样标记？`,
        row: hint.source.row,
        col: hint.source.col,
    }
}

export default function MinesweeperPage() {
    const {
        board,
        status,
        time,
        minesLeft,
        revealCell,
        toggleFlag,
        resetGame,
        changeDifficulty,
        difficultyName,
        autoReveal,
        stats,
        bestTimes,
        isNewRecord,
    } = useMinesweeper("beginner")

    const { checkBadges } = useGamification()
    const {
        registerToolHandlers,
        setOverride: setTutorOverride,
        clearOverride: clearTutorOverride,
    } = useTutorContext()

    const [activeTab, setActiveTab] = useState<"course" | "leaderboard">("course")
    const [isFlagMode, setIsFlagMode] = useState(false)
    const [hintFeedback, setHintFeedback] = useState<MinesweeperHintFeedback | null>(null)
    const [hideTutorFab, setHideTutorFab] = useState(false)
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggeredRef = useRef(false)
    const longPressStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
    const boardRef = useRef(board)
    const statusRef = useRef(status)

    useEffect(() => {
        boardRef.current = board
        setHintFeedback(null)
    }, [board])

    useEffect(() => {
        statusRef.current = status
    }, [status])

    useEffect(() => {
        if (typeof window.matchMedia !== "function") return
        const media = window.matchMedia("(orientation: landscape) and (max-height: 480px)")
        const sync = () => setHideTutorFab(media.matches)
        sync()
        media.addEventListener?.("change", sync)
        return () => media.removeEventListener?.("change", sync)
    }, [])

    const hintMinesweeperCell = useCallback(() => {
        const currentStatus = statusRef.current
        if (currentStatus === "idle") {
            setHintFeedback({ kind: "info", message: "先翻开任意一格。第一次点击有安全区，出现数字后我才能据此推理。" })
            return
        }
        if (currentStatus === "won") {
            setHintFeedback({ kind: "info", message: "这一局已经通关，不需要再提示了。" })
            return
        }
        if (currentStatus === "lost") {
            setHintFeedback({ kind: "info", message: "这一局已经结束，重新开局后再让我分析吧。" })
            return
        }

        const publicBoard = boardRef.current.map((row) => row.map((cell) => ({
            row: cell.row,
            col: cell.col,
            state: cell.isRevealed ? "revealed" as const : cell.isFlagged ? "flagged" as const : "hidden" as const,
            adjacentMines: cell.isRevealed ? cell.neighborMines : undefined,
        })))
        const hint = findMinesweeperHint(publicBoard)
        setHintFeedback(
            hint
                ? formatHintFeedback(hint)
                : { kind: "info", message: "目前只靠已翻开的数字还不能确定下一格，需要再探索一格获得新信息。" },
        )
    }, [])
    const sceneCapabilities = useMemo(
        () => getTutorSceneCapabilities({ hintMinesweeperCell }),
        [hintMinesweeperCell],
    )

    useEffect(() => {
        return registerToolHandlers({ hintMinesweeperCell })
    }, [hintMinesweeperCell, registerToolHandlers])

    useEffect(() => {
        setTutorOverride({
            subtitle: "正在看扫雷棋盘",
            sceneCapabilities,
            quickPrompts: ["帮我找一个能确定的格子", "这局该怎么推理？"],
            hideFab: hideTutorFab,
        })
        return clearTutorOverride
    }, [clearTutorOverride, hideTutorFab, sceneCapabilities, setTutorOverride])

    useEffect(() => {
        if (hintFeedback?.row === undefined || hintFeedback.col === undefined) return
        document
            .getElementById(`minesweeper-cell-${hintFeedback.row}-${hintFeedback.col}`)
            ?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" })
    }, [hintFeedback])

    // 胜利时触发扫雷徽章检测
    useEffect(() => {
        if (status !== "won") return
        const allBestTimes = Object.values(stats.bestTimes)
        const overallBest = allBestTimes.length > 0 ? Math.min(...allBestTimes) : 999
        checkBadges({
            // 非扫雷字段传 0，checkBadges 只关心条件满足与否
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            // 扫雷专属字段
            minesweeperWins: stats.wins,
            minesweeperExpertWins: stats.winsByDifficulty["expert"] ?? 0,
            minesweeperBestTime: overallBest,
        })
    }, [checkBadges, stats, status])

    const getNumberColor = (num: number) => {
        switch (num) {
            case 1: return "text-blue-400"
            case 2: return "text-green-400"
            case 3: return "text-red-400"
            case 4: return "text-purple-400"
            case 5: return "text-yellow-400"
            case 6: return "text-cyan-400"
            case 7: return "text-black dark:text-white"
            case 8: return "text-gray-400"
            default: return "text-transparent"
        }
    }

    const currentBest = difficultyName ? bestTimes[difficultyName] : undefined
    const isBeginner = difficultyName === "beginner"

    const getCellLabel = (rIdx: number, cIdx: number) => {
        const cell = board[rIdx]?.[cIdx]
        if (!cell) return `第 ${rIdx + 1} 行第 ${cIdx + 1} 列`
        const position = `第 ${rIdx + 1} 行第 ${cIdx + 1} 列`
        const hintLabel = hintFeedback?.row === rIdx && hintFeedback.col === cIdx
            ? "，小迪提示从这里推理"
            : ""
        if (cell.isFlagged) return `${position}，已标记${hintLabel}`
        if (!cell.isRevealed) return `${position}，未翻开${hintLabel}`
        if (cell.isMine) return `${position}，地雷${hintLabel}`
        if (cell.neighborMines > 0) return `${position}，周围 ${cell.neighborMines} 个地雷${hintLabel}`
        return `${position}，安全空格${hintLabel}`
    }

    const activateCell = (rIdx: number, cIdx: number) => {
        const cell = board[rIdx]?.[cIdx]
        if (!cell) return
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false
            return
        }
        if (cell.isRevealed) {
            autoReveal(rIdx, cIdx)
        } else if (isFlagMode) {
            toggleFlag(rIdx, cIdx)
        } else {
            revealCell(rIdx, cIdx)
        }
    }

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
        }
    }

    const startLongPress = (
        event: React.PointerEvent<HTMLDivElement>,
        row: number,
        col: number,
        isRevealed: boolean,
    ) => {
        if (event.pointerType === "mouse") return
        clearLongPressTimer()
        longPressTriggeredRef.current = false
        longPressStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
        }
        if (isRevealed || status === "won" || status === "lost") return

        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null
            longPressStartRef.current = null
            longPressTriggeredRef.current = true
            toggleFlag(row, col)
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.(12)
            }
        }, LONG_PRESS_DELAY_MS)
    }

    const moveLongPress = (event: React.PointerEvent<HTMLDivElement>) => {
        const start = longPressStartRef.current
        if (!start || start.pointerId !== event.pointerId) return
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
        if (moved <= LONG_PRESS_MOVE_THRESHOLD_PX) return
        clearLongPressTimer()
        longPressStartRef.current = null
    }

    const finishLongPress = () => {
        clearLongPressTimer()
        longPressStartRef.current = null
    }

    useEffect(() => clearLongPressTimer, [])

    return (
        <div className="playground-game-page">
            {/* 左侧游戏区 */}
            <div className="playground-game-main minesweeper-game-main max-md:relative max-md:left-1/2 max-md:w-[100dvw] max-md:max-w-[100dvw] max-md:-translate-x-1/2">
                <div className="minesweeper-game-shell max-w-full lg:max-w-max w-full relative">

                    {/* Mobile compact controls */}
                    <div className="mb-2 lg:hidden" data-testid="minesweeper-mobile-controls">
                        <div className="grid grid-cols-3 gap-1 rounded-md bg-[oklch(0.93_0.025_245)] p-1 dark:bg-[oklch(0.2_0.025_245)]">
                            {(["beginner", "intermediate", "expert"] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => changeDifficulty(level)}
                                    className={`min-h-11 rounded-sm px-2 text-sm font-bold transition-[background-color,color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${difficultyName === level
                                        ? "bg-primary text-primary-foreground shadow-[0_5px_12px_-8px_hsl(var(--primary)/0.72)]"
                                        : "text-muted-foreground"
                                        }`}
                                >
                                    {DIFF_LABELS[level].label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_2.75rem_auto] items-center gap-2">
                            <div className="flex h-11 min-w-0 items-center justify-center gap-2 rounded-sm border border-border/80 bg-background/90 px-2 font-mono text-base tabular-nums shadow-xs">
                                <Flag className="h-4 w-4 shrink-0 text-destructive" />
                                <span className="text-destructive">{formatMineCounter(minesLeft)}</span>
                                <span className="h-4 w-px bg-border" />
                                <Timer className="h-4 w-4 shrink-0 text-primary" />
                                <span className="text-primary">{time.toString().padStart(3, "0")}</span>
                            </div>

                            <button
                                onClick={resetGame}
                                aria-label="重新开始扫雷"
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-primary/30 bg-primary text-primary-foreground shadow-[0_6px_14px_-10px_hsl(var(--primary)/0.75)] transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                                {status === "lost" ? <Bomb size={19} /> : status === "won" ? <Trophy size={19} /> : <RefreshCw size={19} />}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsFlagMode((current) => !current)}
                                className={`flex h-11 min-w-[5.75rem] shrink-0 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm font-bold shadow-xs transition-[background-color,border-color,color,transform] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 ${isFlagMode
                                    ? "border-destructive/50 bg-destructive text-destructive-foreground focus-visible:outline-destructive"
                                    : "border-primary/40 bg-primary text-primary-foreground focus-visible:outline-primary"
                                    }`}
                                aria-label={isFlagMode ? "当前标记模式，点击切换到挖掘模式" : "当前挖掘模式，点击切换到标记模式"}
                                aria-pressed={isFlagMode}
                                data-testid="minesweeper-mobile-mode-toggle"
                            >
                                {isFlagMode ? <Flag className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
                                {isFlagMode ? "旗" : "挖"}
                            </button>
                        </div>
                    </div>

                    {/* Desktop controls */}
                    <div className="mb-3 hidden flex-col gap-3 rounded-sm border border-border/70 bg-background/60 p-2.5 shadow-inner sm:mb-4 lg:flex lg:flex-row lg:items-center lg:justify-between lg:p-3">
                        <div className="flex justify-center gap-1 rounded-xs border border-primary/20 bg-primary/10 p-1">
                            {(["beginner", "intermediate", "expert"] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => changeDifficulty(level)}
                                    className={`min-h-10 px-3 py-2 text-sm font-bold rounded-xs transition-all sm:min-h-9 sm:px-4 sm:py-1.5 ${difficultyName === level
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }`}
                                >
                                    {DIFF_LABELS[level].label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
                            <div className="flex min-h-10 items-center gap-2 rounded-xs border border-border bg-background/80 px-3 font-mono text-xl text-destructive sm:min-h-9">
                                <Flag className="w-4 h-4" />
                                {formatMineCounter(minesLeft)}
                            </div>
                            <button
                                onClick={resetGame}
                                aria-label="重新开始扫雷"
                                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-500 hover:rotate-180 hover:opacity-90 sm:h-9 sm:w-9"
                            >
                                {status === "lost" ? <Bomb size={20} /> : status === "won" ? <Trophy size={20} /> : <RefreshCw size={20} />}
                            </button>
                            <div className="flex flex-col items-center gap-0.5 sm:items-end">
                                <div className="flex min-h-10 items-center gap-2 rounded-xs border border-border bg-background/80 px-3 font-mono text-xl text-primary sm:min-h-9">
                                    <Timer className="w-4 h-4" />
                                    {time.toString().padStart(3, "0")}
                                </div>
                                {currentBest !== undefined && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                        最佳 {formatTime(currentBest)}
                                        {isNewRecord && status === "won" && (
                                            <span className="ml-1 text-yellow-500 font-bold animate-pulse">★新纪录!</span>
                                        )}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 rounded-sm border border-border/50 bg-muted/60 p-1" aria-label="操作模式">
                                <button
                                    onClick={() => setIsFlagMode(false)}
                                    className={`flex min-h-10 items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-bold transition-all duration-300 sm:min-h-9 ${!isFlagMode ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                    aria-label="挖掘模式"
                                    aria-pressed={!isFlagMode}
                                >
                                    <MousePointerClick className="w-4 h-4" />
                                    <span>挖掘</span>
                                </button>
                                <button
                                    onClick={() => setIsFlagMode(true)}
                                    className={`flex min-h-10 items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-bold transition-all duration-300 sm:min-h-9 ${isFlagMode ? "bg-destructive/10 text-destructive shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                    aria-label="标记模式"
                                    aria-pressed={isFlagMode}
                                >
                                    <Flag className="w-4 h-4" />
                                    <span>标记</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {hintFeedback ? (
                        <div
                            id="minesweeper-hint-feedback"
                            role="status"
                            aria-live="polite"
                            className={`mb-2 flex items-start gap-2 rounded-sm border px-3 py-2 text-sm font-medium ${hintFeedback.kind === "clue"
                                ? "border-primary/35 bg-primary/10 text-foreground"
                                : "border-border bg-background/85 text-foreground"
                                }`}
                        >
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{hintFeedback.message}</span>
                        </div>
                    ) : null}

                    {/* Board Wrapper */}
                    <div className="w-full overflow-x-auto overscroll-x-contain no-scrollbar touch-pan-x touch-pan-y pb-1" aria-label="扫雷棋盘，可横向滑动查看大棋盘">
                        <div className={`minesweeper-board-frame mx-0 sm:mx-auto ${isBeginner ? "w-full max-w-[406px] sm:w-max sm:max-w-none" : "w-max"}`}>
                            <AnimatePresence>
                                {status === "lost" && (
                                    <motion.div
                                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-destructive/10 rounded-sm"
                                    >
                                        <div className="bg-background/95 px-5 py-3 sm:px-10 sm:py-6 rounded-lg border border-destructive/50 text-destructive font-black text-xl sm:text-3xl shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)] flex items-center gap-4">
                                            <Bomb className="w-8 h-8 sm:w-10 sm:h-10" /> 游戏结束
                                        </div>
                                    </motion.div>
                                )}
                                {status === "won" && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 backdrop-blur-md rounded-sm"
                                    >
                                        <div className="bg-background/95 px-5 py-3 sm:px-10 sm:py-6 rounded-lg border border-primary/50 shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)] flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-3 text-primary font-black text-xl sm:text-3xl">
                                                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" /> 恭喜通关！
                                            </div>
                                            <div className="text-sm text-muted-foreground font-medium">
                                                耗时 <span className="text-primary font-bold">{formatTime(time)}</span>
                                                {isNewRecord && (
                                                    <span className="ml-2 text-yellow-500 font-black animate-pulse">★ 新纪录！</span>
                                                )}
                                                {!isNewRecord && currentBest !== undefined && (
                                                    <span className="ml-2 text-muted-foreground">最佳 {formatTime(currentBest)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div className="minesweeper-grid">
                                {board.map((row, rIdx) => (
                                    <div key={rIdx}>
                                        {row.map((cell, cIdx) => (
                                            <div
                                            key={`${rIdx}-${cIdx}`}
                                            id={`minesweeper-cell-${rIdx}-${cIdx}`}
                                            role="button"
                                            tabIndex={status === "won" || status === "lost" ? -1 : 0}
                                            aria-label={getCellLabel(rIdx, cIdx)}
                                            aria-pressed={cell.isFlagged}
                                            aria-describedby={hintFeedback?.row === rIdx && hintFeedback.col === cIdx ? "minesweeper-hint-feedback" : undefined}
                                            onClick={() => activateCell(rIdx, cIdx)}
                                            onKeyDown={(event) => {
                                                if (event.key !== "Enter" && event.key !== " ") return
                                                event.preventDefault()
                                                activateCell(rIdx, cIdx)
                                            }}
                                            onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
                                                e.preventDefault()
                                                toggleFlag(rIdx, cIdx, e)
                                            }}
                                            onPointerDown={(event) => startLongPress(event, rIdx, cIdx, cell.isRevealed)}
                                            onPointerMove={moveLongPress}
                                            onPointerUp={finishLongPress}
                                            onPointerCancel={finishLongPress}
                                            className={`minesweeper-cell
                        ${isBeginner ? "h-auto w-auto min-w-0 flex-1 aspect-square" : "h-11 w-11"} sm:h-11 sm:w-11
                        ${cell.isRevealed
                                                    ? cell.isMine
                                                        ? "minesweeper-cell-mine"
                                                        : "minesweeper-cell-revealed text-foreground"
                                                    : "minesweeper-cell-hidden"
                                                }
                        ${hintFeedback?.row === rIdx && hintFeedback.col === cIdx
                                                    ? "z-[5] ring-4 ring-inset ring-yellow-400 outline-2 outline-offset-[-6px] outline-black/70"
                                                    : ""
                                                }
                      `}
                                            >
                                            {cell.isRevealed ? (
                                                cell.isMine ? (
                                                    <Bomb size={20} />
                                                ) : (
                                                    <span className={`${getNumberColor(cell.neighborMines)} drop-shadow-xs`}>
                                                        {cell.neighborMines > 0 ? cell.neighborMines : ""}
                                                    </span>
                                                )
                                            ) : cell.isFlagged ? (
                                                <Flag size={18} className="text-destructive transition-transform scale-110 drop-shadow-xs" />
                                            ) : (
                                                ""
                                            )}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧知识面板 */}
            <div className="w-full xl:w-80 2xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-20">
                <div className="flex border-b border-border">
                    <button
                        onClick={() => setActiveTab("course")}
                        className={`flex-1 py-5 text-sm font-bold transition-all ${activeTab === "course" ? "text-primary bg-primary/5 border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        课程
                    </button>
                    <button
                        onClick={() => setActiveTab("leaderboard")}
                        className={`flex-1 py-5 text-sm font-bold transition-all ${activeTab === "leaderboard" ? "text-primary bg-primary/5 border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        个人记录
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin flex flex-col">
                    {activeTab === "course" ? (
                        <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
                            <div className="w-16 h-16 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                                <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">扫雷解局学</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">9 课图解 + 每课练习，从"法则一"到"1-2-1定式"。</p>
                            <Link
                                href="/playground/minesweeper/course"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-sm bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                            >
                                进入课程
                                <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-foreground mb-1">本地最佳记录</h3>
                                <p className="text-xs text-muted-foreground mb-4">记录保存在浏览器本地，刷新后依然有效。</p>
                            </div>

                            {(["beginner", "intermediate", "expert"] as const).map((level) => {
                                const best = bestTimes[level]
                                const info = DIFF_LABELS[level]
                                const diffInfo = DIFFICULTIES[level]
                                const isCurrent = difficultyName === level
                                return (
                                    <div
                                        key={level}
                                        className={`p-4 rounded-md border transition-all ${isCurrent ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border"}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${info.color}`}>{info.label}</span>
                                                {isCurrent && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">当前</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{diffInfo.rows}×{diffInfo.cols} · {diffInfo.mines}雷</span>
                                        </div>
                                        {best !== undefined ? (
                                            <div className="flex items-center gap-2">
                                                <Medal className="w-4 h-4 text-yellow-500" />
                                                <span className="font-mono font-black text-lg text-foreground">{formatTime(best)}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">历史最佳</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-muted-foreground/60">
                                                <Star className="w-4 h-4" />
                                                <span className="text-sm">暂无记录，通关后解锁</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            <div className="mt-6 p-4 rounded-md border border-border bg-muted/10">
                                <div className="flex items-start gap-3">
                                    <Trophy className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground/70">全服排行榜</h4>
                                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                                            和全球玩家竞速即将上线！完成更多课程关卡、解锁扫雷专属徽章吧。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
