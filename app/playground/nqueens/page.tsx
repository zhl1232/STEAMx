"use client"

import { useEffect, useState, useMemo } from "react"
import { useNQueens, type NQueensMode, type NQueensSpeed, type CellState } from "@/hooks/playground/use-nqueens"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Crown,
    Play,
    Pause,
    RotateCcw,
    Eye,
    Zap,
    Brain,
    Sparkles,
    Trophy,
    Timer,
    Minus,
    Plus,
    Hand,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

const SPEED_LABELS: Record<NQueensSpeed, string> = {
    slow: "慢",
    normal: "中",
    fast: "快",
}

const SOLUTION_COUNTS: Record<number, number> = {
    4: 2, 5: 10, 6: 4, 7: 40, 8: 92, 9: 352, 10: 724, 11: 2680, 12: 14200,
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function cellSizeForN(n: number, isMobile: boolean): number {
    if (isMobile) {
        if (n <= 8) return 44
        if (n <= 10) return 34
        return 28
    }
    if (n <= 6) return 56
    if (n <= 8) return 48
    if (n <= 10) return 40
    return 36
}

function CellOverlay({ state, size }: { state: CellState; size: number }) {
    const crownSize = Math.max(14, size * 0.5)

    switch (state) {
        case "queen":
            return (
                <div className="absolute inset-0 flex items-center justify-center bg-amber-500/30 z-10">
                    <div className="relative">
                        <Crown
                            className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                            style={{ width: crownSize, height: crownSize }}
                        />
                    </div>
                </div>
            )
        case "attacking":
            return <div className="absolute inset-0 bg-red-500/15 z-10" />
        case "trying":
            return <div className="absolute inset-0 bg-blue-400/30 ring ring-blue-400 animate-pulse z-10" />
        case "backtracked":
            return <div className="absolute inset-0 bg-muted/30 opacity-40 z-10" />
        case "safe":
            return <div className="absolute inset-0 bg-emerald-500/15 z-10" />
        default:
            return null
    }
}

export default function NQueensPage() {
    const {
        n,
        cellStates,
        mode,
        status,
        isVisualizationPaused,
        speed,
        time,
        totalSteps,
        backtracks,
        solutionCount,
        stats,
        setN,
        setMode,
        setSpeed,
        toggleCell,
        startVisualization,
        pauseVisualization,
        resumeVisualization,
        reset,
    } = useNQueens()

    const { checkBadges } = useGamification()
    const [activeTab, setActiveTab] = useState<"concepts" | "stats">("concepts")
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const mql = window.matchMedia("(max-width: 640px)")
        setIsMobile(mql.matches)
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mql.addEventListener("change", handler)
        return () => mql.removeEventListener("change", handler)
    }, [])

    useEffect(() => {
        if (status !== "solved" || mode !== "manual") return
        void confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
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
            nqueensManualSolves: stats.manualSolves,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, mode])

    const cellSize = useMemo(() => cellSizeForN(n, isMobile), [n, isMobile])
    const boardSize = cellSize * n

    const isVisualizing = status === "visualizing"
    const canInteract = mode === "manual" && status !== "solved"

    return (
        <div className="playground-game-page">
            {/* Left: Game area */}
            <div className="playground-game-main playground-game-center overflow-hidden">
                <div className="max-w-full lg:max-w-3xl w-full playground-game-board relative">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-amber-500/10 border border-amber-500/40 flex items-center justify-center shrink-0">
                                <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                    N 皇后 · 回溯与剪枝
                                </h1>
                                <p className="text-[11px] sm:text-sm text-muted-foreground">
                                    在 N×N 棋盘上放置 N 个皇后，使其互不攻击。
                                </p>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-11 w-11 self-end sm:h-8 sm:w-8 sm:self-auto"
                            onClick={reset}
                            aria-label="重置棋盘"
                            title="重置"
                        >
                            <RotateCcw className="w-4 h-4" aria-hidden />
                        </Button>
                    </div>

                    {/* Controls bar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-background/60 p-3 sm:p-4 rounded-sm border border-border shadow-inner">
                        {/* N selector */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">N</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-xs sm:h-7 sm:w-7"
                                disabled={n <= 4 || isVisualizing}
                                onClick={() => setN(n - 1)}
                                aria-label="减少棋盘大小"
                            >
                                <Minus className="w-3 h-3" aria-hidden />
                            </Button>
                            <span className="text-sm font-black text-foreground font-mono w-5 text-center">
                                {n}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-xs sm:h-7 sm:w-7"
                                disabled={n >= 12 || isVisualizing}
                                onClick={() => setN(n + 1)}
                                aria-label="增加棋盘大小"
                            >
                                <Plus className="w-3 h-3" aria-hidden />
                            </Button>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Mode toggle */}
                        <div className="flex items-center bg-muted/40 rounded-xs overflow-hidden border border-border">
                            {(["manual", "visualize"] as NQueensMode[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMode(m)}
                                    disabled={isVisualizing}
                                    className={cn(
                                        "min-h-11 px-3 py-1 text-[10px] sm:min-h-0 sm:px-2.5 sm:text-xs font-medium transition-colors flex items-center gap-1",
                                        mode === m
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground",
                                        isVisualizing && "cursor-not-allowed opacity-60",
                                    )}
                                >
                                    {m === "manual" ? <Hand className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                    {m === "manual" ? "手动" : "可视化"}
                                </button>
                            ))}
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Timer (manual) or step counters (visualize) */}
                        {mode === "manual" ? (
                            <div className="flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-xs font-mono font-bold text-foreground">
                                    {formatTime(time)}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                <div className="flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-blue-500" />
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                                        步骤: <span className="font-bold text-foreground font-mono">{totalSteps}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3 text-orange-500" />
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                                        回溯: <span className="font-bold text-foreground font-mono">{backtracks}</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Crown className="w-3 h-3 text-amber-500" />
                                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                                        解: <span className="font-bold text-foreground font-mono">{solutionCount}</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex-1" />

                        {/* Visualize mode controls */}
                        {mode === "visualize" && (
                            <div className="flex items-center gap-1.5">
                                {!isVisualizing && status !== "solved" && status !== "no_solution" ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-h-11 rounded-xs text-xs gap-1 px-3 sm:h-7 sm:min-h-0 sm:px-2.5"
                                        onClick={startVisualization}
                                    >
                                        <Play className="w-3 h-3" />
                                        开始
                                    </Button>
                                ) : isVisualizing ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="min-h-11 rounded-xs text-xs gap-1 px-3 sm:h-7 sm:min-h-0 sm:px-2.5"
                                        onClick={isVisualizationPaused ? resumeVisualization : pauseVisualization}
                                    >
                                        {isVisualizationPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                        {isVisualizationPaused ? "继续" : "暂停"}
                                    </Button>
                                ) : null}

                                {/* Speed selector */}
                                <div className="flex items-center bg-muted/40 rounded-xs overflow-hidden border border-border">
                                    {(["slow", "normal", "fast"] as NQueensSpeed[]).map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setSpeed(s)}
                                            className={cn(
                                                "min-h-11 px-3 py-1 text-[10px] font-medium transition-colors sm:min-h-0 sm:px-2",
                                                speed === s
                                                    ? "bg-primary text-primary-foreground"
                                                    : "text-muted-foreground hover:text-foreground",
                                            )}
                                        >
                                            {SPEED_LABELS[s]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chess Board */}
                    <div className="relative overflow-x-auto no-scrollbar touch-pan-x bg-muted/20 rounded-md p-3 sm:p-5 border border-border shadow-xl" aria-label="N 皇后棋盘，可横向滑动查看大棋盘">
                        <div className="flex items-center justify-start sm:justify-center">
                            <div
                                className="grid border border-amber-900/30 rounded-xs overflow-hidden shadow-lg"
                                style={{
                                    gridTemplateColumns: `repeat(${n}, ${cellSize}px)`,
                                    gridTemplateRows: `repeat(${n}, ${cellSize}px)`,
                                    width: boardSize,
                                    height: boardSize,
                                }}
                            >
                                {Array.from({ length: n * n }, (_, i) => {
                                    const row = Math.floor(i / n)
                                    const col = i % n
                                    const isLight = (row + col) % 2 === 0
                                    const state = cellStates[row]?.[col] ?? "empty"

                                    return (
                                        <button
                                            key={`${row}-${col}`}
                                            className={cn(
                                                "relative transition-colors duration-150",
                                                isLight
                                                    ? "bg-amber-100/80 dark:bg-amber-900/20"
                                                    : "bg-amber-800/20 dark:bg-amber-800/40",
                                                canInteract && "cursor-pointer hover:brightness-110",
                                                !canInteract && "cursor-default",
                                            )}
                                            style={{ width: cellSize, height: cellSize }}
                                            onClick={() => canInteract && toggleCell(row, col)}
                                            disabled={!canInteract}
                                        >
                                            <CellOverlay state={state} size={cellSize} />
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Solved overlay (manual) */}
                        <AnimatePresence>
                            {status === "solved" && mode === "manual" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-20 flex items-center justify-center bg-amber-500/10 backdrop-blur-md rounded-md"
                                >
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-background/95 px-6 py-5 sm:px-10 sm:py-8 rounded-lg border border-amber-400/50 shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)] flex flex-col items-center gap-3"
                                    >
                                        <div className="flex items-center gap-2 text-amber-500">
                                            <Trophy className="w-8 h-8 animate-bounce" />
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <span className="text-xl sm:text-2xl font-black text-foreground">
                                            恭喜通关！
                                        </span>
                                        <div className="text-sm text-muted-foreground space-y-0.5 text-center">
                                            <div>
                                                棋盘: <span className="text-foreground font-bold">{n}×{n}</span>
                                            </div>
                                            <div>
                                                用时: <span className="text-foreground font-bold">{formatTime(time)}</span>
                                            </div>
                                        </div>
                                        <Button onClick={reset} className="mt-2 gap-2">
                                            <RotateCcw className="w-4 h-4" />
                                            再来一局
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Visualization complete banner */}
                        <AnimatePresence>
                            {(status === "solved" || status === "no_solution") && mode === "visualize" && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute inset-x-3 sm:inset-x-5 bottom-3 sm:bottom-5 z-20 bg-background/95 backdrop-blur-lg px-4 py-3 sm:px-6 sm:py-4 rounded-md border border-primary/30 shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-primary shrink-0" />
                                            <span className="text-xs sm:text-sm font-bold text-foreground">
                                                找到 <span className="text-primary font-mono">{solutionCount}</span> 个解，
                                                共 <span className="font-mono">{totalSteps}</span> 步，
                                                回溯 <span className="font-mono">{backtracks}</span> 次
                                            </span>
                                        </div>
                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={reset}>
                                            <RotateCcw className="w-3 h-3" />
                                            重置
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Hint text */}
                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
                        {mode === "manual"
                            ? "点击棋盘格子放置或移除皇后 · 每行每列每条对角线最多一个皇后"
                            : "观察回溯算法逐行尝试放置皇后，遇到冲突时回溯"}
                    </p>
                </div>
            </div>

            {/* Right: Knowledge panel */}
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-20">
                <Tabs
                    value={activeTab}
                    onValueChange={(v) => setActiveTab(v as "concepts" | "stats")}
                    className="flex flex-col h-full"
                >
                    <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0">
                        <TabsTrigger
                            value="concepts"
                            className="flex-1 py-5 text-sm font-bold rounded-none data-[state=active]:text-primary data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-muted-foreground"
                        >
                            概念讲解
                        </TabsTrigger>
                        <TabsTrigger
                            value="stats"
                            className="flex-1 py-5 text-sm font-bold rounded-none data-[state=active]:text-primary data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-muted-foreground"
                        >
                            统计
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="concepts" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary">
                                    <Brain className="w-5 h-5" />
                                    <h3 className="text-sm font-bold">什么是 N 皇后问题？</h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    在 N×N 的国际象棋棋盘上放置 N 个皇后，使得任意两个皇后都不能互相攻击——即不在同一行、同一列或同一对角线上。这是组合数学与算法设计中的经典问题。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Crown className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-foreground">皇后的攻击范围</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    国际象棋中的皇后可以沿着行、列和对角线方向移动任意格数。因此放置 N 个互不攻击的皇后，意味着每行、每列、每条对角线上最多只能有一个皇后。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-foreground">回溯算法</h4>
                                </div>
                                <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                                    <li>从第一行开始，尝试在每一列放置皇后</li>
                                    <li>放置后检查是否与已有皇后冲突</li>
                                    <li>如果安全，继续到下一行</li>
                                    <li>如果当前行所有列都冲突，回溯到上一行尝试下一个位置</li>
                                </ol>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-foreground">剪枝优化</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    在尝试放置皇后时，跳过那些会立即与已放置皇后冲突的列（同列、同对角线）。这种「剪枝」大幅减少了需要探索的搜索空间。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-violet-500" />
                                    <h4 className="text-sm font-bold text-foreground">对称性与解的数量</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    许多解可以通过旋转和翻转得到，因此实际独立解的数量更少。各 N 的解数：
                                </p>
                                <div className="grid grid-cols-3 gap-1 mt-2">
                                    {Object.entries(SOLUTION_COUNTS).map(([k, v]) => (
                                        <div key={k} className="text-[10px] text-muted-foreground text-center">
                                            <span className="font-mono font-bold text-foreground">{k}</span>
                                            <span className="mx-0.5">→</span>
                                            <span className="font-mono">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-md border border-primary/20 bg-primary/5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold text-foreground">试试可视化模式</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    切换到可视化模式，观看回溯算法如何探索搜索树！蓝色脉冲表示正在尝试的位置，红色表示冲突，绿色表示安全——直观体会算法的每一步决策。
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="stats" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-foreground mb-1">游戏统计</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-md border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.totalGames}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        总局数
                                    </span>
                                </div>
                                <div className="p-4 rounded-md border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Crown className="w-5 h-5 text-amber-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.manualSolves}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        手动通关
                                    </span>
                                </div>
                            </div>

                            {/* Best solve times per N */}
                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <Timer className="w-4 h-4 text-green-500" />
                                    最佳用时（按 N）
                                </h4>
                                <div className="space-y-1.5">
                                    {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((size) => {
                                        const best = stats.bestSolvesByN[size]
                                        return (
                                            <div
                                                key={size}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="text-muted-foreground">
                                                    {size}×{size}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "font-mono font-bold",
                                                        best != null
                                                            ? "text-foreground"
                                                            : "text-muted-foreground/40",
                                                    )}
                                                >
                                                    {best != null ? formatTime(best) : "—"}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Color legend */}
                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    颜色说明
                                </h4>
                                <div className="space-y-2">
                                    {([
                                        ["bg-amber-500/30", "皇后", "已放置的皇后位置"],
                                        ["bg-red-500/15", "攻击范围", "被皇后攻击的格子"],
                                        ["bg-blue-400/30", "正在尝试", "算法当前尝试的位置"],
                                        ["bg-muted/30 opacity-60", "已回溯", "尝试后被放弃的位置"],
                                        ["bg-emerald-500/15", "安全", "不受攻击的格子"],
                                    ] as const).map(([color, label, desc]) => (
                                        <div key={label} className="flex items-center gap-2">
                                            <div className={cn("w-4 h-4 rounded border border-border shrink-0", color)} />
                                            <div>
                                                <span className="text-xs font-bold text-foreground">{label}</span>
                                                <span className="text-[10px] text-muted-foreground ml-1">{desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 p-4 rounded-md border border-border bg-muted/10">
                                <div className="flex items-start gap-3">
                                    <Trophy className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground/70">
                                            挑战目标
                                        </h4>
                                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                                            从 4 皇后开始，逐步挑战更大的棋盘。尝试在不使用可视化提示的情况下手动完成 8 皇后——锻炼你的空间推理能力！
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}
