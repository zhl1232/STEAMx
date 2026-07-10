"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useGomoku, type GomokuLevel, type GomokuMode } from "@/hooks/playground/use-gomoku"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sparkles, RefreshCw, Target, User, Bot, Trophy, Globe } from "lucide-react"
import confetti from "canvas-confetti"
import { GomokuOnlineView } from "@/components/features/playground/gomoku-online-view"
import { GomokuBoard } from "@/components/features/playground/gomoku-board"

type PageMode = GomokuMode | "online"

function formatRatio(win: number, total: number) {
    if (total === 0) return "—"
    return `${Math.round((win / total) * 100)}%`
}

export default function GomokuPage() {
    return (
        <Suspense fallback={null}>
            <GomokuPageInner />
        </Suspense>
    )
}

function GomokuPageInner() {
    const searchParams = useSearchParams()
    const initialRoomCode = searchParams.get("room")
    // 带 room 参数时直接进入在线模式
    const [mode, setMode] = useState<PageMode>(initialRoomCode ? "online" : "pve")
    const [level, setLevel] = useState<GomokuLevel>("normal")
    const { checkBadges } = useGamification()
    // 在线模式下不使用 useGomoku 的产物，但仍调用以保持 hook 顺序稳定；
    // updateStats 已改为实时读 localStorage，不会用过期快照覆盖在线写入的战绩。
    const { board, currentPlayer, status, winnerInfo, moveCount, stats, resetGame, makeMove } =
        useGomoku(mode === "online" ? "pve" : mode, level)

    const handleRestart = () => {
        resetGame()
    }

    const handleModeChange = (next: PageMode) => {
        setMode(next)
        resetGame()
    }

    const handleLevelChange = (next: GomokuLevel) => {
        if (next === level) return
        setLevel(next)
        resetGame()
    }

    const handleCellClick = (row: number, col: number) => {
        if (status === "won" || status === "draw") return
        makeMove(row, col)
    }

    const winnerLabel =
        status === "won" && winnerInfo
            ? winnerInfo.winner === "black"
                ? mode === "pve"
                    ? "你获胜了！"
                    : "黑方获胜"
                : mode === "pve"
                    ? "AI 获胜"
                    : "白方获胜"
            : status === "draw"
                ? "平局"
                : null

    useEffect(() => {
        if (status === "won" && winnerInfo) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

            checkBadges({
                projectsPublished: 0,
                projectsLiked: 0,
                projectsCompleted: 0,
                commentsCount: 0,
                scienceCompleted: 0,
                techCompleted: 0,
                engineeringCompleted: 0,
                artCompleted: 0,
                mathCompleted: 0,
                likesGiven: 0,
                likesReceived: 0,
                collectionsCount: 0,
                challengesJoined: 0,
                level: 1,
                loginDays: 0,
                consecutiveDays: 0,
                discussionsCreated: 0,
                repliesCount: 0,
                minesweeperWins: 0,
                minesweeperExpertWins: 0,
                minesweeperBestTime: 999,
                gomokuWins: stats.wins,
                gomokuPvEWins: stats.gomokuPvEWins,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, winnerInfo])

    return (
        <div className="playground-game-page">
            <div className="playground-game-main xl:justify-center">
                {/* Header: title + controls */}
                <div className="w-full max-w-4xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">五子棋 · 博弈论实验室</h1>
                            <p className="text-[11px] sm:text-sm text-muted-foreground">
                                在 15×15 交点棋盘上对弈，先连成五子获胜。
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        <Button
                            size="sm"
                            variant={mode === "pvp" ? "default" : "outline"}
                            className={cn(
                                "flex min-h-11 items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:h-8 sm:min-h-0 sm:px-4 sm:text-sm",
                                mode === "pvp" && "shadow-md shadow-primary/30"
                            )}
                            onClick={() => handleModeChange("pvp")}
                        >
                            <User className="w-3 h-3 sm:w-4 sm:h-4" />
                            双人
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === "pve" ? "default" : "outline"}
                            className={cn(
                                "flex min-h-11 items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:h-8 sm:min-h-0 sm:px-4 sm:text-sm",
                                mode === "pve" && "shadow-md shadow-primary/30"
                            )}
                            onClick={() => handleModeChange("pve")}
                        >
                            <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                            AI
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === "online" ? "default" : "outline"}
                            className={cn(
                                "flex min-h-11 items-center gap-1 rounded-full px-3 py-1.5 text-xs sm:h-8 sm:min-h-0 sm:px-4 sm:text-sm",
                                mode === "online" && "shadow-md shadow-primary/30"
                            )}
                            onClick={() => handleModeChange("online")}
                        >
                            <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                            在线
                        </Button>
                        {mode === "pve" && (
                            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-0.5">
                                {(
                                    [
                                        { value: "easy", label: "入门" },
                                        { value: "normal", label: "进阶" },
                                        { value: "hard", label: "大师" },
                                    ] as const
                                ).map(({ value, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleLevelChange(value)}
                                        className={cn(
                                            "min-h-11 rounded-full px-3 py-1 text-[11px] font-medium transition-colors sm:min-h-0 sm:px-3 sm:text-xs",
                                            level === value
                                                ? "bg-primary text-primary-foreground shadow-xs"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        aria-pressed={level === value}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-11 w-11 sm:h-8 sm:w-8"
                            onClick={handleRestart}
                            aria-label="重新开始"
                        >
                            <RefreshCw className="w-4 h-4" aria-hidden />
                        </Button>
                    </div>
                </div>

                {mode === "online" ? (
                    <GomokuOnlineView initialRoomCode={initialRoomCode} />
                ) : null}

                {mode !== "online" && (
                <>
                {/* Mobile: status bar above board */}
                <div className="w-full max-w-4xl flex md:hidden items-center gap-2 mb-2 px-1">
                    <div
                        className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0",
                            currentPlayer === "black"
                                ? "border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.25)]"
                                : "border-border/60"
                        )}
                    >
                        <div className="w-3.5 h-3.5 rounded-full bg-gray-900 dark:bg-gray-100 border border-gray-700 dark:border-gray-300" />
                    </div>
                    <div
                        className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0",
                            currentPlayer === "white"
                                ? "border-primary shadow-[0_0_0_2px_rgba(59,130,246,0.25)]"
                                : "border-border/60"
                        )}
                    >
                        <div className="w-3.5 h-3.5 rounded-full bg-linear-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-400 dark:border-gray-500" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">
                        {status === "idle" && "先点交点定位，再点一次确认"}
                        {status === "playing" &&
                            (mode === "pve"
                                ? currentPlayer === "white"
                                    ? "AI 思考中…"
                                    : "你下黑子，二次确认落子"
                                : "轮流二次确认落子")}
                        {status === "draw" && "平局"}
                        {status === "won" && winnerLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">{moveCount} 手</span>
                </div>

                <div className="w-full max-w-4xl flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
                    {/* Board: CSS Grid 自适应宽度 */}
                    <div className="-mx-3 w-[calc(100%+1.5rem)] min-w-0 md:mx-0 md:w-full md:flex-1">
                        <GomokuBoard
                            board={board}
                            winLine={winnerInfo?.line}
                            onCellClick={handleCellClick}
                            disabled={
                                status === "won" ||
                                status === "draw" ||
                                (mode === "pve" && currentPlayer === "white")
                            }
                        />
                    </div>

                    {/* Desktop sidebar: status + info cards */}
                    <div className="hidden md:flex w-64 flex-col space-y-4 shrink-0">
                        <Card className="p-4 bg-background/80 border-border/80">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium text-muted-foreground">当前执棋方</span>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    THINK
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center border-2",
                                        currentPlayer === "black"
                                            ? "border-primary shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
                                            : "border-border/60"
                                    )}
                                >
                                    <div className="w-5 h-5 rounded-full bg-gray-900 dark:bg-gray-100 shadow-md border border-gray-700 dark:border-gray-300" />
                                </div>
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center border-2",
                                        currentPlayer === "white"
                                            ? "border-primary shadow-[0_0_0_3px_rgba(59,130,246,0.25)]"
                                            : "border-border/60"
                                    )}
                                >
                                    <div className="w-5 h-5 rounded-full bg-linear-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-md border-2 border-gray-400 dark:border-gray-500" />
                                </div>
                                <div className="ml-2 text-xs text-muted-foreground">
                                    {status === "idle" && "在任意交点落子开始对局"}
                                    {status === "playing" &&
                                        (mode === "pve"
                                            ? currentPlayer === "white"
                                                ? "AI 正在思考下一手"
                                                : "你下黑子，AI 下白子"
                                            : "轮流点击交点落子")}
                                    {status === "draw" && "棋盘已满，平局收场"}
                                    {status === "won" && winnerLabel && (
                                        <span className="text-primary font-semibold flex items-center gap-1">
                                            <Trophy className="w-3 h-3" />
                                            {winnerLabel}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-2 text-[11px] text-muted-foreground/80">
                                规则：棋子落在交点上，横/竖/斜任一方向连成 5 子即获胜。
                            </div>
                        </Card>

                        <Card className="p-4 bg-background/80 border-border/80 space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs font-semibold">本地战绩（仅当前浏览器）</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                                <div className="flex flex-col rounded-xs bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">总对局</span>
                                    <span className="text-sm font-semibold">{stats.totalGames}</span>
                                </div>
                                <div className="flex flex-col rounded-xs bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">胜率</span>
                                    <span className="text-sm font-semibold">
                                        {formatRatio(stats.wins, stats.totalGames)}
                                    </span>
                                </div>
                                <div className="flex flex-col rounded-xs bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">最佳步数</span>
                                    <span className="text-sm font-semibold">
                                        {stats.bestMoves ? `${stats.bestMoves} 手` : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col rounded-xs bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">当前步数</span>
                                    <span className="text-sm font-semibold">{moveCount}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
                </>
                )}
            </div>
        </div>
    )
}
