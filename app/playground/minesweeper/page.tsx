"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useMinesweeper, DIFFICULTIES } from "@/hooks/useMinesweeper"
import { useGamification } from "@/context/gamification-context"
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
        bestTimes,
        isNewRecord,
    } = useMinesweeper("intermediate")

    const { checkBadges } = useGamification()

    const [activeTab, setActiveTab] = useState<"course" | "leaderboard">("course")
    const [isFlagMode, setIsFlagMode] = useState(false)

    // 胜利时触发扫雷徽章检测
    useEffect(() => {
        if (status !== "won") return
        const allBestTimes = Object.values(bestTimes)
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
            minesweeperWins: Object.keys(bestTimes).length,
            minesweeperExpertWins: bestTimes["expert"] !== undefined ? 1 : 0,
            minesweeperBestTime: overallBest,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

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

    return (
        <div className="flex flex-col xl:flex-row h-full">
            {/* 左侧游戏区 */}
            <div className="flex-1 p-2 sm:p-6 xl:p-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] w-full overflow-hidden">
                <div className="max-w-full lg:max-w-max w-full bg-card/60 p-3 sm:p-6 rounded-3xl border border-border backdrop-blur-xl shadow-2xl relative">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-center justify-between min-w-full gap-4 mb-4 sm:mb-8 bg-background/60 p-4 rounded-xl border border-border shadow-inner">
                        <div className="flex gap-1 sm:gap-2 bg-primary/10 p-1.5 rounded-lg border border-primary/20">
                            {(["beginner", "intermediate", "expert"] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => changeDifficulty(level)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${difficultyName === level
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                                        }`}
                                >
                                    {DIFF_LABELS[level].label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-destructive font-mono text-2xl bg-background/80 px-4 py-1.5 rounded-lg border border-border">
                                <Flag className="w-5 h-5" />
                                {minesLeft.toString().padStart(3, "0")}
                            </div>
                            <button
                                onClick={resetGame}
                                className="w-12 h-12 flex items-center justify-center bg-primary hover:opacity-90 text-primary-foreground rounded-full transition-all hover:rotate-180 duration-500 shadow-xl shadow-primary/30 animate-pulse-glow"
                            >
                                {status === "lost" ? <Bomb size={22} /> : status === "won" ? <Trophy size={22} /> : <RefreshCw size={22} />}
                            </button>
                            <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-2 text-primary font-mono text-2xl bg-background/80 px-4 py-1.5 rounded-lg border border-border">
                                    <Timer className="w-5 h-5" />
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

                    {/* 移动端操作切换 & 提示 */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-500 w-full">
                        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border/50">
                            <button
                                onClick={() => setIsFlagMode(false)}
                                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${!isFlagMode ? "bg-background text-foreground shadow-sm scale-100" : "text-muted-foreground hover:text-foreground scale-95"}`}
                            >
                                <MousePointerClick className="w-4 h-4" />
                                <span>挖掘</span>
                            </button>
                            <button
                                onClick={() => setIsFlagMode(true)}
                                className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${isFlagMode ? "bg-destructive/10 text-destructive shadow-sm scale-100" : "text-muted-foreground hover:text-foreground scale-95"}`}
                            >
                                <Flag className="w-4 h-4" />
                                <span>标记</span>
                            </button>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/30 py-2.5 px-5 rounded-full border border-border/50 hidden md:flex items-center gap-2 shadow-inner">
                            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span>电脑端可直接 <strong className="text-foreground">右键</strong> 快速标记，移动端推荐使用 <strong className="text-foreground">上方切换</strong> 模式</span>
                        </div>
                    </div>

                    {/* Board Wrapper */}
                    <div className="w-full overflow-x-auto no-scrollbar touch-pan-x touch-pan-y pb-2">
                        <div className="relative w-max p-2 bg-background/40 rounded-2xl border border-border mx-auto shadow-xl">
                            <AnimatePresence>
                                {status === "lost" && (
                                    <motion.div
                                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-destructive/10 rounded-xl"
                                    >
                                        <div className="bg-background/95 px-5 py-3 sm:px-10 sm:py-6 rounded-3xl border border-destructive/50 text-destructive font-black text-xl sm:text-3xl shadow-2xl flex items-center gap-4">
                                            <Bomb className="w-8 h-8 sm:w-10 sm:h-10 animate-bounce" /> 游戏结束
                                        </div>
                                    </motion.div>
                                )}
                                {status === "won" && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 backdrop-blur-md rounded-xl"
                                    >
                                        <div className="bg-background/95 px-5 py-3 sm:px-10 sm:py-6 rounded-3xl border border-primary/50 shadow-2xl flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-3 text-primary font-black text-xl sm:text-3xl">
                                                <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500 animate-bounce" /> 恭喜通关！
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
                                            onClick={() => {
                                                if (cell.isRevealed) {
                                                    autoReveal(rIdx, cIdx)
                                                } else if (isFlagMode) {
                                                    toggleFlag(rIdx, cIdx)
                                                } else {
                                                    revealCell(rIdx, cIdx)
                                                }
                                            }}
                                            onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
                                                e.preventDefault()
                                                toggleFlag(rIdx, cIdx, e)
                                            }}
                                            className={`
                        w-9 h-9 sm:w-11 sm:h-11 border border-border/50 flex items-center justify-center text-base sm:text-xl font-black cursor-pointer transition-all duration-150 select-none
                        ${cell.isRevealed
                                                    ? cell.isMine
                                                        ? "bg-destructive text-destructive-foreground shadow-inner"
                                                        : "bg-muted/50 text-foreground shadow-inner"
                                                    : "bg-accent hover:bg-accent/80 hover:scale-[1.02] active:scale-95 shadow-sm border-t-white/10 border-l-white/10 dark:border-t-white/5 dark:border-l-white/5"
                                                }
                      `}
                                        >
                                            {cell.isRevealed ? (
                                                cell.isMine ? (
                                                    <Bomb size={20} />
                                                ) : (
                                                    <span className={`${getNumberColor(cell.neighborMines)} drop-shadow-sm`}>
                                                        {cell.neighborMines > 0 ? cell.neighborMines : ""}
                                                    </span>
                                                )
                                            ) : cell.isFlagged ? (
                                                <Flag size={18} className="text-destructive transition-transform scale-110 drop-shadow-sm" />
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
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-20">
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
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                                <BookOpen className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">扫雷解局学</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">9 课图解 + 每课练习，从"法则一"到"1-2-1定式"。</p>
                            <Link
                                href="/playground/minesweeper/course"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
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
                                        className={`p-4 rounded-2xl border transition-all ${isCurrent ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border"}`}
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

                            <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/10">
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
