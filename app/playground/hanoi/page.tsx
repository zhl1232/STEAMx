"use client"

import { useEffect, useState } from "react"
import { useHanoi, type HanoiPeg, type HanoiSpeed } from "@/hooks/playground/use-hanoi"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Play,
    Pause,
    RotateCcw,
    Zap,
    Trophy,
    Brain,
    Sparkles,
    Timer,
    Minus,
    Plus,
    ChevronRight,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import { KeyboardHelp } from "@/components/features/playground/keyboard-help"

const SHORTCUTS_HANOI = [
    { key: "1/A", label: "选择起点柱" },
    { key: "2/B", label: "选择辅助柱" },
    { key: "3/C", label: "选择终点柱" },
    { key: "?", label: "快捷键" },
]

const DISK_COLORS = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-400",
    "bg-green-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-pink-500",
]

const PEG_LABELS: Record<HanoiPeg, string> = {
    A: "A (起点)",
    B: "B (辅助)",
    C: "C (终点)",
}

const SPEED_LABELS: Record<HanoiSpeed, string> = {
    slow: "慢",
    normal: "中",
    fast: "快",
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function Peg({
    pegKey,
    disks,
    diskCount,
    isSelected,
    isAutoSolving,
    onClick,
}: {
    pegKey: HanoiPeg
    disks: number[]
    diskCount: number
    isSelected: boolean
    isAutoSolving: boolean
    onClick: () => void
}) {
    const maxSlots = 8

    return (
        <button
            onClick={onClick}
            disabled={isAutoSolving}
            className={cn(
                "flex-1 flex flex-col items-center relative cursor-pointer transition-all duration-200 rounded-md p-2 sm:p-3 min-w-0",
                "hover:bg-primary/5",
                isSelected && "bg-primary/10 ring-2 ring-primary/40",
                isAutoSolving && "cursor-default hover:bg-transparent",
            )}
        >
            {/* Peg label */}
            <span
                className={cn(
                    "text-[10px] sm:text-xs font-bold mb-1 sm:mb-2 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground",
                )}
            >
                {PEG_LABELS[pegKey]}
            </span>

            {/* Rod + Disks area */}
            <div className="relative w-full flex flex-col items-center" style={{ height: `${maxSlots * 22 + 16}px` }}>
                {/* Vertical rod */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 sm:w-1.5 rounded-t-full bg-muted-foreground/30" style={{ height: `${maxSlots * 22 + 8}px` }} />

                {/* Disks stacked from bottom */}
                {disks.map((disk, index) => {
                    const widthPercent = 30 + (disk / diskCount) * 65
                    const bottom = index * 22
                    return (
                        <div
                            key={`${pegKey}-${disk}`}
                            className={cn(
                                "absolute left-1/2 -translate-x-1/2 h-[20px] rounded-xs shadow-md border border-white/20 transition-all duration-300",
                                DISK_COLORS[disk - 1] ?? "bg-gray-500",
                            )}
                            style={{
                                width: `${widthPercent}%`,
                                bottom: `${bottom}px`,
                            }}
                        >
                            <span className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white/90 drop-shadow-sm">
                                {disk}
                            </span>
                        </div>
                    )
                })}
            </div>

            {/* Base */}
            <div
                className={cn(
                    "w-full h-2 sm:h-2.5 rounded-full mt-1 transition-colors duration-200",
                    isSelected ? "bg-primary/60" : "bg-muted-foreground/25",
                )}
            />
        </button>
    )
}

export default function HanoiPage() {
    const {
        pegs,
        diskCount,
        status,
        moves,
        optimalMoves,
        time,
        speed,
        stats,
        selectedPeg,
        selectPeg,
        setDiskCount,
        resetGame,
        autoSolve,
        pauseAutoSolve,
        resumeAutoSolve,
        setSpeed,
        autoSolvePaused,
    } = useHanoi()

    const { checkBadges } = useGamification()
    const [activeTab, setActiveTab] = useState<"concepts" | "stats">("concepts")

    useEffect(() => {
        if (status !== "won") return
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
            hanoiWins: stats.wins,
            hanoiPerfect: Object.entries(stats.bestMoves).some(
                ([k, v]) => v === Math.pow(2, Number(k)) - 1,
            )
                ? 1
                : 0,
            hanoiMaxDisksCleared: Math.max(0, ...Object.keys(stats.bestMoves).map(Number)),
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return

            const target = event.target
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT")
            ) {
                return
            }

            const key = event.key.toLowerCase()
            const peg =
                key === "1" || key === "a"
                    ? "A"
                    : key === "2" || key === "b"
                      ? "B"
                      : key === "3" || key === "c"
                        ? "C"
                        : null

            if (!peg) return

            event.preventDefault()
            selectPeg(peg)
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [selectPeg])

    const isAutoSolving = status === "auto_solving"

    return (
        <div className="playground-game-page">
            {/* Left: Game area */}
            <div className="playground-game-main playground-game-center relative overflow-hidden">
                <div className="max-w-full lg:max-w-2xl w-full playground-game-board relative">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                    汉诺塔 · 递归与分治
                                </h1>
                                <p className="text-[11px] sm:text-sm text-muted-foreground">
                                    将所有圆盘从起点移动到终点，体会递归的优雅。
                                </p>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-8 w-8 self-end sm:self-auto"
                            onClick={resetGame}
                            aria-label="重置游戏"
                            title="重置"
                        >
                            <RotateCcw className="w-4 h-4" aria-hidden />
                        </Button>
                    </div>

                    {/* Controls bar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-background/60 p-3 sm:p-4 rounded-sm border border-border shadow-inner">
                        {/* Disk count */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">圆盘</span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-xs"
                                disabled={diskCount <= 3 || status === "playing" || isAutoSolving}
                                onClick={() => setDiskCount(diskCount - 1)}
                                aria-label="减少圆盘数量"
                            >
                                <Minus className="w-3 h-3" aria-hidden />
                            </Button>
                            <span className="text-sm font-black text-foreground font-mono w-5 text-center">
                                {diskCount}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-xs"
                                disabled={diskCount >= 8 || status === "playing" || isAutoSolving}
                                onClick={() => setDiskCount(diskCount + 1)}
                                aria-label="增加圆盘数量"
                            >
                                <Plus className="w-3 h-3" aria-hidden />
                            </Button>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Moves */}
                        <div className="flex items-center gap-1.5">
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                                <span className="font-bold text-foreground font-mono">{moves}</span>
                                {" / "}
                                <span className="font-mono">{optimalMoves}</span>
                                <span className="text-[10px] ml-0.5">(2ⁿ−1)</span>
                            </span>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Timer */}
                        <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono font-bold text-foreground">
                                {formatTime(time)}
                            </span>
                        </div>

                        <div className="flex-1" />

                        {/* Auto-solve controls */}
                        <div className="flex items-center gap-1.5">
                            {!isAutoSolving ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-xs text-xs gap-1 px-2.5"
                                    onClick={autoSolve}
                                    disabled={status === "won"}
                                >
                                    <Zap className="w-3 h-3" />
                                    自动演示
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-xs text-xs gap-1 px-2.5"
                                    onClick={autoSolvePaused ? resumeAutoSolve : pauseAutoSolve}
                                >
                                    {autoSolvePaused ? (
                                        <Play className="w-3 h-3" />
                                    ) : (
                                        <Pause className="w-3 h-3" />
                                    )}
                                    {autoSolvePaused ? "继续" : "暂停"}
                                </Button>
                            )}

                            {/* Speed selector */}
                            <div className="flex items-center bg-muted/40 rounded-xs overflow-hidden border border-border">
                                {(["slow", "normal", "fast"] as HanoiSpeed[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSpeed(s)}
                                        className={cn(
                                            "px-2 py-1 text-[10px] font-medium transition-colors",
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
                    </div>

                    {/* Pegs area */}
                    <div className="relative bg-muted/20 rounded-md p-3 sm:p-5 border border-border shadow-xl">
                        <div className="flex gap-2 sm:gap-4">
                            {(["A", "B", "C"] as HanoiPeg[]).map((peg) => (
                                <Peg
                                    key={peg}
                                    pegKey={peg}
                                    disks={pegs[peg]}
                                    diskCount={diskCount}
                                    isSelected={selectedPeg === peg}
                                    isAutoSolving={isAutoSolving}
                                    onClick={() => selectPeg(peg)}
                                />
                            ))}
                        </div>

                        {/* Win overlay */}
                        <AnimatePresence>
                            {status === "won" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-10 flex items-center justify-center bg-amber-500/10 backdrop-blur-md rounded-md"
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
                                            {moves === optimalMoves ? "完美通关！" : "恭喜通关！"}
                                        </span>
                                        <div className="text-sm text-muted-foreground space-y-0.5 text-center">
                                            <div>
                                                步数: <span className="text-foreground font-bold">{moves}</span>
                                                {moves === optimalMoves && (
                                                    <span className="text-amber-500 ml-1 text-xs font-bold">最优解!</span>
                                                )}
                                            </div>
                                            <div>
                                                用时: <span className="text-foreground font-bold">{formatTime(time)}</span>
                                            </div>
                                        </div>
                                        <Button onClick={resetGame} className="mt-2 gap-2">
                                            <RotateCcw className="w-4 h-4" />
                                            再来一局
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Hint text */}
                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
                        点击起始柱选取顶部圆盘，再点击目标柱放下 · 大盘不能叠在小盘上
                    </p>
                    <KeyboardHelp shortcuts={SHORTCUTS_HANOI} />
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
                                    <h3 className="text-sm font-bold">什么是汉诺塔？</h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    汉诺塔是经典的递归问题：将 n 个大小不同的圆盘从起始柱 A
                                    移动到目标柱 C，每次只能移动一个圆盘，且大盘不能放在小盘上方。中间柱 B 可作辅助。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-foreground">递归解法</h4>
                                </div>
                                <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                                    <li>将上面 n−1 个圆盘从 A 移到 B（以 C 为辅助）</li>
                                    <li>将最大圆盘从 A 移到 C</li>
                                    <li>将 n−1 个圆盘从 B 移到 C（以 A 为辅助）</li>
                                </ol>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                                    这三步本身就是递归的——步骤 1 和 3 是规模更小的汉诺塔问题。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-foreground">时间复杂度</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    递推关系: T(n) = 2·T(n−1) + 1，解为 T(n) = 2ⁿ − 1。
                                    这意味着 3 个盘最少 7 步，8 个盘最少 255 步——每增加一个盘，步数翻倍加一。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-violet-500" />
                                    <h4 className="text-sm font-bold text-foreground">与二进制的联系</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    汉诺塔的每一步可以用二进制数来编码：将步骤编号写成二进制，最低位的 1
                                    所在位置就是要移动的圆盘编号。这揭示了递归结构和二进制计数之间的深层联系。
                                </p>
                            </div>

                            <div className="p-4 rounded-md border border-primary/20 bg-primary/5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Play className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold text-foreground">试试自动演示</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    点击「自动演示」可以观看递归算法一步步执行。调整速度，仔细观察圆盘的移动模式——你会看到递归的「自相似」结构。
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
                                    <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.wins}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        胜利次数
                                    </span>
                                </div>
                            </div>

                            {/* Best moves per disk count */}
                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <ChevronRight className="w-4 h-4 text-blue-500" />
                                    最佳步数（按盘数）
                                </h4>
                                <div className="space-y-1.5">
                                    {[3, 4, 5, 6, 7, 8].map((n) => {
                                        const best = stats.bestMoves[n]
                                        const optimal = (1 << n) - 1
                                        const isPerfect = best === optimal
                                        return (
                                            <div
                                                key={n}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="text-muted-foreground">
                                                    {n} 个盘
                                                </span>
                                                <span
                                                    className={cn(
                                                        "font-mono font-bold",
                                                        best != null
                                                            ? isPerfect
                                                                ? "text-amber-500"
                                                                : "text-foreground"
                                                            : "text-muted-foreground/40",
                                                    )}
                                                >
                                                    {best != null ? (
                                                        <>
                                                            {best}
                                                            <span className="text-muted-foreground font-normal">
                                                                {" "}
                                                                / {optimal}
                                                            </span>
                                                            {isPerfect && (
                                                                <span className="text-amber-500 ml-1">★</span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Best times per disk count */}
                            <div className="p-4 rounded-md border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <Timer className="w-4 h-4 text-green-500" />
                                    最佳用时（按盘数）
                                </h4>
                                <div className="space-y-1.5">
                                    {[3, 4, 5, 6, 7, 8].map((n) => {
                                        const best = stats.bestTimes[n]
                                        return (
                                            <div
                                                key={n}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className="text-muted-foreground">
                                                    {n} 个盘
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

                            <div className="mt-6 p-4 rounded-md border border-border bg-muted/10">
                                <div className="flex items-start gap-3">
                                    <Trophy className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground/70">
                                            挑战目标
                                        </h4>
                                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                                            尝试用最少步数（2ⁿ−1）完成每种盘数的挑战，获得 ★ 标记！从 3 个盘开始练习递归思维，逐步挑战更多圆盘。
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
