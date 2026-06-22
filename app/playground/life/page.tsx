"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
    evaluateLifeChallenge,
    evolveGrid,
    LIFE_CHALLENGES,
    useGameOfLife,
    type LifeChallengeResult,
} from "@/hooks/playground/use-game-of-life"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KeyboardHelp } from "@/components/features/playground/keyboard-help"
import { getCanvasMetrics } from "./canvas"
import {
    Play,
    Pause,
    SkipForward,
    Trash2,
    Shuffle,
    Dna,
    Activity,
    Zap,
    Clock,
    ChevronDown,
    Star,
    Target,
} from "lucide-react"

const ROWS = 40
const COLS = 60

const PRESET_LABELS: Record<string, string> = {
    glider: "滑翔机",
    blinker: "闪烁器",
    pulsar: "脉冲星",
    "gosper-glider-gun": "Gosper 滑翔机枪",
    "r-pentomino": "R-五联骨牌",
}

const SPEED_LABELS: Record<string, string> = {
    slow: "慢",
    normal: "中",
    fast: "快",
}

const SHORTCUTS = [
    { key: "Space", label: "运行 / 暂停" },
    { key: "N", label: "单步推进" },
    { key: "R", label: "随机" },
    { key: "C", label: "清空" },
    { key: "?", label: "快捷键" },
]

const ALIVE_COLOR = "#10b981"
const ALIVE_GLOW = "rgba(16, 185, 129, 0.35)"
const DEAD_COLOR_LIGHT = "rgba(128, 128, 128, 0.12)"
const DEAD_COLOR_DARK = "rgba(128, 128, 128, 0.15)"

