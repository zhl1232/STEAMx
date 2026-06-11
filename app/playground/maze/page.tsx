"use client"

import { useEffect } from "react"
import { Bot, Compass, Footprints, RotateCcw, Trophy } from "lucide-react"
import { useMazeRunner, type MazeAlgorithm, type MazeSize } from "@/hooks/playground/use-maze-runner"
import { useGamification } from "@/lib/context/gamification-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SIZES: MazeSize[] = [9, 13, 17]
const ALGORITHMS: Array<{ key: MazeAlgorithm; label: string }> = [
    { key: "bfs", label: "BFS" },
    { key: "dfs", label: "DFS" },
    { key: "astar", label: "A*" },
]

export default function MazePage() {
    const game = useMazeRunner(13)
    const { checkBadges } = useGamification()

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

    return (
        <div className="playground-game-page">
            <div className="playground-game-main playground-game-center">
                <div className="w-full max-w-2xl playground-game-board">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-lime-400/40 bg-lime-500/10">
                                <Compass className="h-5 w-5 text-lime-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black">迷宫探险</h1>
                                <p className="text-xs text-muted-foreground">先自己走，再看算法怎么找路。</p>
                            </div>
                        </div>
                        <Button variant="outline" size="icon" onClick={() => game.startNewGame()} aria-label="重新开始">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        {SIZES.map((size) => (
                            <Button key={size} size="sm" variant={game.size === size ? "default" : "outline"} onClick={() => game.startNewGame(size)}>
                                {size}×{size}
                            </Button>
                        ))}
                        <span className="mx-1 hidden text-xs text-muted-foreground sm:inline">演示：</span>
                        {ALGORITHMS.map((algorithm) => (
                            <Button
                                key={algorithm.key}
                                size="sm"
                                variant={game.demo?.algorithm === algorithm.key ? "secondary" : "outline"}
                                onClick={() => game.runDemo(algorithm.key)}
                            >
                                {algorithm.label}
                            </Button>
                        ))}
                        {game.demo && (
                            <Button size="sm" variant="ghost" onClick={game.clearDemo}>
                                清除
                            </Button>
                        )}
                        <span className="ml-auto rounded-full bg-muted px-3 py-1 text-xs font-bold">
                            {game.steps} 步
                        </span>
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
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                            {game.demo.done
                                ? `${game.demo.algorithm.toUpperCase()} 共探索 ${game.demo.visited.length} 格，路径 ${Math.max(game.demo.path.length - 1, 0)} 步`
                                : `${game.demo.algorithm.toUpperCase()} 正在探索… ${game.demo.progress}/${game.demo.visited.length} 格`}
                        </p>
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
                            算法视角
                        </h3>
                        <p className="leading-relaxed">
                            点击 BFS / DFS / A* 可以回放算法的探索过程：蓝色是探索过的格子，绿色是最终路径。
                            BFS 逐层扩散保证最短路；DFS 一路深入、靠回溯脱身；A* 用「已走步数 + 预估距离」优先朝目标推进。
                            对比三者点亮的蓝色区域大小，就能感受到启发式搜索的效率差异。
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
