"use client"

import { useEffect, useState } from "react"
import { BarChart3, Bot, Compass, Footprints, RotateCcw, Trophy } from "lucide-react"
import { useMazeRunner, type MazeAlgorithm, type MazeSize } from "@/hooks/playground/use-maze-runner"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SIZES: MazeSize[] = [9, 13, 17]
const ALGORITHMS: Array<{ key: MazeAlgorithm; label: string; shortLabel: string; description: string }> = [
    { key: "bfs", label: "广度优先 BFS", shortLabel: "BFS", description: "一层层扩散，保证最短路线。" },
    { key: "dfs", label: "深度优先 DFS", shortLabel: "DFS", description: "先一路深入，走不通再回退。" },
    { key: "astar", label: "A* 智能寻路", shortLabel: "A*", description: "把已走步数和离终点距离一起估算。" },
]

const ALGORITHM_LABELS: Record<MazeAlgorithm, string> = {
    bfs: "BFS",
    dfs: "DFS",
    astar: "A*",
}

export default function MazePage() {
    const game = useMazeRunner(13)
    const { checkBadges } = useGamification()
    const [comparisonVisible, setComparisonVisible] = useState(false)

    const visitedSet = new Set<string>()
    const pathSet = new Set<string>()
    if (game.demo) {
        for (let index = 0; index < game.demo.progress; index++) {
            const point = game.demo.visited[index]
            if (point) visitedSet.add(`${point.row},${point.col}`)
        }
        if (game.demo.done) {
            for (const point of game.demo.path) {
                pathSet.add(`${point.row},${point.col}`)
            }
        }
    }

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const map: Record<string, { row: number; col: number } | undefined> = {
                ArrowUp: { row: -1, col: 0 },
                w: { row: -1, col: 0 },
                ArrowRight: { row: 0, col: 1 },
                d: { row: 0, col: 1 },
                ArrowDown: { row: 1, col: 0 },
                s: { row: 1, col: 0 },
                ArrowLeft: { row: 0, col: -1 },
                a: { row: 0, col: -1 },
            }
            const delta = map[event.key]
            if (delta) {
                event.preventDefault()
                game.move(delta)
            }
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [game])

    useEffect(() => {
        if (game.status !== "won") return
        checkBadges({
            projectsPublished: 0, projectsLiked: 0, projectsCompleted: 0,
            commentsCount: 0, scienceCompleted: 0, techCompleted: 0,
            engineeringCompleted: 0, artCompleted: 0, mathCompleted: 0,
            likesGiven: 0, likesReceived: 0, collectionsCount: 0,
            challengesJoined: 0, level: 1, loginDays: 0, consecutiveDays: 0,
            discussionsCreated: 0, repliesCount: 0,
            minesweeperWins: 0, minesweeperExpertWins: 0, minesweeperBestTime: 999,
            mazeWins: game.stats.wins,
        })
    }, [checkBadges, game.stats.wins, game.status])

    const activeComparison = game.demo
        ? game.algorithmComparison.find((result) => result.algorithm === game.demo?.algorithm)
        : null
    const leastVisited = Math.min(...game.algorithmComparison.map((result) => result.visitedCount))

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-3xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-lime-400/40 bg-lime-500/10">
                                <Compass className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">迷宫寻路实验</h1>
                                <p className="text-xs text-muted-foreground">
                                    先自己走到终点，再比较三种算法谁探索得更少。
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => game.startNewGame()} aria-label="重新开始">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2">
                        <div className="min-w-0 rounded-md bg-lime-500/10 px-2.5 py-2 sm:px-3">
                            <div className="text-[11px] font-bold text-lime-600 dark:text-lime-300">你的路线</div>
                            <div className="mt-1 text-lg font-black">{game.steps} 步</div>
                        </div>
                        <div className="min-w-0 rounded-md bg-sky-500/10 px-2.5 py-2 sm:px-3">
                            <div className="text-[11px] font-bold text-sky-600 dark:text-sky-300">理论最短</div>
                            <div className="mt-1 text-lg font-black">{game.optimalSteps} 步</div>
                        </div>
                        <div className="min-w-0 rounded-md bg-amber-500/10 px-2.5 py-2 sm:px-3">
                            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-300">实验重点</div>
                            <div className="mt-1 text-xs font-bold leading-4 sm:text-sm">看探索格数</div>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">迷宫规模</span>
                            {SIZES.map((size) => (
                                <Button key={size} size="sm" variant={game.size === size ? "default" : "outline"} onClick={() => game.startNewGame(size)}>
                                    {size}×{size}
                                </Button>
                            ))}
                            <Button
                                className="ml-0 sm:ml-auto"
                                size="sm"
                                variant={comparisonVisible ? "secondary" : "default"}
                                onClick={() => setComparisonVisible((visible) => !visible)}
                            >
                                <BarChart3 className="mr-1.5 h-4 w-4" />
                                算法对比
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-muted-foreground">回放算法</span>
                            {ALGORITHMS.map((algorithm) => (
                                <Button
                                    key={algorithm.key}
                                    size="sm"
                                    variant={game.demo?.algorithm === algorithm.key ? "secondary" : "outline"}
                                    onClick={() => {
                                        setComparisonVisible(true)
                                        game.runDemo(algorithm.key)
                                    }}
                                >
                                    <span className="sm:hidden">{algorithm.shortLabel}</span>
                                    <span className="hidden sm:inline">{algorithm.label}</span>
                                </Button>
                            ))}
                            {game.demo && (
                                <Button size="sm" variant="ghost" onClick={game.clearDemo}>
                                    清除
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="mx-auto grid max-w-[min(78vw,620px)] gap-0.5 rounded-lg bg-muted/40 p-2" style={{ gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))` }}>
                        {game.maze.map((row, r) =>
                            row.map((wall, c) => {
                                const cellKey = `${r},${c}`
                                const isPlayer = game.player.row === r && game.player.col === c
                                const isGoal = r === game.size - 2 && c === game.size - 2
                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        className={cn(
                                            "aspect-square rounded-[3px]",
                                            wall ? "bg-slate-800 dark:bg-slate-200" : "bg-background",
                                            !wall && visitedSet.has(cellKey) && "bg-sky-400/25",
                                            !wall && pathSet.has(cellKey) && "bg-lime-500/40",
                                            isGoal && "bg-amber-500",
                                            isPlayer && "bg-lime-500 shadow-lg",
                                        )}
                                    />
                                )
                            }),
                        )}
                    </div>

                    {game.demo && (
                        <div className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
                            {game.demo.done
                                ? `${ALGORITHM_LABELS[game.demo.algorithm]} 探索 ${game.demo.visited.length} 格，路线 ${Math.max(game.demo.path.length - 1, 0)} 步${activeComparison?.visitedCount === leastVisited ? "，本局探索最少。" : "。"}`
                                : `${ALGORITHM_LABELS[game.demo.algorithm]} 正在探索 ${game.demo.progress}/${game.demo.visited.length} 格`}
                        </div>
                    )}

                    {comparisonVisible && (
                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            {game.algorithmComparison.map((result) => {
                                const meta = ALGORITHMS.find((algorithm) => algorithm.key === result.algorithm)!
                                const isActive = game.demo?.algorithm === result.algorithm
                                const isLeastVisited = result.visitedCount === leastVisited
                                return (
                                    <button
                                        key={result.algorithm}
                                        type="button"
                                        onClick={() => game.runDemo(result.algorithm)}
                                        className={cn(
                                            "rounded-md border bg-background px-3 py-3 text-left transition hover:border-lime-400/70 hover:bg-lime-500/5",
                                            isActive && "border-lime-400 bg-lime-500/10",
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold">{meta.label}</span>
                                            {isLeastVisited && (
                                                <span className="rounded-full bg-lime-500/15 px-2 py-0.5 text-[10px] font-bold text-lime-700 dark:text-lime-300">
                                                    探索最少
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">{meta.description}</p>
                                        <div className="mt-3 flex items-end justify-between gap-2 text-xs">
                                            <span>
                                                探索 <strong className="text-base text-foreground">{result.visitedCount}</strong> 格
                                            </span>
                                            <span>
                                                路线 <strong className="text-base text-foreground">{result.pathSteps}</strong> 步
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 sm:hidden">
                        <span />
                        <Button variant="outline" onClick={() => game.move({ row: -1, col: 0 })}>上</Button>
                        <span />
                        <Button variant="outline" onClick={() => game.move({ row: 0, col: -1 })}>左</Button>
                        <Button variant="outline" onClick={() => game.move({ row: 1, col: 0 })}>下</Button>
                        <Button variant="outline" onClick={() => game.move({ row: 0, col: 1 })}>右</Button>
                    </div>

                    {game.status === "won" && (
                        <div className="mt-4 rounded-lg border border-lime-400/40 bg-lime-500/10 p-4 text-center font-bold">
                            抵达终点！共 {game.steps} 步
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                （理论最短 {game.optimalSteps} 步{game.steps === game.optimalSteps ? "，完美路线！" : ""}）
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <aside className="w-full border-t border-border bg-card/50 p-6 xl:w-96 xl:border-l xl:border-t-0">
                <div className="space-y-5">
                    <section className="rounded-sm bg-muted/30 p-4">
                        <h2 className="mb-2 flex items-center gap-2 font-bold">
                            <Trophy className="h-4 w-4 text-lime-500" />
                            最佳步数
                        </h2>
                        {SIZES.map((size) => (
                            <div key={size} className="flex justify-between text-sm">
                                <span>{size}×{size}</span>
                                <strong>{game.stats.bestSteps[size] ?? "暂无"}</strong>
                            </div>
                        ))}
                    </section>
                    <section className="rounded-sm border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                        <h3 className="mb-2 flex items-center gap-2 font-bold text-foreground">
                            <Bot className="h-4 w-4" />
                            怎么读这个实验
                        </h3>
                        <p className="leading-relaxed">
                            蓝色格子代表算法检查过的区域，绿色格子是最终路线。
                            在这种只有一条通路的迷宫里，三种算法通常能走出同样长的路线；真正值得比较的是探索了多少格。
                            探索越少，说明算法越快把注意力放到可能接近终点的方向。
                        </p>
                    </section>
                    <section className="flex items-center gap-2 rounded-sm bg-muted/20 p-4 text-xs text-muted-foreground">
                        <Footprints className="h-4 w-4" />
                        <span>桌面端用方向键或 WASD，移动端用下方按钮。先自己挑战，再看演示验证路线。</span>
                    </section>
                </div>
            </aside>
        </div>
    )
}
