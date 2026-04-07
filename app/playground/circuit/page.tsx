"use client"

import { useEffect, useState } from "react"
import {
    useCircuitPuzzle,
    LEVELS,
    getConnections,
    getBulbTargets,
    getSourceControls,
    getMoveRating,
    type ComponentType,
} from "@/hooks/useCircuitPuzzle"
import { useGamification } from "@/context/gamification-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Trophy,
    Brain,
    Sparkles,
    Timer,
    Zap,
    Check,
    Lock,
    MousePointerClick,
    Star,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"

const CELL_SIZE = 72

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

const DIFFICULTY_LABELS: Record<string, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
}
const DIFFICULTY_COLORS: Record<string, string> = {
    easy: "text-green-500 bg-green-500/10",
    medium: "text-amber-500 bg-amber-500/10",
    hard: "text-red-500 bg-red-500/10",
}

function ComponentIcon({
    type,
    rotation,
    powered,
    fixed,
    active = true,
    size = CELL_SIZE,
}: {
    type: ComponentType
    rotation: number
    powered: boolean
    fixed: boolean
    active?: boolean
    size?: number
}) {
    const half = size / 2
    const pad = 8
    const wireW = 4

    const connections = getConnections(type, rotation)
    const hasTop = connections.has("top")
    const hasRight = connections.has("right")
    const hasBottom = connections.has("bottom")
    const hasLeft = connections.has("left")

    const wireColor = powered ? "#22c55e" : "#6b7280"
    const glowColor = powered ? "#22c55e40" : "transparent"

    if (type === "empty") return null

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Connection wires to edges */}
            {hasTop && (
                <line x1={half} y1={0} x2={half} y2={half} stroke={wireColor} strokeWidth={wireW} strokeLinecap="round" />
            )}
            {hasBottom && (
                <line x1={half} y1={half} x2={half} y2={size} stroke={wireColor} strokeWidth={wireW} strokeLinecap="round" />
            )}
            {hasLeft && (
                <line x1={0} y1={half} x2={half} y2={half} stroke={wireColor} strokeWidth={wireW} strokeLinecap="round" />
            )}
            {hasRight && (
                <line x1={half} y1={half} x2={size} y2={half} stroke={wireColor} strokeWidth={wireW} strokeLinecap="round" />
            )}

            {/* Component body */}
            {type === "battery" && (
                <g>
                    <rect x={half - 10} y={half - 6} width={20} height={12} rx={2} fill={active ? (powered ? "#ef4444" : "#9ca3af") : "#475569"} stroke={wireColor} strokeWidth={1.5} />
                    <text x={half} y={half + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="white">+−</text>
                    {!active && (
                        <line x1={half - 8} y1={half + 10} x2={half + 8} y2={half - 10} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
                    )}
                </g>
            )}

            {type === "bulb" && (
                <g>
                    <circle cx={half} cy={half} r={12} fill={powered ? "#fbbf24" : "#374151"} stroke={powered ? "#f59e0b" : "#6b7280"} strokeWidth={2} />
                    {powered && (
                        <circle cx={half} cy={half} r={16} fill={glowColor} />
                    )}
                    <text x={half} y={half + 3.5} textAnchor="middle" fontSize={10} fill={powered ? "#92400e" : "#9ca3af"}>💡</text>
                </g>
            )}

            {type === "resistor" && (
                <g>
                    <rect x={half - 12} y={half - 5} width={24} height={10} rx={2} fill={powered ? "#8b5cf6" : "#4b5563"} stroke={wireColor} strokeWidth={1.5} />
                    <line x1={half - 8} y1={half - 2} x2={half - 4} y2={half + 2} stroke="white" strokeWidth={1} />
                    <line x1={half - 4} y1={half + 2} x2={half} y2={half - 2} stroke="white" strokeWidth={1} />
                    <line x1={half} y1={half - 2} x2={half + 4} y2={half + 2} stroke="white" strokeWidth={1} />
                    <line x1={half + 4} y1={half + 2} x2={half + 8} y2={half - 2} stroke="white" strokeWidth={1} />
                </g>
            )}

            {type === "switch" && (
                <g>
                    <circle cx={half} cy={half - 6} r={4} fill={wireColor} />
                    <circle cx={half} cy={half + 6} r={4} fill={wireColor} />
                    <line x1={half} y1={half - 6} x2={half + 8} y2={half + 4} stroke={wireColor} strokeWidth={2.5} strokeLinecap="round" />
                </g>
            )}

            {(type === "and_gate" || type === "or_gate" || type === "not_gate") && (
                <g>
                    <rect x={half - 14} y={half - 10} width={28} height={20} rx={4} fill={powered ? "#0ea5e9" : "#374151"} stroke={wireColor} strokeWidth={1.5} />
                    <text x={half} y={half + 4} textAnchor="middle" fontSize={8} fontWeight="bold" fill="white">
                        {type === "and_gate" ? "AND" : type === "or_gate" ? "OR" : "NOT"}
                    </text>
                </g>
            )}

            {/* Fixed indicator */}
            {fixed && (
                <circle cx={size - pad} cy={pad} r={3} fill="#6b728080" />
            )}
        </svg>
    )
}