export default function GameOfLifePage() {
    const {
        grid,
        generation,
        population,
        status,
        speed,
        stats,
        toggleCell,
        start,
        pause,
        step,
        clear,
        randomize,
        randomizeWithDensity,
        setSpeed,
        loadPreset,
        loadCells,
        applyGrid,
        recordChallengeResult,
        resetStats,
    } = useGameOfLife(ROWS, COLS)
    const { checkBadges } = useGamification()

    const badgeCheckedRef = useRef(false)
    useEffect(() => {
        if (status !== "running" && status !== "paused") return
        if (badgeCheckedRef.current && generation < 1000) return
        if (generation >= 1 && !badgeCheckedRef.current) badgeCheckedRef.current = true
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            gameOfLifeSessions: stats.totalSessions,
            gameOfLifeMaxGen: stats.maxGeneration,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, generation])

    const [presetOpen, setPresetOpen] = useState(false)
    const [mode, setMode] = useState<"sandbox" | "challenge">("sandbox")
    const [randomDensity, setRandomDensity] = useState(0.3)
    const [selectedChallengeId, setSelectedChallengeId] = useState(LIFE_CHALLENGES[0].id)
    const [challengeResult, setChallengeResult] = useState<LifeChallengeResult | null>(null)
    const [designSnapshot, setDesignSnapshot] = useState<boolean[][] | null>(null)
    const selectedChallenge = LIFE_CHALLENGES.find((challenge) => challenge.id === selectedChallengeId) ?? LIFE_CHALLENGES[0]

    const loadSelectedChallenge = useCallback(() => {
        setMode("challenge")
        setChallengeResult(null)
        setDesignSnapshot(null)
        if (selectedChallenge.starterCells) {
            loadCells(selectedChallenge.starterCells)
            return
        }
        clear()
    }, [clear, loadCells, selectedChallenge])

    const restoreDesign = useCallback(() => {
        if (!designSnapshot) return
        applyGrid(designSnapshot, 0)
        setDesignSnapshot(null)
        setChallengeResult(null)
    }, [applyGrid, designSnapshot])

    const runChallenge = useCallback(() => {
        // 判定始终基于摆放的"设计稿"；判定后展示演化终态，可一键恢复设计
        const design = designSnapshot ?? grid
        const result = evaluateLifeChallenge(design, selectedChallenge)
        setChallengeResult(result)
        if (result.generation > 0) {
            setDesignSnapshot(design.map((row) => [...row]))
            applyGrid(evolveGrid(design, result.generation), result.generation)
        }
        if (result.solved) {
            recordChallengeResult(selectedChallenge.id, result.stars)
            checkBadges({
                projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
                commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
                engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
                likesGiven: 0, likesReceived: 0, collectionsCount: 0,
                challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
                discussionsCreated: 0, repliesCount: 0,
                minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
                gameOfLifeSessions: stats.totalSessions,
                gameOfLifeMaxGen: stats.maxGeneration,
                gameOfLifeChallengesSolved: stats.challengesSolved.length + (stats.challengesSolved.includes(selectedChallenge.id) ? 0 : 1),
            })
        }
    }, [applyGrid, checkBadges, designSnapshot, grid, recordChallengeResult, selectedChallenge, stats])

    // ── Canvas rendering ─────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const paintingRef = useRef(false)
    const paintValueRef = useRef(true)
    const canvasMetricsRef = useRef(getCanvasMetrics(COLS, ROWS, COLS))

    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const { cssWidth, cssHeight, cellWidth, cellHeight } = canvasMetricsRef.current

        ctx.clearRect(0, 0, cssWidth, cssHeight)

        const isDark = document.documentElement.classList.contains("dark")
        const deadColor = isDark ? DEAD_COLOR_DARK : DEAD_COLOR_LIGHT

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const x = c * cellWidth
                const y = r * cellHeight
                if (grid[r][c]) {
                    ctx.shadowColor = ALIVE_GLOW
                    ctx.shadowBlur = 4
                    ctx.fillStyle = ALIVE_COLOR
                    ctx.fillRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)
                    ctx.shadowBlur = 0
                } else {
                    ctx.fillStyle = deadColor
                    ctx.fillRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)
                }
            }
        }
    }, [grid])

    useEffect(() => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const updateCanvasSize = () => {
            const rect = container.getBoundingClientRect()
            const metrics = getCanvasMetrics(rect.width, ROWS, COLS, window.devicePixelRatio)
            canvasMetricsRef.current = metrics

            canvas.width = metrics.pixelWidth
            canvas.height = metrics.pixelHeight
            canvas.style.width = `${metrics.cssWidth}px`
            canvas.style.height = `${metrics.cssHeight}px`

            const ctx = canvas.getContext("2d")
            if (ctx) {
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0)
            }
            drawGrid()
        }

        updateCanvasSize()

        const ro = new ResizeObserver(updateCanvasSize)
        ro.observe(container)
        return () => ro.disconnect()
    }, [drawGrid])

    useEffect(() => {
        drawGrid()
    }, [drawGrid])

    const getCellFromXY = useCallback(
        (clientX: number, clientY: number) => {
            const canvas = canvasRef.current
            if (!canvas) return null
            const rect = canvas.getBoundingClientRect()
            const x = clientX - rect.left
            const y = clientY - rect.top
            const cellW = rect.width / COLS
            const cellH = rect.height / ROWS
            const col = Math.floor(x / cellW)
            const row = Math.floor(y / cellH)
            if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null
            return { row, col }
        },
        [],
    )

    const beginPaint = useCallback(
        (clientX: number, clientY: number) => {
            if (status === "running") return
            const cell = getCellFromXY(clientX, clientY)
            if (!cell) return
            paintingRef.current = true
            paintValueRef.current = !grid[cell.row][cell.col]
            // 手动改格子意味着开始新的设计，丢弃旧的判定快照
            setDesignSnapshot(null)
            setChallengeResult(null)
            toggleCell(cell.row, cell.col)
        },
        [status, grid, toggleCell, getCellFromXY],
    )

    const continuePaint = useCallback(
        (clientX: number, clientY: number) => {
            if (!paintingRef.current || status === "running") return
            const cell = getCellFromXY(clientX, clientY)
            if (!cell) return
            if (grid[cell.row][cell.col] !== paintValueRef.current) {
                toggleCell(cell.row, cell.col)
            }
        },
        [status, grid, toggleCell, getCellFromXY],
    )

    const endPaint = useCallback(() => {
        paintingRef.current = false
    }, [])

    const handleCanvasMouseDown = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            e.preventDefault()
            beginPaint(e.clientX, e.clientY)
        },
        [beginPaint],
    )

    const handleCanvasMouseMove = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            continuePaint(e.clientX, e.clientY)
        },
        [continuePaint],
    )

    const handleTouchStart = useCallback(
        (e: React.TouchEvent<HTMLCanvasElement>) => {
            e.preventDefault()
            const t = e.touches[0]
            beginPaint(t.clientX, t.clientY)
        },
        [beginPaint],
    )

    const handleTouchMove = useCallback(
        (e: React.TouchEvent<HTMLCanvasElement>) => {
            e.preventDefault()
            const t = e.touches[0]
            continuePaint(t.clientX, t.clientY)
        },
        [continuePaint],
    )

    // ── Keyboard shortcuts ───────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            switch (e.key) {
                case " ":
                    e.preventDefault()
                    if (status === "running") pause()
                    else start()
                    break
                case "n":
                case "N":
                    if (status !== "running") step()
                    break
                case "r":
                case "R":
                    if (e.key === "r" || e.key === "R") randomize()
                    break
                case "c":
                case "C":
                    clear()
                    break
            }
        }
        window.addEventListener("keydown", handleKey)
        return () => window.removeEventListener("keydown", handleKey)
    }, [status, start, pause, step, randomize, clear])

    return (
        <div className="playground-game-page" onMouseUp={endPaint} onMouseLeave={endPaint}>
            <div className="playground-game-main relative xl:justify-center">
                {/* Header */}
                <div className="w-full max-w-5xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center shrink-0">
                            <Dna className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                生命游戏 · 涌现实验室
                            </h1>
                            <p className="text-[11px] sm:text-sm text-muted-foreground">
                                探索简单规则如何产生复杂行为——细胞自动机的魅力。
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="tabular-nums font-medium">{generation}</span>
                            <span className="text-muted-foreground/60">代</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                            <Activity className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="tabular-nums font-medium">{population}</span>
                            <span className="text-muted-foreground/60">存活</span>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-5xl mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2">
                    {(["sandbox", "challenge"] as const).map((nextMode) => (
                        <button
                            key={nextMode}
                            type="button"
                            onClick={() => setMode(nextMode)}
                            className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                                mode === nextMode
                                    ? "bg-emerald-500 text-white"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            {nextMode === "sandbox" ? "自由沙盒" : "挑战关卡"}
                        </button>
                    ))}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                        挑战进度 {stats.challengesSolved.length}/{LIFE_CHALLENGES.length}
                    </span>
                </div>

                {/* Controls toolbar */}
                <div className="w-full max-w-5xl flex flex-wrap items-center gap-2 mb-3">
                    <button
                        onClick={status === "running" ? pause : start}
                        className={cn(
                            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium h-8 transition-colors",
                            status === "running"
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "bg-emerald-500 text-white hover:bg-emerald-600",
                        )}
                    >
                        {status === "running" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        {status === "running" ? "暂停" : "运行"}
                    </button>

                    <button
                        onClick={step}
                        disabled={status === "running"}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                        <SkipForward className="w-3.5 h-3.5" />
                        单步
                    </button>

                    <div className="flex items-center rounded-full border border-border bg-background overflow-hidden h-8">
                        {(["slow", "normal", "fast"] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setSpeed(s)}
                                className={cn(
                                    "px-2.5 py-1 text-xs transition-colors h-full",
                                    speed === s
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "hover:bg-muted text-muted-foreground",
                                )}
                            >
                                {s === "fast" && <Zap className="w-3 h-3 inline mr-0.5" />}
                                {SPEED_LABELS[s]}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-border hidden sm:block" />

                    <div className="relative">
                        <button
                            onClick={() => setPresetOpen(!presetOpen)}
                            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted transition-colors"
                        >
                            <Dna className="w-3.5 h-3.5" />
                            预设图案
                            <ChevronDown className={cn("w-3 h-3 transition-transform", presetOpen && "rotate-180")} />
                        </button>
                        {presetOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setPresetOpen(false)} />
                                <div className="absolute top-full left-0 mt-1 z-50 bg-card/95 backdrop-blur-xl border border-border rounded-sm shadow-lg py-1 min-w-[180px]">
                                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                loadPreset(key as Parameters<typeof loadPreset>[0])
                                                setPresetOpen(false)
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => randomizeWithDensity(randomDensity)}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted transition-colors"
                    >
                        <Shuffle className="w-3.5 h-3.5" />
                        随机 {Math.round(randomDensity * 100)}%
                    </button>
                    <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                        密度
                        <input
                            type="range"
                            min="5"
                            max="60"
                            value={Math.round(randomDensity * 100)}
                            onChange={(event) => setRandomDensity(Number(event.target.value) / 100)}
                            className="w-20 accent-emerald-500"
                            aria-label="随机密度"
                        />
                    </label>
                    <button
                        onClick={clear}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted transition-colors text-destructive hover:text-destructive"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        清空
                    </button>
                </div>

                {mode === "challenge" && (
                    <div className="w-full max-w-5xl mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Target className="h-4 w-4 text-emerald-500" />
                                    <select
                                        value={selectedChallengeId}
                                        onChange={(event) => {
                                            setSelectedChallengeId(event.target.value)
                                            setChallengeResult(null)
                                            setDesignSnapshot(null)
                                        }}
                                        className="rounded-xs border border-border bg-background px-2 py-1 text-xs font-bold"
                                        aria-label="选择生命游戏挑战"
                                    >
                                        {LIFE_CHALLENGES.map((challenge) => (
                                            <option key={challenge.id} value={challenge.id}>
                                                {challenge.name}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-[11px] text-muted-foreground">
                                        预算 {selectedChallenge.maxCells} 个细胞
                                    </span>
                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: 3 }).map((_, index) => (
                                            <Star
                                                key={index}
                                                className={cn(
                                                    "h-3.5 w-3.5",
                                                    index < (stats.challengeStars[selectedChallenge.id] ?? 0)
                                                        ? "fill-amber-500 text-amber-500"
                                                        : "text-muted-foreground/30",
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-foreground">{selectedChallenge.description}</p>
                                    <p className="text-xs text-muted-foreground">{selectedChallenge.objective}</p>
                                </div>
                                {challengeResult && (
                                    <div className={cn(
                                        "rounded-xs border px-3 py-2 text-xs",
                                        challengeResult.solved
                                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                    )}>
                                        <div className="font-bold">{challengeResult.message}</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span>第 {challengeResult.generation} 代</span>
                                            <span>存活 {challengeResult.population}</span>
                                            {challengeResult.solved && (
                                                <span>获得 {challengeResult.stars} 星</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                <button
                                    type="button"
                                    onClick={loadSelectedChallenge}
                                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted"
                                >
                                    {selectedChallenge.starterCells ? "载入种子" : "清空开始"}
                                </button>
                                {designSnapshot && (
                                    <button
                                        type="button"
                                        onClick={restoreDesign}
                                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold hover:bg-muted"
                                    >
                                        恢复设计
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={runChallenge}
                                    className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
                                >
                                    {designSnapshot ? "重新判定" : "运行挑战判定"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Canvas Grid */}
                <div
                    ref={containerRef}
                    className="w-full max-w-5xl rounded-lg border border-border bg-[hsl(var(--surface-raised)/0.88)] backdrop-blur p-1 sm:p-2 shadow-inner"
                >
                    <canvas
                        ref={canvasRef}
                        className="w-full rounded-sm cursor-pointer select-none touch-none"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={endPaint}
                        onMouseLeave={endPaint}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={endPaint}
                    />
                </div>

                <KeyboardHelp shortcuts={SHORTCUTS} />
            </div>

            {/* Right panel */}
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-10">
                <Tabs defaultValue="concepts" className="flex-1 flex flex-col">
                    <div className="border-b border-border px-4 pt-3">
                        <TabsList className="grid grid-cols-3 w-full bg-muted/40">
                            <TabsTrigger value="concepts" className="text-xs sm:text-sm">
                                概念讲解
                            </TabsTrigger>
                            <TabsTrigger value="challenges" className="text-xs sm:text-sm">
                                挑战
                            </TabsTrigger>
                            <TabsTrigger value="stats" className="text-xs sm:text-sm">
                                统计
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
                        <TabsContent value="concepts" className="m-0 space-y-5">
                            <div className="space-y-2">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Dna className="w-4 h-4 text-emerald-500" />
                                    什么是生命游戏？
                                </h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    生命游戏（Game of Life）由数学家 John Conway 于 1970
                                    年发明，是一种零玩家游戏：你只需设定初始状态，之后细胞按规则自动演化。它是「细胞自动机」的经典案例。
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground/90">演化规则</h3>
                                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                                    <li>
                                        <strong>存活：</strong>一个活细胞周围有 2 或 3
                                        个活邻居时继续存活，否则死亡（孤独或拥挤）。
                                    </li>
                                    <li>
                                        <strong>繁殖：</strong>一个死细胞周围恰好有 3
                                        个活邻居时变为活细胞。
                                    </li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground/90">
                                    涌现（Emergence）
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    仅靠上面两条简单规则，就能产生滑翔机、振荡器、太空船等令人惊叹的复杂结构。这种「简单规则产生复杂行为」的现象叫做涌现——它在生物学、物理学和计算机科学中都有重要意义。
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground/90">
                                    图灵完备性
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    生命游戏被证明是图灵完备的，意味着它理论上可以模拟任何计算过程。人们甚至在其中构建了逻辑门、计数器甚至整台计算机！
                                </p>
                            </div>

                            <div className="rounded-sm bg-muted/30 p-3 space-y-1.5">
                                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    试一试
                                </h3>
                                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>加载「滑翔机」预设，观察它如何在网格上移动。</li>
                                    <li>加载「脉冲星」预设，发现周期为 3 的振荡器。</li>
                                    <li>加载「Gosper 滑翔机枪」，看一台无限发射滑翔机的「机器」。</li>
                                    <li>加载「R-五联骨牌」，看 5 个细胞如何产生长时间混沌演化。</li>
                                    <li>点击「随机」按钮，观察混沌初始条件如何自组织。</li>
                                </ul>
                            </div>
                        </TabsContent>

                        <TabsContent value="challenges" className="m-0 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Target className="w-4 h-4 text-emerald-500" />
                                    挑战关卡
                                </h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    生命游戏不是只能旁观。挑战模式会给你细胞预算、演化代数和目标，让你用最小初态设计稳定结构、振荡器、滑翔机路线或长寿群落。
                                </p>
                            </div>

                            <div className="space-y-2">
                                {LIFE_CHALLENGES.map((challenge, index) => {
                                    const stars = stats.challengeStars[challenge.id] ?? 0
                                    const solved = stats.challengesSolved.includes(challenge.id)
                                    return (
                                        <button
                                            key={challenge.id}
                                            type="button"
                                            onClick={() => {
                                                setMode("challenge")
                                                setSelectedChallengeId(challenge.id)
                                                setChallengeResult(null)
                                                setDesignSnapshot(null)
                                            }}
                                            className={cn(
                                                "w-full rounded-sm border p-3 text-left transition-colors",
                                                selectedChallenge.id === challenge.id
                                                    ? "border-emerald-500/50 bg-emerald-500/10"
                                                    : "border-border bg-muted/20 hover:bg-muted/40",
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-black text-emerald-600">
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-xs font-bold text-foreground">{challenge.name}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    {Array.from({ length: 3 }).map((_, starIndex) => (
                                                        <Star
                                                            key={starIndex}
                                                            className={cn(
                                                                "h-3 w-3",
                                                                starIndex < stars
                                                                    ? "fill-amber-500 text-amber-500"
                                                                    : "text-muted-foreground/25",
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="mt-1 text-[11px] text-muted-foreground">{challenge.objective}</p>
                                            <p className="mt-1 text-[10px] text-muted-foreground/70">
                                                {solved ? "已完成" : "未完成"} · 预算 {challenge.maxCells} 个细胞
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        </TabsContent>

                        <TabsContent value="stats" className="m-0 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-500" />
                                    本地统计
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="rounded-sm bg-muted/30 p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">总运行次数</p>
                                        <p className="text-lg font-bold tabular-nums">{stats.totalSessions}</p>
                                    </div>
                                    <Play className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                                <div className="rounded-sm bg-muted/30 p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">最高代数</p>
                                        <p className="text-lg font-bold tabular-nums">{stats.maxGeneration}</p>
                                    </div>
                                    <Clock className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                                <div className="rounded-sm bg-muted/30 p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">最大同时存活数</p>
                                        <p className="text-lg font-bold tabular-nums">{stats.maxPopulation}</p>
                                    </div>
                                    <Activity className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                                <div className="rounded-sm bg-muted/30 p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">挑战完成</p>
                                        <p className="text-lg font-bold tabular-nums">
                                            {stats.challengesSolved.length}/{LIFE_CHALLENGES.length}
                                        </p>
                                    </div>
                                    <Target className="w-5 h-5 text-muted-foreground/40" />
                                </div>
                            </div>

                            <button
                                onClick={resetStats}
                                className="w-full text-xs text-destructive hover:text-destructive/80 transition-colors py-2 rounded-xs border border-border hover:bg-muted/40"
                            >
                                重置统计数据
                            </button>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
