"use client"

import { useEffect, useState } from "react"
import { useGomoku, type GomokuMode } from "@/hooks/playground/use-gomoku"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sparkles, Brain, RefreshCw, Target, User, Bot, Trophy } from "lucide-react"
import confetti from "canvas-confetti"

function formatRatio(win: number, total: number) {
    if (total === 0) return "—"
    return `${Math.round((win / total) * 100)}%`
}

export default function GomokuPage() {
    const [mode, setMode] = useState<GomokuMode>("pve")
    const { board, currentPlayer, status, winnerInfo, moveCount, stats, resetGame, makeMove } = useGomoku(mode)
    const { checkBadges } = useGamification()

    const handleRestart = () => {
        resetGame()
    }

    const handleModeChange = (next: GomokuMode) => {
        setMode(next)
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
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">五子棋 · 博弈论实验室</h1>
                            <p className="text-[11px] sm:text-sm text-muted-foreground">
                                体验「极小极大算法」如何在 15×15 棋盘上做出决策。
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                            size="sm"
                            variant={mode === "pvp" ? "default" : "outline"}
                            className={cn(
                                "flex items-center gap-1 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm h-8",
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
                                "flex items-center gap-1 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm h-8",
                                mode === "pve" && "shadow-md shadow-primary/30"
                            )}
                            onClick={() => handleModeChange("pve")}
                        >
                            <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                            AI
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-8 w-8"
                            onClick={handleRestart}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

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
                        <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-400 dark:border-gray-500" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">
                        {status === "idle" && "点击棋盘开始"}
                        {status === "playing" && (mode === "pve" ? "你下黑子" : "轮流落子")}
                        {status === "draw" && "平局"}
                        {status === "won" && winnerLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 ml-auto tabular-nums">{moveCount} 手</span>
                </div>

                <div className="w-full max-w-4xl flex flex-col md:flex-row gap-4 sm:gap-6 items-start">
                    {/* Board: CSS Grid 自适应宽度 */}
                    <div className="w-full md:flex-1 min-w-0">
                        <div className="w-full aspect-square max-w-[480px] mx-auto md:max-w-none rounded-2xl border border-amber-900/20 dark:border-amber-200/10 p-1 sm:p-2 shadow-inner bg-gradient-to-br from-amber-100 to-amber-200/80 dark:from-amber-950/40 dark:to-amber-900/30">
                            <div className="grid grid-cols-[repeat(15,1fr)] grid-rows-[repeat(15,1fr)] w-full h-full">
                                {board.flat().map((cell) => {
                                    const isWinnerCell =
                                        winnerInfo?.line?.some((p) => p.row === cell.row && p.col === cell.col) ??
                                        false
                                    return (
                                        <button
                                            key={`${cell.row}-${cell.col}`}
                                            onClick={() => handleCellClick(cell.row, cell.col)}
                                            className={cn(
                                                "border border-amber-800/15 dark:border-amber-300/10 flex items-center justify-center rounded-[1px] sm:rounded-sm transition-colors duration-100 aspect-square",
                                                "bg-amber-200/40 dark:bg-amber-900/20 hover:bg-amber-300/50 dark:hover:bg-amber-800/30 active:bg-amber-300/70",
                                                isWinnerCell && "ring-1 sm:ring-2 ring-primary ring-offset-0 sm:ring-offset-1 ring-offset-amber-100 dark:ring-offset-amber-950"
                                            )}
                                        >
                                            {cell.value === "black" ? (
                                                <div className="w-[70%] h-[70%] rounded-full bg-gray-900 dark:bg-gray-100 shadow-sm sm:shadow-md shadow-black/40 border border-gray-700 dark:border-gray-300" />
                                            ) : cell.value === "white" ? (
                                                <div className="w-[70%] h-[70%] rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-sm sm:shadow-md shadow-black/25 border sm:border-2 border-gray-400 dark:border-gray-500" />
                                            ) : null}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
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
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-white to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-md border-2 border-gray-400 dark:border-gray-500" />
                                </div>
                                <div className="ml-2 text-xs text-muted-foreground">
                                    {status === "idle" && "在任意交点落子开始对局"}
                                    {status === "playing" && (mode === "pve" ? "你下黑子，AI 下白子" : "轮流点击落子")}
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
                                规则：先在任意交点落子，连成 5 子（横/竖/斜线均可）即获胜。
                            </div>
                        </Card>

                        <Card className="p-4 bg-background/80 border-border/80 space-y-2">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Brain className="w-4 h-4 text-primary" />
                                <div>
                                    <p className="text-xs font-semibold leading-none">极小极大算法 · 快速导览</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        电脑假设你和它都「完美理性」，它选择让自己最不吃亏的那一步。
                                    </p>
                                </div>
                            </div>
                            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                                <li>1. 它枚举附近所有候选落点，假设自己下这一子。</li>
                                <li>2. 再假设你在它落子后做出最优反击。</li>
                                <li>3. 来回模拟 2～3 手，看哪些局面对自己最有利。</li>
                            </ul>
                        </Card>

                        <Card className="p-4 bg-background/80 border-border/80 space-y-2">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                <span className="text-xs font-semibold">本地战绩（仅当前浏览器）</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                                <div className="flex flex-col rounded-lg bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">总对局</span>
                                    <span className="text-sm font-semibold">{stats.totalGames}</span>
                                </div>
                                <div className="flex flex-col rounded-lg bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">胜率</span>
                                    <span className="text-sm font-semibold">
                                        {formatRatio(stats.wins, stats.totalGames)}
                                    </span>
                                </div>
                                <div className="flex flex-col rounded-lg bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">最佳步数</span>
                                    <span className="text-sm font-semibold">
                                        {stats.bestMoves ? `${stats.bestMoves} 手` : "—"}
                                    </span>
                                </div>
                                <div className="flex flex-col rounded-lg bg-muted/40 px-2 py-1.5">
                                    <span className="text-muted-foreground">当前步数</span>
                                    <span className="text-sm font-semibold">{moveCount}</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Right panel: concepts + tips */}
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-10">
                <Tabs defaultValue="concepts" className="flex-1 flex flex-col">
                    <div className="border-b border-border px-4 pt-3">
                        <TabsList className="grid grid-cols-2 w-full bg-muted/40">
                            <TabsTrigger value="concepts" className="text-xs sm:text-sm">
                                概念讲解
                            </TabsTrigger>
                            <TabsTrigger value="tips" className="text-xs sm:text-sm">
                                对局小贴士
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                        <TabsContent value="concepts" className="m-0 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-primary" />
                                    什么是极小极大算法？
                                </h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    在零和博弈（你赢它就输）中，AI
                                    会假设：轮到自己走时要让「最终结果尽量大」，轮到对手走时要让「最终结果尽量小」。在有限深度内反复模拟，就能评估每一步带来的后果。
                                </p>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold text-muted-foreground/80">这个 Demo 做了哪些简化？</h3>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>只向周围有棋子的交点扩展候选落子，避免全盘暴力搜索。</li>
                                    <li>评估函数用「最长连子长度」粗略代表局面优劣。</li>
                                    <li>搜索深度限制在 2～3 手，保证浏览器也能流畅运行。</li>
                                </ul>
                            </div>
                        </TabsContent>
                        <TabsContent value="tips" className="m-0 space-y-3">
                            <div className="space-y-1.5">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    实战小技巧
                                </h2>
                                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>优先在已有棋型附近落子，连成「活三」「活四」。</li>
                                    <li>同时关注自己和对手的「四连」威胁，必要时先防守再进攻。</li>
                                    <li>多观察 AI 的落子模式，思考它在「想象」什么局面。</li>
                                </ul>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}

