"use client"

import { useEffect, useMemo, useCallback } from "react"
import { useSudoku, type SudokuDifficulty } from "@/hooks/playground/use-sudoku"
import { useGamification } from '@/lib/context/gamification-context'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Grid3X3,
    Pencil,
    Undo2,
    Redo2,
    Trash2,
    Eye,
    RotateCcw,
    Timer,
    Trophy,
    Brain,
    Sparkles,
    CheckCircle2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import confetti from "canvas-confetti"
import { KeyboardHelp } from "@/components/features/playground/keyboard-help"

const SHORTCUTS_SUDOKU = [
    { key: "1-9", label: "填入数字" },
    { key: "Delete", label: "清除" },
    { key: "N", label: "切换笔记" },
    { key: "?", label: "快捷键" },
]

const DIFF_LABELS: Record<SudokuDifficulty, { label: string; color: string }> = {
    easy: { label: "简单", color: "text-green-500" },
    medium: { label: "中等", color: "text-yellow-500" },
    hard: { label: "困难", color: "text-red-500" },
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export default function SudokuPage() {
    const {
        board,
        initial,
        notes,
        selectedCell,
        difficulty,
        status,
        time,
        conflicts,
        stats,
        isNoteMode,
        history,
        selectCell,
        setNumber,
        clearCell,
        toggleNoteMode,
        checkErrors,
        solve,
        newGame,
        undo,
        redo,
    } = useSudoku()

    const { checkBadges } = useGamification()

    useEffect(() => {
        if (status !== "won") return
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
            sudokuWins: stats.wins,
            sudokuHardWins: stats.winsByDifficulty.hard,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!selectedCell) return
            const num = parseInt(e.key)
            if (num >= 1 && num <= 9) {
                setNumber(num)
            } else if (e.key === "Delete" || e.key === "Backspace") {
                clearCell()
            } else if (e.key === "n" || e.key === "N") {
                toggleNoteMode()
            }
        },
        [selectedCell, setNumber, clearCell, toggleNoteMode],
    )

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [handleKeyDown])

    const numberCounts = useMemo(() => {
        const counts: Record<number, number> = {}
        for (let n = 1; n <= 9; n++) counts[n] = 0
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = board[r][c]
                if (v >= 1 && v <= 9) counts[v]++
            }
        }
        return counts
    }, [board])

    const selectedValue =
        selectedCell && board[selectedCell[0]][selectedCell[1]] !== 0
            ? board[selectedCell[0]][selectedCell[1]]
            : null

    const isPlaying = status === "playing" || status === "checking"

    return (
        <div className="playground-game-page">
            {/* Left: Game area */}
            <div className="playground-game-main playground-game-center relative overflow-hidden">
                <div className="max-w-full lg:max-w-max w-full playground-game-board relative">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-primary/10 border border-primary/40 flex items-center justify-center shrink-0">
                                <Grid3X3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                    数独 · 约束满足
                                </h1>
                                <p className="text-[11px] sm:text-sm text-muted-foreground">
                                    每行、每列、每宫填入 1-9 且不重复，感受约束传播的力量。
                                </p>
                            </div>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-8 w-8 self-end sm:self-auto"
                            onClick={() => newGame()}
                            aria-label="新游戏"
                            title="新游戏"
                        >
                            <RotateCcw className="w-4 h-4" aria-hidden />
                        </Button>
                    </div>

                    {/* Controls bar */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 sm:mb-6 bg-background/60 p-3 sm:p-4 rounded-xl border border-border shadow-inner">
                        {/* Difficulty selector */}
                        <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-lg border border-primary/20">
                            {(["easy", "medium", "hard"] as SudokuDifficulty[]).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => newGame(d)}
                                    disabled={isPlaying}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                                        difficulty === d
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                                        isPlaying && difficulty !== d && "opacity-50 cursor-not-allowed",
                                    )}
                                >
                                    {DIFF_LABELS[d].label}
                                </button>
                            ))}
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

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-lg"
                                onClick={undo}
                                disabled={!history.canUndo}
                                aria-label="撤销"
                                title="撤销"
                            >
                                <Undo2 className="w-3.5 h-3.5" aria-hidden />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7 rounded-lg"
                                onClick={redo}
                                disabled={!history.canRedo}
                                aria-label="重做"
                                title="重做"
                            >
                                <Redo2 className="w-3.5 h-3.5" aria-hidden />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-lg text-xs gap-1 px-2"
                                onClick={checkErrors}
                                disabled={status === "won"}
                                title="检查错误"
                            >
                                <CheckCircle2 className="w-3 h-3" />
                                <span className="hidden sm:inline">检查</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-lg text-xs gap-1 px-2"
                                onClick={solve}
                                disabled={status === "won"}
                                title="显示答案"
                            >
                                <Eye className="w-3 h-3" />
                                <span className="hidden sm:inline">答案</span>
                            </Button>
                        </div>
                    </div>

                    {/* Board */}
                    <div className="w-full flex justify-center pb-2">
                        <div className="relative bg-background/40 rounded-2xl p-1.5 sm:p-2.5 border border-border shadow-xl">
                            <div
                                className="grid"
                                style={{ gridTemplateColumns: "repeat(9, 1fr)" }}
                            >
                                {board.map((row, rIdx) =>
                                    row.map((cellValue, cIdx) => {
                                        const isInitial = initial[rIdx][cIdx]
                                        const isSelected =
                                            selectedCell?.[0] === rIdx &&
                                            selectedCell?.[1] === cIdx
                                        const inSameRow = selectedCell?.[0] === rIdx
                                        const inSameCol = selectedCell?.[1] === cIdx
                                        const inSameBox =
                                            selectedCell != null &&
                                            Math.floor(selectedCell[0] / 3) ===
                                                Math.floor(rIdx / 3) &&
                                            Math.floor(selectedCell[1] / 3) ===
                                                Math.floor(cIdx / 3)
                                        const isSameNumber =
                                            selectedValue != null &&
                                            cellValue === selectedValue &&
                                            !isSelected
                                        const isConflict = conflicts.has(`${rIdx},${cIdx}`)
                                        const cellNotes = notes[rIdx]?.[cIdx]
                                        const hasNotes =
                                            cellValue === 0 && cellNotes && cellNotes.size > 0

                                        const thickLeft = cIdx % 3 === 0
                                        const thickTop = rIdx % 3 === 0
                                        const isRightEdge = cIdx === 8
                                        const isBottomEdge = rIdx === 8

                                        return (
                                            <button
                                                key={`${rIdx}-${cIdx}`}
                                                onClick={() => selectCell(rIdx, cIdx)}
                                                className={cn(
                                                    "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 flex items-center justify-center text-sm sm:text-base md:text-lg transition-colors duration-100 select-none relative",
                                                    "border-border/60 border-r border-b",
                                                    thickLeft
                                                        ? "border-l-2 border-l-foreground/30"
                                                        : "border-l-0",
                                                    thickTop
                                                        ? "border-t-2 border-t-foreground/30"
                                                        : "border-t-0",
                                                    isRightEdge && "border-r-2 border-r-foreground/30",
                                                    isBottomEdge && "border-b-2 border-b-foreground/30",
                                                    !thickLeft && "border-l border-l-border/40",
                                                    !thickTop && "border-t border-t-border/40",
                                                    isSelected
                                                        ? "bg-primary/20 ring-2 ring-primary/50 ring-inset z-10"
                                                        : isConflict
                                                          ? "bg-red-500/20"
                                                          : isSameNumber
                                                            ? "bg-primary/10"
                                                            : inSameRow || inSameCol || inSameBox
                                                              ? "bg-muted/30"
                                                              : "bg-background/60 hover:bg-muted/20",
                                                )}
                                            >
                                                {cellValue !== 0 ? (
                                                    <span
                                                        className={cn(
                                                            "leading-none",
                                                            isConflict && "text-red-500",
                                                            !isConflict && isInitial && "font-bold text-foreground",
                                                            !isConflict && !isInitial && "font-medium text-primary",
                                                        )}
                                                    >
                                                        {cellValue}
                                                    </span>
                                                ) : hasNotes ? (
                                                    <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-px">
                                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                                                            <span
                                                                key={n}
                                                                className={cn(
                                                                    "flex items-center justify-center text-[7px] sm:text-[8px] md:text-[9px] leading-none",
                                                                    cellNotes.has(n)
                                                                        ? "text-primary/70"
                                                                        : "text-transparent",
                                                                )}
                                                            >
                                                                {n}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </button>
                                        )
                                    }),
                                )}
                            </div>

                            {/* Win overlay */}
                            <AnimatePresence>
                                {status === "won" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 backdrop-blur-md rounded-2xl"
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1 }}
                                            className="bg-background/95 px-6 py-5 sm:px-10 sm:py-8 rounded-[22px] border border-primary/50 shadow-[0_24px_68px_-48px_hsl(var(--surface-shadow)/0.54)] flex flex-col items-center gap-3"
                                        >
                                            <div className="flex items-center gap-2 text-primary">
                                                <Trophy className="w-8 h-8 animate-bounce text-yellow-500" />
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <span className="text-xl sm:text-2xl font-black text-foreground">
                                                恭喜通关！
                                            </span>
                                            <div className="text-sm text-muted-foreground space-y-0.5 text-center">
                                                <div>
                                                    难度:{" "}
                                                    <span className={cn("font-bold", DIFF_LABELS[difficulty].color)}>
                                                        {DIFF_LABELS[difficulty].label}
                                                    </span>
                                                </div>
                                                <div>
                                                    用时:{" "}
                                                    <span className="text-foreground font-bold">
                                                        {formatTime(time)}
                                                    </span>
                                                    {stats.bestTimes[difficulty] === time && (
                                                        <span className="text-yellow-500 ml-1 text-xs font-bold animate-pulse">
                                                            ★ 新纪录!
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button onClick={() => newGame()} className="mt-2 gap-2">
                                                <RotateCcw className="w-4 h-4" />
                                                再来一局
                                            </Button>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Number input pad */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                            const count = numberCounts[num]
                            const isFull = count >= 9
                            return (
                                <button
                                    key={num}
                                    onClick={() => setNumber(num)}
                                    disabled={isFull || status === "won"}
                                    className={cn(
                                        "relative w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-lg sm:text-xl font-bold transition-all border",
                                        isFull
                                            ? "bg-muted/30 text-muted-foreground/30 border-border/30 cursor-not-allowed"
                                            : "bg-background/80 text-foreground border-border hover:bg-primary/10 hover:border-primary/40 active:scale-95",
                                    )}
                                >
                                    {num}
                                    <span
                                        className={cn(
                                            "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center border",
                                            isFull
                                                ? "bg-muted text-muted-foreground border-border/50"
                                                : "bg-primary/10 text-primary border-primary/30",
                                        )}
                                    >
                                        {9 - count}
                                    </span>
                                </button>
                            )
                        })}

                        <div className="w-px h-10 bg-border mx-1 hidden sm:block" />

                        <button
                            onClick={clearCell}
                            disabled={status === "won"}
                            className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-lg font-bold transition-all border bg-background/80 text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 active:scale-95 flex items-center justify-center"
                            title="清除"
                        >
                            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>

                        <button
                            onClick={toggleNoteMode}
                            disabled={status === "won"}
                            className={cn(
                                "w-10 h-12 sm:w-12 sm:h-14 rounded-xl text-lg font-bold transition-all border flex items-center justify-center",
                                isNoteMode
                                    ? "bg-primary/20 text-primary border-primary/50 ring-2 ring-primary/30"
                                    : "bg-background/80 text-muted-foreground border-border hover:bg-primary/10 hover:border-primary/40",
                            )}
                            title="笔记模式"
                        >
                            <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>

                    <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-3">
                        点击格子选中，按数字键填入 · 键盘 N 切换笔记 · Delete 清除
                    </p>
                    <KeyboardHelp shortcuts={SHORTCUTS_SUDOKU} />
                </div>
            </div>

            {/* Right: Knowledge panel */}
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-20">
                <Tabs defaultValue="concepts" className="flex flex-col h-full">
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
                                    <Grid3X3 className="w-5 h-5" />
                                    <h3 className="text-sm font-bold">什么是数独？</h3>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    数独是一种 9×9 的数字填充游戏。棋盘被划分为 9 个 3×3 的宫，
                                    你的目标是让每一行、每一列、每一宫都恰好包含 1-9 这九个数字各一次。
                                    初始给出的数字（"线索"）越少，谜题越难。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-violet-500" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        约束满足问题 (CSP)
                                    </h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    数独是经典的约束满足问题：
                                </p>
                                <ul className="text-xs text-muted-foreground leading-relaxed space-y-1 list-disc list-inside">
                                    <li>
                                        <strong className="text-foreground">变量</strong>：每个空格子
                                    </li>
                                    <li>
                                        <strong className="text-foreground">值域</strong>：1-9
                                    </li>
                                    <li>
                                        <strong className="text-foreground">约束</strong>：同行/同列/同宫不重复
                                    </li>
                                </ul>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                                    CSP 广泛应用于排课、地图着色、电路布线等实际问题中。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        回溯算法
                                    </h4>
                                </div>
                                <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                                    <li>找到下一个空格子</li>
                                    <li>尝试填入一个满足约束的数字</li>
                                    <li>递归地尝试解决剩余格子</li>
                                    <li>如果卡住（无合法数字），回退上一步，换一个数再试</li>
                                </ol>
                                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                                    回溯 = 深度优先搜索 + 剪枝。每一步排除不可能的分支，
                                    避免盲目遍历所有 9⁸¹ 种可能。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Pencil className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        笔记 = 约束传播
                                    </h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    在格子里标注"候选数字"（笔记），就是在手动做约束传播——
                                    每填入一个数字，其所在行、列、宫中的候选值都会被排除。
                                    本游戏会在你填数时自动清理相关笔记。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Grid3X3 className="w-4 h-4 text-green-500" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        拉丁方与数独
                                    </h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    数独是带额外"宫"约束的拉丁方（Latin Square）。
                                    拉丁方只要求每行每列不重复，数独额外要求每个 3×3 子格也不重复——
                                    这使得可行解从天文数字锐减到约 6.67×10²¹ 个。
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-primary" />
                                    <h4 className="text-sm font-bold text-foreground">
                                        试试"显示答案"
                                    </h4>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    点击「答案」按钮可以查看回溯算法计算出的解。
                                    对比你的解题过程和算法的解，思考人类推理和计算机搜索之间的异同。
                                </p>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="stats" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-foreground mb-1">
                                    游戏统计
                                </h3>
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
                                    <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
                                    <span className="text-2xl font-black text-foreground font-mono">
                                        {stats.wins}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                        胜利次数
                                    </span>
                                </div>
                            </div>

                            {/* Best times per difficulty */}
                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <Timer className="w-4 h-4 text-green-500" />
                                    最佳用时（按难度）
                                </h4>
                                <div className="space-y-1.5">
                                    {(["easy", "medium", "hard"] as SudokuDifficulty[]).map((d) => {
                                        const best = stats.bestTimes[d]
                                        return (
                                            <div
                                                key={d}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className={cn("font-medium", DIFF_LABELS[d].color)}>
                                                    {DIFF_LABELS[d].label}
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

                            {/* Wins per difficulty */}
                            <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-3">
                                <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                    胜利次数（按难度）
                                </h4>
                                <div className="space-y-1.5">
                                    {(["easy", "medium", "hard"] as SudokuDifficulty[]).map((d) => {
                                        const wins = stats.winsByDifficulty[d]
                                        return (
                                            <div
                                                key={d}
                                                className="flex items-center justify-between text-xs"
                                            >
                                                <span className={cn("font-medium", DIFF_LABELS[d].color)}>
                                                    {DIFF_LABELS[d].label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "font-mono font-bold",
                                                        wins > 0
                                                            ? "text-foreground"
                                                            : "text-muted-foreground/40",
                                                    )}
                                                >
                                                    {wins > 0 ? wins : "—"}
                                                </span>
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
                                            尝试挑战"困难"难度并刷新最佳用时！完成困难模式可解锁专属数独徽章。
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
