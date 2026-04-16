"use client"

import { useEffect, useState } from "react"
import { use2048, type TileData } from "@/hooks/playground/use-2048"
import { useGamification } from '@/lib/context/gamification-context'
import { Trophy, RefreshCw, Undo2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sparkles, Brain, Target, Lightbulb, Star } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import confetti from "canvas-confetti"
import { KeyboardHelp } from "@/components/features/playground/keyboard-help"

const SHORTCUTS_2048 = [
    { key: "←→↑↓", label: "滑动方向" },
    { key: "W/A/S/D", label: "滑动方向" },
    { key: "Ctrl/Cmd + Z", label: "撤销" },
    { key: "?", label: "快捷键" },
]

function getTileStyle(value: number) {
    switch (value) {
        case 2: return "bg-amber-100 text-amber-900"
        case 4: return "bg-amber-200 text-amber-900"
        case 8: return "bg-orange-300 text-white"
        case 16: return "bg-orange-400 text-white"
        case 32: return "bg-orange-500 text-white"
        case 64: return "bg-red-400 text-white"
        case 128: return "bg-yellow-400 text-white text-2xl"
        case 256: return "bg-yellow-300 text-white"
        case 512: return "bg-yellow-200 text-amber-800"
        case 1024: return "bg-yellow-500 text-white text-lg"
        case 2048: return "bg-amber-500 text-white font-black shadow-[0_0_30px_rgba(245,158,11,0.6)]"
        default:
            if (value > 2048) return "bg-violet-600 text-white"
            return "bg-muted/30"
    }
}

function getTileFontSize(value: number) {
    if (value >= 1024) return "text-lg sm:text-xl"
    if (value >= 128) return "text-xl sm:text-2xl"
    return "text-2xl sm:text-3xl"
}

function Tile({ tile }: { tile: TileData }) {
    return (
        <div
            className={cn(
                "absolute inset-0 rounded-xl flex items-center justify-center font-extrabold select-none transition-all duration-100",
                getTileStyle(tile.value),
                getTileFontSize(tile.value),
                tile.isNew && "animate-[pop-in_200ms_ease-out]",
                tile.isMerged && "animate-[merge-pop_200ms_ease-out]",
            )}
            style={{
                gridRow: tile.row + 1,
                gridColumn: tile.col + 1,
            }}
        >
            {tile.value}
        </div>
    )
}