export default function CircuitPage() {
    const {
        level,
        levelIndex,
        levelCount,
        unlockedLevelCount,
        grid,
        powered,
        status,
        moves,
        time,
        stats,
        rotateCell,
        toggleSource,
        nextLevel,
        prevLevel,
        resetLevel,
    } = useCircuitPuzzle()

    const { checkBadges } = useGamification()
    const [activeTab, setActiveTab] = useState<"concepts" | "stats">("concepts")

    const logicLevels = LEVELS.filter((l) => l.hasLogicGate)
    const allLogicCleared = logicLevels.length > 0 && logicLevels.every((l) => stats.solvedLevels.includes(l.id))
    const bulbTargets = getBulbTargets(level)
    const sourceControls = getSourceControls(level)
    const bulbTargetByCell = new Map(bulbTargets.map((target) => [`${target.row},${target.col}`, target]))
    const sourceControlByCell = new Map(sourceControls.map((source) => [`${source.row},${source.col}`, source]))
    const totalStars = LEVELS.reduce((sum, currentLevel) => {
        const bestMoves = stats.bestMoves[currentLevel.id]
        return sum + (bestMoves != null ? getMoveRating(bestMoves, currentLevel.parMoves) : 0)
    }, 0)
    const perfectLevels = LEVELS.filter((currentLevel) => {
        const bestMoves = stats.bestMoves[currentLevel.id]
        return bestMoves != null && getMoveRating(bestMoves, currentLevel.parMoves) === 3
    }).length

    useEffect(() => {
        if (status !== "solved") return
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
            circuitSolved: stats.solvedCount,
            circuitLogicCleared: allLogicCleared,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    const gridWidth = level.cols * CELL_SIZE
    const gridHeight = level.rows * CELL_SIZE
    const currentRating = status === "solved" ? getMoveRating(moves, level.parMoves) : null

    return (
        <div className="flex flex-col xl:flex-row h-full">
            {/* Left: Game area */}
            <div className="flex-1 relative p-2 sm:p-6 xl:p-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] w-full overflow-hidden">
                <div className="max-w-full lg:max-w-2xl w-full bg-card/60 p-3 sm:p-6 rounded-3xl border border-border backdrop-blur-xl shadow-2xl relative">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-teal-500/10 border border-teal-400/40 flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-teal-500" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                    电路拼图 · 逻辑与电学
                                </h1>
                                <p className="text-[11px] sm:text-sm text-muted-foreground">
                                    旋转元件连通电路，点亮所有灯泡。
                                </p>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-8 w-8 self-end sm:self-auto"
                            onClick={resetLevel}
                            title="重置"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Controls bar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-background/60 p-3 sm:p-4 rounded-xl border border-border shadow-inner">
                        {/* Level navigation */}
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-lg"
                                disabled={levelIndex <= 0}
                                onClick={prevLevel}
                            >
                                <ChevronLeft className="w-3 h-3" />
                            </Button>
                            <div className="flex items-center gap-1.5 px-2">
                                <span className="text-sm font-black text-foreground font-mono">
                                    {levelIndex + 1}
                                </span>
                                <span className="text-xs text-muted-foreground">/ {levelCount}</span>
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-lg"
                                disabled={levelIndex >= unlockedLevelCount - 1 || levelIndex >= levelCount - 1}
                                onClick={nextLevel}
                            >
                                <ChevronRight className="w-3 h-3" />
                            </Button>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Level info */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">{level.name}</span>
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", DIFFICULTY_COLORS[level.difficulty])}>
                                {DIFFICULTY_LABELS[level.difficulty]}
                            </span>
                            {level.hasLogicGate && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-blue-500 bg-blue-500/10">
                                    逻辑门
                                </span>
                            )}
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-sky-600 bg-sky-500/10">
                                已解锁 {unlockedLevelCount}/{levelCount}
                            </span>
                            {stats.solvedLevels.includes(level.id) && (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                            )}
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        {/* Moves + Timer */}
                        <div className="flex items-center gap-1.5">
                            <MousePointerClick className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono font-bold text-foreground">{moves}</span>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono font-bold text-foreground">
                                {formatTime(time)}
                            </span>
                        </div>

                        <div className="w-px h-6 bg-border hidden sm:block" />

                        <div className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-xs font-mono font-bold text-foreground">
                                目标 {level.parMoves} 步
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="mb-3 px-1 space-y-1">
                        <p className="text-xs text-muted-foreground">{level.description}</p>
                        <p className="text-xs text-foreground/80">
                            挑战目标: <span className="font-semibold">{level.objective}</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            {sourceControls.map((source) => {
                                const cell = grid[source.row]?.[source.col]
                                const isOn = cell?.active ?? source.startOn
                                return (
                                    <span
                                        key={`${source.row}-${source.col}`}
                                        className={cn(
                                            "text-[10px] font-bold px-2 py-1 rounded-full border",
                                            isOn
                                                ? "text-rose-600 border-rose-500/30 bg-rose-500/10"
                                                : "text-slate-600 border-slate-500/30 bg-slate-500/10",
                                        )}
                                    >
                                        输入 {source.label}: {isOn ? "开" : "关"}
                                    </span>
                                )
                            })}
                            {bulbTargets.map((target) => (
                                <span
                                    key={`${target.row}-${target.col}`}
                                    className={cn(
                                        "text-[10px] font-bold px-2 py-1 rounded-full border",
                                        target.required === "lit"
                                            ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                            : "text-slate-600 border-slate-500/30 bg-slate-500/10",
                                    )}
                                >
                                    {target.label} {target.required === "lit" ? "亮" : "灭"}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Circuit grid */}
                    <div className="relative bg-muted/20 rounded-2xl p-3 sm:p-5 border border-border shadow-xl overflow-auto">
                        <div
                            className="mx-auto relative"
                            style={{ width: gridWidth, height: gridHeight }}
                        >
                            {/* Grid lines */}
                            <svg
                                className="absolute inset-0 pointer-events-none"
                                width={gridWidth}
                                height={gridHeight}
                            >
                                {Array.from({ length: level.rows + 1 }).map((_, i) => (
                                    <line
                                        key={`h-${i}`}
                                        x1={0}
                                        y1={i * CELL_SIZE}
                                        x2={gridWidth}
                                        y2={i * CELL_SIZE}
                                        stroke="currentColor"
                                        className="text-border"
                                        strokeWidth={0.5}
                                    />
                                ))}
                                {Array.from({ length: level.cols + 1 }).map((_, i) => (
                                    <line
                                        key={`v-${i}`}
                                        x1={i * CELL_SIZE}
                                        y1={0}
                                        x2={i * CELL_SIZE}
                                        y2={gridHeight}
                                        stroke="currentColor"
                                        className="text-border"
                                        strokeWidth={0.5}
                                    />
                                ))}
                            </svg>

                            {/* Cells */}
                            {grid.map((row, r) =>
                                row.map((cell, c) => {
                                    const bulbTarget = bulbTargetByCell.get(`${r},${c}`)
                                    return (
                                        <button
                                            key={`${r}-${c}`}
                                            className={cn(
                                                "absolute transition-all duration-150",
                                                ((cell.type !== "empty" && !cell.fixed) || (cell.type === "battery" && cell.interactive)) && status !== "solved"
                                                    ? "cursor-pointer hover:bg-primary/5 active:scale-95"
                                                    : "cursor-default",
                                                powered[r]?.[c] && "bg-green-500/5",
                                            )}
                                            style={{
                                                left: c * CELL_SIZE,
                                                top: r * CELL_SIZE,
                                                width: CELL_SIZE,
                                                height: CELL_SIZE,
                                            }}
                                            onClick={() => {
                                                if (cell.type === "battery" && cell.interactive) {
                                                    toggleSource(r, c)
                                                    return
                                                }
                                                rotateCell(r, c)
                                            }}
                                            disabled={(cell.fixed && !(cell.type === "battery" && cell.interactive)) || cell.type === "empty" || status === "solved"}
                                        >
                                            {sourceControlByCell.has(`${r},${c}`) && (
                                                <span className="absolute right-1.5 top-1.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500/15 px-1 text-[9px] font-black text-rose-600">
                                                    {sourceControlByCell.get(`${r},${c}`)?.label}
                                                </span>
                                            )}
                                            {bulbTarget && (
                                                <span
                                                    className={cn(
                                                        "absolute left-1.5 top-1.5 z-10 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black",
                                                        bulbTarget.required === "lit"
                                                            ? "bg-emerald-500/15 text-emerald-600"
                                                            : "bg-slate-500/15 text-slate-600",
                                                    )}
                                                >
                                                    {bulbTarget.label}
                                                </span>
                                            )}
                                            <ComponentIcon
                                                type={cell.type}
                                                rotation={cell.rotation}
                                                powered={powered[r]?.[c] ?? false}
                                                fixed={cell.fixed}
                                                active={cell.active ?? true}
                                                size={CELL_SIZE}
                                            />
                                        </button>
                                    )
                                }),
                            )}
                        </div>

                        {/* Win overlay */}
                        <AnimatePresence>
                            {status === "solved" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-10 flex items-center justify-center bg-teal-500/10 backdrop-blur-md rounded-2xl"
                                >
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-background/95 px-6 py-5 sm:px-10 sm:py-8 rounded-3xl border border-teal-400/50 shadow-2xl flex flex-col items-center gap-3"
                                    >
                                        <div className="flex items-center gap-2 text-teal-500">
                                            <Trophy className="w-8 h-8 animate-bounce" />
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <span className="text-xl sm:text-2xl font-black text-foreground">
                                            电路连通！
                                        </span>
                                        <div className="text-sm text-muted-foreground space-y-0.5 text-center">
                                            <div>
                                                关卡: <span className="text-foreground font-bold">{level.name}</span>
                                            </div>
                                            <div>
                                                操作: <span className="text-foreground font-bold">{moves} 次</span>
                                            </div>
                                            <div>
                                                用时: <span className="text-foreground font-bold">{formatTime(time)}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-1 pt-1">
                                                {Array.from({ length: 3 }).map((_, index) => (
                                                    <Star
                                                        key={index}
                                                        className={cn(
                                                            "w-4 h-4",
                                                            currentRating != null && index < currentRating
                                                                ? "text-amber-500 fill-amber-500"
                                                                : "text-muted-foreground/30",
                                                        )}
                                                    />
                                                ))}
                                                <span className="ml-1 text-xs">
                                                    目标 {level.parMoves} 步
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Button onClick={resetLevel} variant="outline" className="gap-2">
                                                <RotateCcw className="w-4 h-4" />
                                                再来一次
                                            </Button>
                                            {levelIndex < levelCount - 1 && (
                                                <Button onClick={nextLevel} className="gap-2">
                                                    下一关
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Hint text */}
                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
                        点击可旋转元件旋转 90° · 点击带字母的电源切换输入 · 满足所有灯泡目标状态即过关
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
                                <div className="flex items-center gap-2 text-teal-500">
                                    <Brain className="w-5 h-5" />
                                    <h3 className="text-sm font-bold">电路基础</h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    电路是电流流通的闭合路径。最简单的电路由<strong>电源</strong>（电池）、
                                    <strong>导线</strong>和<strong>用电器</strong>（灯泡）组成。
                                    电流从电池正极出发，经过导线和灯泡，回到负极——形成回路灯泡才会亮。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-foreground">欧姆定律 V = I × R</h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    电压（V）= 电流（I）× 电阻（R）。电阻越大，流过的电流越小。
                                    在本游戏中，电阻作为导通元件存在——它不阻断电路，但在真实电路中会降低电流。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-foreground">串联与并联</h4>
                                </div>
                                <ul className="text-xs text-muted-foreground leading-relaxed space-y-1.5 list-disc list-inside">
                                    <li><strong>串联</strong>：元件首尾相连，电流只有一条路径。一处断路，全部不通。</li>
                                    <li><strong>并联</strong>：元件并排连接，电流有多条路径。一条断路，其他仍通。</li>
                                </ul>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-violet-500" />
                                    <h4 className="text-sm font-bold text-foreground">逻辑门</h4>
                                </div>
                                <ul className="text-xs text-muted-foreground leading-relaxed space-y-1.5 list-disc list-inside">
                                    <li><strong>AND 门</strong>：两个输入都为 1（有电）时，输出才为 1</li>
                                    <li><strong>OR 门</strong>：任一输入为 1，输出即为 1</li>
                                    <li><strong>NOT 门</strong>：输入取反——输入 1 输出 0，输入 0 输出 1</li>
                                </ul>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                                    逻辑门是计算机的基础构建块。CPU 中的数十亿晶体管本质上就是逻辑门的组合。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold text-foreground">游戏提示</h4>
                                </div>
                                <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                                    <li>点击非固定元件旋转 90°，使端口对齐</li>
                                    <li>电流从电池出发，沿连通路径流动</li>
                                    <li>两个元件相邻的端口必须都朝向彼此才算连通</li>
                                    <li>所有灯泡都亮起就算过关</li>
                                </ol>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="stats" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-foreground mb-1">游戏统计</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.totalGames}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        总局数
                                    </span>
                                </div>
                                <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Sparkles className="w-5 h-5 text-teal-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.solvedCount}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        完成次数
                                    </span>
                                </div>
                                <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Star className="w-5 h-5 text-amber-500 mb-1 fill-amber-500" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {totalStars}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        星级总数
                                    </span>
                                </div>
                                <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                    <Sparkles className="w-5 h-5 text-sky-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {perfectLevels}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        三星关卡
                                    </span>
                                </div>
                            </div>

                            {/* Level completion status */}
                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-teal-500" />
                                    关卡进度 ({stats.solvedLevels.length}/{LEVELS.length})
                                </h4>
                                <div className="space-y-1.5">
                                    {LEVELS.map((l) => {
                                        const solved = stats.solvedLevels.includes(l.id)
                                        const unlocked = LEVELS.findIndex((candidate) => candidate.id === l.id) < unlockedLevelCount
                                        const bestTime = stats.bestTimes[l.id]
                                        const bestMoves = stats.bestMoves[l.id]
                                        const bestRating = bestMoves != null ? getMoveRating(bestMoves, l.parMoves) : 0
                                        return (
                                            <div
                                                key={l.id}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    {solved ? (
                                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                                    ) : unlocked ? (
                                                        <Zap className="w-3.5 h-3.5 text-sky-500" />
                                                    ) : (
                                                        <Lock className="w-3.5 h-3.5 text-muted-foreground/30" />
                                                    )}
                                                    <span className={cn(
                                                        "font-medium",
                                                        solved || unlocked ? "text-foreground" : "text-muted-foreground/60",
                                                    )}>
                                                        {l.name}
                                                    </span>
                                                    <span className={cn("text-[10px] px-1 py-px rounded", DIFFICULTY_COLORS[l.difficulty])}>
                                                        {DIFFICULTY_LABELS[l.difficulty]}
                                                    </span>
                                                    <span className="text-[8px] px-1 py-px rounded text-amber-600 bg-amber-500/10">
                                                        {l.parMoves} 步
                                                    </span>
                                                    {l.hasLogicGate && (
                                                        <span className="text-[8px] px-1 py-px rounded text-blue-500 bg-blue-500/10">
                                                            门
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {Array.from({ length: 3 }).map((_, index) => (
                                                            <Star
                                                                key={index}
                                                                className={cn(
                                                                    "w-3 h-3",
                                                                    index < bestRating
                                                                        ? "text-amber-500 fill-amber-500"
                                                                        : "text-muted-foreground/20",
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className={cn(
                                                        "font-mono font-bold",
                                                        bestMoves != null ? "text-foreground" : "text-muted-foreground/40",
                                                    )}>
                                                        {bestMoves != null ? `${bestMoves}步` : "—"}
                                                    </span>
                                                    <span className={cn(
                                                        "font-mono font-bold",
                                                        bestTime != null ? "text-foreground" : "text-muted-foreground/40",
                                                    )}>
                                                        {bestTime != null ? formatTime(bestTime) : "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/10">
                                <div className="flex items-start gap-3">
                                    <Trophy className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-muted-foreground/70">
                                            挑战目标
                                        </h4>
                                        <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                                            完成所有 {LEVELS.length} 个关卡！从简单的串联电路开始，逐步挑战并联和逻辑门。完成所有逻辑门关卡解锁「逻辑门大师」徽章。
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
