"use client"

import { useState } from "react"
import { useMinesweeper } from "@/hooks/useMinesweeper"
import { Flag, Bomb, Timer, RefreshCw, Trophy } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

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
    } = useMinesweeper("intermediate")

    const [activeTab, setActiveTab] = useState<"tutorial" | "leaderboard">("tutorial")

    // 获取对应的数字颜色
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

    return (
        <div className="flex flex-col xl:flex-row h-full">
            {/* 左侧游戏区 */}
            <div className="flex-1 p-2 sm:p-6 xl:p-12 flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] w-full overflow-hidden">
                <div className="max-w-full lg:max-w-max w-full bg-zinc-900/40 p-3 sm:p-6 rounded-3xl border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-x-auto scrollbar-thin">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row items-center justify-between min-w-max gap-4 mb-4 sm:mb-8 bg-black/40 p-4 rounded-xl border border-white/5">
                        <div className="flex gap-1 sm:gap-2 bg-zinc-800/50 p-1 rounded-lg">
                            {(["beginner", "intermediate", "expert"] as const).map((level) => (
                                <button
                                    key={level}
                                    onClick={() => changeDifficulty(level)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${difficultyName === level
                                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25"
                                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {level === "beginner" ? "初级" : level === "intermediate" ? "中级" : "高级"}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-red-400 font-mono text-xl bg-black/50 px-3 py-1 rounded-lg border border-white/5">
                                <Flag className="w-4 h-4" />
                                {minesLeft.toString().padStart(3, "0")}
                            </div>
                            <button
                                onClick={resetGame}
                                className="w-10 h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-400 text-white rounded-full transition-all hover:rotate-180 duration-500 shadow-lg shadow-indigo-500/25"
                            >
                                {status === "lost" ? <Bomb size={18} /> : status === "won" ? <Trophy size={18} /> : <RefreshCw size={18} />}
                            </button>
                            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xl bg-black/50 px-3 py-1 rounded-lg border border-white/5">
                                <Timer className="w-4 h-4" />
                                {time.toString().padStart(3, "0")}
                            </div>
                        </div>
                    </div>

                    {/* Board */}
                    <div className="relative">
                        <AnimatePresence>
                            {status === "lost" && (
                                <motion.div
                                    initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                                    animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
                                    className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/30 rounded-xl"
                                >
                                    <div className="bg-black/80 px-8 py-4 rounded-2xl border border-red-500/50 text-red-500 font-bold text-2xl shadow-2xl flex items-center gap-3">
                                        <Bomb className="w-8 h-8 animate-bounce" /> 游戏结束
                                    </div>
                                </motion.div>
                            )}
                            {status === "won" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute inset-0 z-10 flex items-center justify-center bg-green-950/30 backdrop-blur-sm rounded-xl"
                                >
                                    <div className="bg-black/90 px-8 py-4 rounded-2xl border border-green-500/50 text-green-400 font-bold text-2xl shadow-2xl flex items-center gap-3">
                                        <Trophy className="w-8 h-8 text-yellow-500" /> 恭喜通关！
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Grid 渲染，避免 React Context 性能警告 */}
                        <div className="inline-block p-1 sm:p-2 bg-zinc-950/50 rounded-xl border border-white/5 mx-auto">
                            {board.map((row, rIdx) => (
                                <div key={rIdx} className="flex min-w-max">
                                    {row.map((cell, cIdx) => (
                                        <div
                                            key={`${rIdx}-${cIdx}`}
                                            onClick={() => revealCell(rIdx, cIdx)}
                                            onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
                                                e.preventDefault()
                                                toggleFlag(rIdx, cIdx, e)
                                            }}
                                            className={`
                        w-8 h-8 sm:w-10 sm:h-10 border border-black/20 flex items-center justify-center text-sm sm:text-lg font-extrabold cursor-pointer transition-colors duration-100 select-none
                        ${cell.isRevealed
                                                    ? cell.isMine
                                                        ? "bg-red-500/80 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]"
                                                        : "bg-zinc-800/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                                                    : "bg-zinc-700/80 hover:bg-zinc-600/80 shadow-[inset_0_2px_0_rgba(255,255,255,0.1)] border-t-white/10 border-l-white/10"
                                                }
                      `}
                                        >
                                            {cell.isRevealed ? (
                                                cell.isMine ? (
                                                    <Bomb size={18} className="text-zinc-900" />
                                                ) : (
                                                    <span className={getNumberColor(cell.neighborMines)}>
                                                        {cell.neighborMines > 0 ? cell.neighborMines : ""}
                                                    </span>
                                                )
                                            ) : cell.isFlagged ? (
                                                <Flag size={16} className="text-red-500 drop-shadow-md" />
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
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-white/10 bg-black/40 backdrop-blur-xl flex flex-col h-full z-20">
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => setActiveTab("tutorial")}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === "tutorial" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                    >
                        STEAM原理解析
                    </button>
                    <button
                        onClick={() => setActiveTab("leaderboard")}
                        className={`flex-1 py-4 text-sm font-semibold transition-colors ${activeTab === "leaderboard" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-500 hover:text-zinc-300"
                            }`}
                    >
                        全服榜单
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {activeTab === "tutorial" ? (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">排雷：算术与逻辑的艺术</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    扫雷看似依靠直觉，但这其实是一个经典的<strong className="text-indigo-300">约束满足问题 (Constraint Satisfaction Problem)</strong>。每一个露出的数字都在告诉你周边空间雷分布的方程组。
                                </p>
                            </div>

                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
                                <h4 className="font-semibold text-indigo-300 flex items-center gap-2">
                                    <span className="bg-indigo-500/20 px-2 py-0.5 rounded text-xs">M</span>
                                    数学与逻辑推演
                                </h4>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    <strong>基础定式 1-1：</strong> 当数字 <span className="text-blue-400 font-bold">1</span> 旁边有两个未知方块，而它又与另一个 <span className="text-blue-400 font-bold">1</span> 相邻时，可以通过差值相减，确定第三个方块必然是安全的。
                                </p>
                            </div>

                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl space-y-3">
                                <h4 className="font-semibold text-blue-300 flex items-center gap-2">
                                    <span className="bg-blue-500/20 px-2 py-0.5 rounded text-xs">T</span>
                                    洪水漫水算法 (Flood Fill)
                                </h4>
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                    当你点击到空白区（数字为 0），周围一大片区域会瞬间翻开。这是因为游戏内核运用了图的
                                    <strong className="text-white">深度优先搜索 (DFS)</strong> 或 <strong className="text-white">广度优先搜索 (BFS)</strong>。
                                    它犹如水滴落入海绵，不断向四面八方扩散，直到遇到含有数字的边缘。
                                </p>
                                <div className="bg-black/50 p-3 rounded border border-white/5 font-mono text-[10px] text-zinc-400 overflow-x-auto">
                                    <pre>{`function revealEmpty(r, c) {
  stack.push([r, c]);
  while(stack.length) {
    let [cr, cc] = stack.pop();
    if (board[cr][cc] === 0) {
      // reveal neighbors...
      stack.push(neighbors);
    }
  }
}`}</pre>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/10">
                                <p className="text-xs text-zinc-500 text-center">
                                    完成无伤通关高级扫雷，可获得「雷区清道夫」大师徽章与 +100 XP。
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="text-center text-sm text-zinc-500 py-8">
                                <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                                排行榜功能即将上线（Phase 2）
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