export default function Game2048Page() {
    const {
        tiles,
        score,
        status,
        stats,
        isNewRecord,
        move,
        undo,
        canUndo,
        resetGame,
        continueAfterWin,
        onTouchStart,
        onTouchEnd,
    } = use2048()
    const { checkBadges } = useGamification()

    const [activeTab, setActiveTab] = useState<"concepts" | "stats">("concepts")

    useEffect(() => {
        if (status !== "won" && status !== "gameover") return
        if (status === "won") {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } })
        }
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            game2048BestScore: stats.bestScore,
            game2048MaxTile: stats.maxTile,
            game2048Wins: stats.wins,
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status])

    return (
        <>
            <style jsx global>{`
                @keyframes pop-in {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes merge-pop {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `}</style>

            <div className="flex flex-col xl:flex-row h-full">
                {/* 左侧游戏区 */}
                <div className="flex-1 relative p-2 sm:p-6 xl:p-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] w-full overflow-hidden">
                    <div className="max-w-full lg:max-w-max w-full bg-card/60 p-3 sm:p-6 rounded-3xl border border-border backdrop-blur-xl shadow-2xl relative">

                        {/* Header: Score & Controls */}
                        <div className="flex items-center justify-between gap-4 mb-4 sm:mb-6 bg-background/60 p-3 sm:p-4 rounded-xl border border-border shadow-inner">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="flex flex-col items-center bg-primary/10 px-4 py-2 rounded-lg border border-primary/20">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">得分</span>
                                    <span className="text-xl sm:text-2xl font-black text-foreground font-mono">{score}</span>
                                </div>
                                <div className="flex flex-col items-center bg-muted/40 px-4 py-2 rounded-lg border border-border">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">最佳</span>
                                    <span className="text-xl sm:text-2xl font-black text-muted-foreground font-mono">{stats.bestScore}</span>
                                </div>
                                {isNewRecord && (
                                    <span className="text-yellow-500 font-black text-xs animate-pulse flex items-center gap-1">
                                        <Star className="w-3.5 h-3.5 fill-yellow-500" />
                                        新纪录!
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={undo}
                                    disabled={!canUndo}
                                    className="w-10 h-10 rounded-lg"
                                    title="撤销 (Ctrl+Z)"
                                >
                                    <Undo2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={resetGame}
                                    size="icon"
                                    className="w-10 h-10 rounded-lg"
                                    title="新游戏"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Game Grid */}
                        <div
                            className="relative w-full max-w-[360px] sm:max-w-[420px] mx-auto aspect-square touch-none select-none bg-muted/20 rounded-2xl p-2 sm:p-3 border border-border shadow-xl"
                            onTouchStart={onTouchStart}
                            onTouchEnd={onTouchEnd}
                        >
                            <div className="grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3 w-full h-full">
                                {/* Background cells */}
                                {Array.from({ length: 16 }).map((_, i) => (
                                    <div key={`bg-${i}`} className="bg-muted/30 rounded-xl" />
                                ))}
                            </div>

                            {/* Tiles layer */}
                            <div className="absolute inset-0 p-2 sm:p-3">
                                <div className="grid grid-cols-4 grid-rows-4 gap-2 sm:gap-3 w-full h-full">
                                    {tiles.map((tile) => (
                                        <div
                                            key={tile.id}
                                            className="relative"
                                            style={{
                                                gridRow: tile.row + 1,
                                                gridColumn: tile.col + 1,
                                            }}
                                        >
                                            <Tile tile={tile} />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Game Over Overlay */}
                            <AnimatePresence>
                                {status === "gameover" && (
                                    <motion.div
                                        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                        animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-2xl"
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1 }}
                                            className="bg-background/95 px-6 py-5 sm:px-10 sm:py-8 rounded-3xl border border-destructive/30 shadow-2xl flex flex-col items-center gap-3"
                                        >
                                            <span className="text-xl sm:text-2xl font-black text-destructive">游戏结束</span>
                                            <div className="text-sm text-muted-foreground">
                                                最终得分: <span className="text-foreground font-bold text-lg">{score}</span>
                                            </div>
                                            <Button onClick={resetGame} className="mt-2 gap-2">
                                                <RefreshCw className="w-4 h-4" />
                                                重新开始
                                            </Button>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Win Overlay */}
                            <AnimatePresence>
                                {status === "won" && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="absolute inset-0 z-10 flex items-center justify-center bg-amber-500/20 backdrop-blur-md rounded-2xl"
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.1 }}
                                            className="bg-background/95 px-6 py-5 sm:px-10 sm:py-8 rounded-3xl border border-amber-400/50 shadow-2xl flex flex-col items-center gap-3"
                                        >
                                            <div className="flex items-center gap-2 text-amber-500">
                                                <Trophy className="w-8 h-8 animate-bounce" />
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <span className="text-xl sm:text-2xl font-black text-foreground">恭喜！达到 2048!</span>
                                            <div className="text-sm text-muted-foreground">
                                                得分: <span className="text-foreground font-bold">{score}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <Button variant="outline" onClick={resetGame} className="gap-2">
                                                    <RefreshCw className="w-4 h-4" />
                                                    重新开始
                                                </Button>
                                                <Button onClick={continueAfterWin} className="gap-2">
                                                    <Sparkles className="w-4 h-4" />
                                                    继续挑战
                                                </Button>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Mobile Arrow Controls */}
                        <div className="flex xl:hidden justify-center mt-4 sm:mt-6">
                            <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-[140px] h-[140px]">
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => move("up")}
                                    className="w-full h-full rounded-xl"
                                >
                                    <ArrowUp className="w-5 h-5" />
                                </Button>
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => move("left")}
                                    className="w-full h-full rounded-xl"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => move("right")}
                                    className="w-full h-full rounded-xl"
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </Button>
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => move("down")}
                                    className="w-full h-full rounded-xl"
                                >
                                    <ArrowDown className="w-5 h-5" />
                                </Button>
                                <div />
                            </div>
                        </div>

                        {/* Keyboard hint */}
                        <p className="hidden xl:block text-center text-xs text-muted-foreground mt-4">
                            方向键 / WASD 移动 · Ctrl+Z 撤销
                        </p>
                        <KeyboardHelp shortcuts={SHORTCUTS_2048} />
                    </div>
                </div>

                {/* 右侧知识面板 */}
                <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-20">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "concepts" | "stats")} className="flex flex-col h-full">
                        <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0">
                            <TabsTrigger
                                value="concepts"
                                className="flex-1 py-5 text-sm font-bold rounded-none data-[state=active]:text-primary data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-muted-foreground"
                            >
                                知识概念
                            </TabsTrigger>
                            <TabsTrigger
                                value="stats"
                                className="flex-1 py-5 text-sm font-bold rounded-none data-[state=active]:text-primary data-[state=active]:bg-primary/5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none text-muted-foreground"
                            >
                                游戏统计
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="concepts" className="flex-1 overflow-y-auto p-6 scrollbar-thin mt-0">
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-primary">
                                        <Brain className="w-5 h-5" />
                                        <h3 className="text-sm font-bold">2048 背后的数学与算法</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        2048 不仅是一款休闲游戏，它蕴含了丰富的计算机科学与数学思想。
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        <h4 className="text-sm font-bold text-foreground">2 的幂次方</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        每个方块的数字都是 2 的幂：2, 4, 8, 16, 32, …, 2048。二进制是计算机的基础，2 的幂次在内存寻址、数据结构中无处不在。
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-blue-500" />
                                        <h4 className="text-sm font-bold text-foreground">贪心算法 vs 全局最优</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        每一步选择眼前的最优合并并不总是全局最优的策略。这正是贪心算法的局限性——短期收益可能牺牲长期优势。
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4 text-green-500" />
                                        <h4 className="text-sm font-bold text-foreground">状态空间搜索</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        AI 玩 2048 通常使用 Expectimax 搜索（期望最大化搜索），它需要搜索庞大的游戏状态树。4×4 棋盘理论上有超过 10^20 种可能状态。
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl border border-border bg-muted/10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-violet-500" />
                                        <h4 className="text-sm font-bold text-foreground">最优策略</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        经验证的高效策略：将最大方块固定在角落，沿一条边构建递减序列。这是一种启发式方法——不保证最优，但在实践中效果显著。
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
                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                        <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                                        <span className="text-2xl font-black text-foreground font-mono">{stats.bestScore}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">最高分</span>
                                    </div>
                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                        <Sparkles className="w-5 h-5 text-amber-500 mb-1" />
                                        <span className="text-2xl font-black text-foreground font-mono">{stats.maxTile}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">最大方块</span>
                                    </div>
                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                        <Target className="w-5 h-5 text-blue-500 mb-1" />
                                        <span className="text-2xl font-black text-foreground font-mono">{stats.totalGames}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">总局数</span>
                                    </div>
                                    <div className="p-4 rounded-2xl border border-border bg-muted/10 flex flex-col items-center gap-1">
                                        <Star className="w-5 h-5 text-green-500 mb-1" />
                                        <span className="text-2xl font-black text-foreground font-mono">{stats.wins}</span>
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">胜利次数</span>
                                    </div>
                                </div>

                                {stats.wins > 0 && stats.totalGames > 0 && (
                                    <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-foreground">胜率</span>
                                            <span className="text-lg font-black text-primary font-mono">
                                                {((stats.wins / stats.totalGames) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-6 p-4 rounded-2xl border border-border bg-muted/10">
                                    <div className="flex items-start gap-3">
                                        <Trophy className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-muted-foreground/70">挑战目标</h4>
                                            <p className="text-xs text-muted-foreground/50 mt-1 leading-relaxed">
                                                试试看能否达到 4096 甚至 8192！掌握角落策略，保持最大数在角落，你就能走得更远。
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </>
    )
}
