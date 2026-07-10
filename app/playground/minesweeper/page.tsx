"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useMinesweeper, DIFFICULTIES } from "@/hooks/playground/use-minesweeper"
import { useGamification } from '@/lib/context/gamification-context'
import { Bomb, Flag, Timer, Trophy, RefreshCw, BookOpen, ChevronRight, MousePointerClick, Medal, Star } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

const DIFF_LABELS: Record<string, { label: string; color: string; xp: number }> = {
    beginner: { label: "初级", color: "text-green-500", xp: 10 },
    intermediate: { label: "中级", color: "text-yellow-500", xp: 15 },
    expert: { label: "高级", color: "text-red-500", xp: 20 },
}

function formatTime(s: number) {
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, "0")}s`
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

    const [activeTab, setActiveTab] = useState<"course" | "leaderboard">("course")
    const [isFlagMode, setIsFlagMode] = useState(false)
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggeredRef = useRef(false)

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
        if (cell.isFlagged) return `${position}，已标记`
        if (!cell.isRevealed) return `${position}，未翻开`
        if (cell.isMine) return `${position}，地雷`
        if (cell.neighborMines > 0) return `${position}，周围 ${cell.neighborMines} 个地雷`
        return `${position}，安全空格`
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

    useEffect(() => clearLongPressTimer, [])

    return (
        <div className="playground-game-page">
            {/* 左侧游戏区 */}
            <div className="playground-game-main minesweeper-game-main overflow-hidden">
                <div className="minesweeper-game-shell max-w-full lg:max-w-max w-full relative">

                    {/* Mobile compact controls */}
                    <div className="mb-1.5 rounded-sm border border-border/60 bg-background/60 p-1.5 shadow-inner md:hidden">
                        <div className="grid grid-cols-3 gap-1 rounded-xs border border-primary/20 bg-primary/10 p-1">
                            {(["beginner", "intermediate", "expert"] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => changeDifficulty(level)}
                                    className={`min-h-10 rounded-xs px-2 text-sm font-bold transition-all ${difficultyName === level
                                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }`}
                                >
                                    {DIFF_LABELS[level].label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-1.5">
                            <div className="flex shrink-0 items-center gap-1 rounded-sm border border-border/50 bg-muted/60 p-0.5">
                                <button
                                    onClick={() => setIsFlagMode(false)}
                                    className={`flex h-10 min-w-12 items-center justify-center gap-1 rounded-xs px-2 text-sm font-bold transition-all ${!isFlagMode ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"}`}
                                    aria-label="挖掘模式"
                                    aria-pressed={!isFlagMode}
                                >
                                    <MousePointerClick className="h-4 w-4" />
                                    挖
                                </button>
                                <button
                                    onClick={() => setIsFlagMode(true)}
                                    className={`flex h-10 min-w-12 items-center justify-center gap-1 rounded-xs px-2 text-sm font-bold transition-all ${isFlagMode ? "bg-destructive/10 text-destructive shadow-xs" : "text-muted-foreground"}`}
                                    aria-label="标记模式"
                                    aria-pressed={isFlagMode}
                                >
                                    <Flag className="h-4 w-4" />
                                    旗
                                </button>
                            </div>

                            <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xs border border-border bg-background/80 px-2 font-mono text-base">
                                <Flag className="h-4 w-4 shrink-0 text-destructive" />
                                <span className="text-destructive">{minesLeft.toString().padStart(3, "0")}</span>
                                <span className="h-4 w-px bg-border" />
                                <Timer className="h-4 w-4 shrink-0 text-primary" />
                                <span className="text-primary">{time.toString().padStart(3, "0")}</span>
                            </div>

                            <button
                                onClick={resetGame}
                                aria-label="重新开始扫雷"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/25 transition-all active:scale-95"
                            >
                                {status === "lost" ? <Bomb size={19} /> : status === "won" ? <Trophy size={19} /> : <RefreshCw size={19} />}
                            </button>
                        </div>
                    </div>

                    {/* Desktop controls */}
                    <div className="mb-3 hidden flex-col gap-3 rounded-sm border border-border/70 bg-background/60 p-2.5 shadow-inner sm:mb-4 md:flex lg:flex-row lg:items-center lg:justify-between lg:p-3">
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
                            <div className="flex items-center gap-1 rounded-sm border border-border/50 bg-muted/60 p-1">
                                <button
                                    onClick={() => setIsFlagMode(false)}
                                    className={`flex min-h-10 items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-bold transition-all duration-300 sm:min-h-9 ${!isFlagMode ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <MousePointerClick className="w-4 h-4" />
                                    <span>挖掘</span>
                                </button>
                                <button
                                    onClick={() => setIsFlagMode(true)}
                                    className={`flex min-h-10 items-center gap-1.5 rounded-xs px-3 py-1.5 text-sm font-bold transition-all duration-300 sm:min-h-9 ${isFlagMode ? "bg-destructive/10 text-destructive shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
                                >
                                    <Flag className="w-4 h-4" />
                                    <span>标记</span>
                                </button>
                            </div>
                            <div className="flex min-h-10 items-center gap-2 rounded-xs border border-border bg-background/80 px-3 font-mono text-xl text-destructive sm:min-h-9">
                                <Flag className="w-4 h-4" />
                                {minesLeft.toString().padStart(3, "0")}
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
                        </div>
                    </div>

                    {/* Board Wrapper */}
                    <div className="w-full overflow-x-auto no-scrollbar touch-pan-x touch-pan-y pb-1" aria-label="扫雷棋盘，可横向滑动查看大棋盘">
                        <div className={`relative mx-0 rounded-sm border border-border/70 bg-background/40 p-1 shadow-lg sm:mx-auto sm:p-1.5 ${isBeginner ? "w-full max-w-[406px] sm:w-max sm:max-w-none" : "w-max"}`}>
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
                            {board.map((row, rIdx) => (
                                <div key={rIdx} className="flex">
                                    {row.map((cell, cIdx) => (
                                        <div
                                            key={`${rIdx}-${cIdx}`}
                                            role="button"
                                            tabIndex={status === "won" || status === "lost" ? -1 : 0}
                                            aria-label={getCellLabel(rIdx, cIdx)}
                                            aria-pressed={cell.isFlagged}
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
                                            onTouchStart={() => {
                                                clearLongPressTimer()
                                                longPressTriggeredRef.current = false
                                                if (cell.isRevealed || status === "won" || status === "lost") return
                                                longPressTimerRef.current = setTimeout(() => {
                                                    longPressTriggeredRef.current = true
                                                    toggleFlag(rIdx, cIdx)
                                                    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                                                        navigator.vibrate?.(12)
                                                    }
                                                }, 420)
                                            }}
                                            onTouchMove={clearLongPressTimer}
                                            onTouchEnd={clearLongPressTimer}
                                            onTouchCancel={clearLongPressTimer}
                                            className={`
                        ${isBeginner ? "h-auto w-auto min-w-0 flex-1 aspect-square" : "h-11 w-11"} sm:h-11 sm:w-11 border flex items-center justify-center text-base sm:text-xl font-black cursor-pointer transition-all duration-150 select-none
                        ${cell.isRevealed
                                                    ? cell.isMine
                                                        ? "bg-destructive text-destructive-foreground shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] border-destructive/80"
                                                        : "bg-background/80 text-foreground shadow-inner border-border/40"
                                                    : "bg-linear-to-br from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 border-primary/20 border-t-primary/30 border-l-primary/30 shadow-xs hover:scale-[1.02] active:scale-95"
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
