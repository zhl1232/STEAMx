"use client"

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react"
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    BarChart3,
    Bot,
    Compass,
    EyeOff,
    Footprints,
    RotateCcw,
    Sparkles,
    Trophy,
    type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    FACING_DELTAS,
    useMazeRunner,
    type MazeAlgorithm,
    type MazeAlgorithmComparison,
    type MazeDemo,
    type MazeFacing,
    type MazeMoveDirection,
    type MazeSize,
} from "@/hooks/playground/use-maze-runner"
import { useGamification } from "@/lib/context/gamification-context"
import { cn } from "@/lib/utils"

const SIZES: MazeSize[] = [9, 13, 17, 21, 25]
const SIZE_LABELS: Record<MazeSize, string> = {
    9: "入门",
    13: "探索",
    17: "进阶",
    21: "迷阵",
    25: "专家",
}
const ALGORITHMS: Array<{
    key: MazeAlgorithm
    label: string
    shortLabel: string
    description: string
}> = [
    { key: "bfs", label: "广度优先 BFS", shortLabel: "BFS", description: "一层层扩散，保证最短路线。" },
    { key: "dfs", label: "深度优先 DFS", shortLabel: "DFS", description: "先一路深入，走不通再回退。" },
    { key: "astar", label: "A* 智能寻路", shortLabel: "A*", description: "估算离终点的距离，优先探索更有希望的方向。" },
]

const ALGORITHM_LABELS: Record<MazeAlgorithm, string> = {
    bfs: "BFS",
    dfs: "DFS",
    astar: "A*",
}

const FACING_LABELS: Record<MazeFacing, string> = {
    0: "上方",
    1: "右方",
    2: "下方",
    3: "左方",
}

const MOVE_META: Array<{
    direction: MazeMoveDirection
    label: string
    compass: string
    icon: LucideIcon
    position: string
}> = [
    { direction: "up", label: "向上", compass: "北", icon: ArrowUp, position: "col-start-2 row-start-1" },
    { direction: "left", label: "向左", compass: "西", icon: ArrowLeft, position: "col-start-1 row-start-2" },
    { direction: "right", label: "向右", compass: "东", icon: ArrowRight, position: "col-start-3 row-start-2" },
    { direction: "down", label: "向下", compass: "南", icon: ArrowDown, position: "col-start-2 row-start-3" },
]

function getRouteReview(status: "playing" | "won", steps: number, optimalSteps: number) {
    if (status !== "won") {
        return {
            label: "正在探索",
            detail: "终点仍在迷雾中",
            className: "text-amber-100",
        }
    }

    const extraSteps = Math.max(0, steps - optimalSteps)
    if (extraSteps === 0) {
        return {
            label: "完美路线",
            detail: "没有多走一步",
            className: "text-lime-200",
        }
    }

    if (extraSteps <= Math.max(2, Math.ceil(optimalSteps * 0.2))) {
        return {
            label: "接近最短",
            detail: `只多走 ${extraSteps} 步`,
            className: "text-sky-200",
        }
    }

    return {
        label: "探索完成",
        detail: `比最短路线多 ${extraSteps} 步`,
        className: "text-amber-100",
    }
}

function CompassDial({ facing }: { facing: MazeFacing }) {
    return (
        <div
            className="relative h-12 w-12 shrink-0 rounded-full border border-[oklch(0.74_0.08_151/0.55)] bg-[oklch(0.18_0.025_171)] shadow-[inset_0_0_0_3px_oklch(0.13_0.02_171)]"
            aria-label={`当前朝向：${FACING_LABELS[facing]}`}
        >
            <span className="absolute left-1/2 top-0.5 -translate-x-1/2 text-[8px] font-black text-lime-200">北</span>
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-100/55">南</span>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-100/55">西</span>
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-100/55">东</span>
            <span
                className="absolute left-1/2 top-1/2 h-7 w-2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                style={{ transform: `translate(-50%, -50%) rotate(${facing * 90}deg)` }}
                aria-hidden="true"
            >
                <span className="absolute left-1/2 top-0 h-4 w-2 -translate-x-1/2 [clip-path:polygon(50%_0,100%_100%,50%_78%,0_100%)] bg-amber-300" />
                <span className="absolute bottom-0 left-1/2 h-3 w-1 -translate-x-1/2 bg-emerald-200/45" />
            </span>
        </div>
    )
}

function ExplorerMarker({ facing }: { facing: MazeFacing }) {
    return (
        <span
            className="relative grid h-[155%] w-[155%] place-items-center transition-transform duration-150 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `rotate(${facing * 90}deg)` }}
            aria-hidden="true"
        >
            <span className="absolute bottom-[46%] left-1/2 h-[245%] w-[185%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_100%,oklch(0.9_0.17_95/0.5),oklch(0.77_0.13_118/0.16)_42%,transparent_72%)] [clip-path:polygon(50%_100%,2%_0,98%_0)]" />
            <svg
                viewBox="0 0 36 36"
                className="relative h-full w-full overflow-visible drop-shadow-[0_2px_3px_oklch(0.08_0.02_165/0.9)]"
            >
                <circle cx="18" cy="19" r="12" fill="oklch(0.29 0.08 158)" stroke="oklch(0.96 0.03 105)" strokeWidth="2.5" />
                <path d="M18 2L26 17L18 13L10 17Z" fill="oklch(0.86 0.18 92)" stroke="oklch(0.98 0.03 95)" strokeWidth="1.5" />
                <circle cx="18" cy="21" r="4.5" fill="oklch(0.93 0.04 91)" />
                <path d="M13 28Q18 24 23 28" fill="none" stroke="oklch(0.79 0.12 153)" strokeWidth="3" strokeLinecap="round" />
            </svg>
        </span>
    )
}

function FogMazeBoard({
    maze,
    size,
    player,
    facing,
    visibleCells,
    exploredCells,
    trail,
    revealed,
    visitedSet,
    pathSet,
}: {
    maze: boolean[][]
    size: number
    player: { row: number; col: number }
    facing: MazeFacing
    visibleCells: Set<string>
    exploredCells: Set<string>
    trail: Array<{ row: number; col: number }>
    revealed: boolean
    visitedSet: Set<string>
    pathSet: Set<string>
}) {
    const trailSet = useMemo(
        () => new Set(trail.slice(0, -1).map((point) => `${point.row},${point.col}`)),
        [trail],
    )

    return (
        <section
            className="maze-view-enter relative mx-auto aspect-square w-full max-w-[680px] select-none overflow-hidden rounded-lg border border-[oklch(0.54_0.075_158)] bg-[oklch(0.115_0.018_172)] p-2 shadow-[0_26px_62px_-34px_oklch(0.08_0.025_165),inset_0_1px_0_oklch(0.8_0.06_151/0.18)] sm:p-3"
            aria-label={revealed ? "已揭开的完整迷宫地图" : "带迷雾的迷宫探索地图"}
        >
            <div
                className="relative h-full w-full overflow-hidden rounded-md bg-[oklch(0.13_0.02_171)]"
                style={{
                    backgroundImage: "radial-gradient(circle at 50% 45%, oklch(0.3 0.045 156 / 0.28), transparent 68%)",
                }}
            >
                <div
                    className="grid h-full w-full"
                    style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
                >
                    {maze.map((row, rowIndex) =>
                        row.map((wall, columnIndex) => {
                            const cellKey = `${rowIndex},${columnIndex}`
                            const known = revealed || exploredCells.has(cellKey)
                            const currentlyVisible = revealed || visibleCells.has(cellKey)
                            const isGoal = rowIndex === size - 2 && columnIndex === size - 2
                            const showGoal = isGoal && known
                            const showTrail = !wall && trailSet.has(cellKey)

                            return (
                                <span
                                    key={cellKey}
                                    className={cn(
                                        "relative aspect-square",
                                        !known && "bg-[oklch(0.075_0.012_174)] shadow-[inset_0_0_0_0.5px_oklch(0.15_0.018_169/0.34)]",
                                        known && wall && currentlyVisible && "bg-[oklch(0.56_0.055_151)] shadow-[inset_0_0_0_1px_oklch(0.78_0.075_145/0.52)]",
                                        known && wall && !currentlyVisible && "bg-[oklch(0.34_0.032_158)] shadow-[inset_0_0_0_1px_oklch(0.48_0.045_151/0.28)]",
                                        known && !wall && currentlyVisible && "bg-[oklch(0.19_0.035_169)] shadow-[inset_0_0_0_0.5px_oklch(0.48_0.07_153/0.2)]",
                                        known && !wall && !currentlyVisible && "bg-[oklch(0.125_0.018_172)] shadow-[inset_0_0_0_0.5px_oklch(0.31_0.035_159/0.18)]",
                                        !wall && visitedSet.has(cellKey) && "bg-sky-400/35",
                                        !wall && pathSet.has(cellKey) && "bg-lime-400/55",
                                        showGoal && "maze-goal-cell bg-[oklch(0.69_0.14_90)]",
                                    )}
                                    aria-hidden="true"
                                >
                                    {known && wall ? (
                                        <span
                                            className={cn(
                                                "absolute inset-[12%] rounded-[1px] border",
                                                currentlyVisible
                                                    ? "border-[oklch(0.82_0.065_144/0.36)] bg-[oklch(0.74_0.06_146/0.2)] shadow-[inset_0_1px_0_oklch(0.9_0.04_141/0.2)]"
                                                    : "border-[oklch(0.53_0.045_151/0.22)] bg-[oklch(0.5_0.04_151/0.12)]",
                                            )}
                                        />
                                    ) : null}
                                    {showTrail && currentlyVisible ? (
                                        <span className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/45" />
                                    ) : null}
                                    {showGoal ? (
                                        <span className="absolute inset-0 grid place-items-center">
                                            <Sparkles className="h-[62%] w-[62%] text-amber-50 drop-shadow" />
                                        </span>
                                    ) : null}
                                </span>
                            )
                        }),
                    )}
                </div>

                <div
                    className="pointer-events-none absolute left-0 top-0 z-20 grid place-items-center transition-transform duration-180 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                    style={{
                        width: `${100 / size}%`,
                        height: `${100 / size}%`,
                        transform: `translate(${player.col * 100}%, ${player.row * 100}%)`,
                    }}
                >
                    <ExplorerMarker facing={facing} />
                </div>
            </div>

            {!revealed ? (
                <div className="pointer-events-none absolute inset-2 rounded-md shadow-[inset_0_0_48px_22px_oklch(0.08_0.02_170/0.58)] sm:inset-3" />
            ) : null}
        </section>
    )
}

function DirectionPad({
    moves,
    facing,
    status,
    onMove,
}: {
    moves: Record<MazeMoveDirection, boolean>
    facing: MazeFacing
    status: "playing" | "won"
    onMove: (direction: MazeMoveDirection) => void
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black text-emerald-50">移动方向</p>
                <p className="text-[10px] font-semibold text-emerald-100/50">方向固定，不随视角改变</p>
            </div>
            <div className="mx-auto grid w-full max-w-[230px] grid-cols-3 grid-rows-3 gap-2">
                {MOVE_META.map(({ direction, label, compass, icon: Icon, position }) => {
                    const open = moves[direction]
                    return (
                        <button
                            key={direction}
                            type="button"
                            className={cn(
                                "relative flex min-h-14 flex-col items-center justify-center rounded-md border text-xs font-black transition-[transform,background-color,border-color,color] duration-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 active:translate-y-px active:scale-[0.96] sm:min-h-16",
                                position,
                                open
                                    ? "border-[oklch(0.66_0.11_151)] bg-[oklch(0.27_0.065_157)] text-emerald-50 hover:bg-[oklch(0.33_0.08_153)]"
                                    : "border-[oklch(0.28_0.035_165)] bg-[oklch(0.145_0.02_173)] text-emerald-100/38 hover:border-amber-300/35 hover:text-amber-100/62",
                            )}
                            onClick={() => onMove(direction)}
                            disabled={status === "won"}
                            aria-label={`${label}（${compass}）${open ? "，可以通行" : "，前方是墙"}`}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="mt-0.5">{label}</span>
                            {!open ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-300/45" /> : null}
                        </button>
                    )
                })}
                <div className="col-start-2 row-start-2 grid min-h-14 place-items-center sm:min-h-16">
                    <span
                        className="grid h-11 w-11 place-items-center rounded-full border border-[oklch(0.5_0.07_154)] bg-[oklch(0.18_0.035_164)] text-amber-200"
                        aria-label={`角色面向${FACING_LABELS[facing]}`}
                    >
                        <Compass
                            className="h-5 w-5 transition-transform duration-150 motion-reduce:transition-none"
                            style={{ transform: `rotate(${facing * 90}deg)` }}
                        />
                    </span>
                </div>
            </div>
        </div>
    )
}

function MobileDirectionBar({
    moves,
    facing,
    status,
    onMove,
}: {
    moves: Record<MazeMoveDirection, boolean>
    facing: MazeFacing
    status: "playing" | "won"
    onMove: (direction: MazeMoveDirection) => void
}) {
    return (
        <section className="mt-2 border-t border-emerald-100/10 pt-2 lg:hidden" aria-label="手机移动方向">
            <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
                <p className="text-[11px] font-black text-emerald-50">地图方向</p>
                <p className="text-[10px] font-semibold text-emerald-100/48">撞墙只转向，不计步</p>
            </div>
            <div className="mx-auto grid w-full max-w-[192px] grid-cols-3 grid-rows-3 gap-1.5">
                {MOVE_META.map((meta) => {
                    const { direction, position } = meta
                    const open = moves[direction]
                    const Icon = meta.icon
                    return (
                        <button
                            key={direction}
                            type="button"
                            className={cn(
                                "relative flex aspect-square min-h-12 flex-col items-center justify-center rounded-sm border text-xs font-black transition-[transform,background-color,border-color,color] duration-100 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 active:scale-[0.96]",
                                position,
                                open
                                    ? "border-[oklch(0.66_0.11_151)] bg-[oklch(0.27_0.065_157)] text-emerald-50"
                                    : "border-[oklch(0.28_0.035_165)] bg-[oklch(0.145_0.02_173)] text-emerald-100/42",
                            )}
                            onClick={() => onMove(direction)}
                            disabled={status === "won"}
                            aria-label={`${meta.label}（${meta.compass}）${open ? "，可以通行" : "，前方是墙"}`}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="mt-0.5">{meta.label.slice(1)}</span>
                            {!open ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-300/45" /> : null}
                        </button>
                    )
                })}
                <div className="col-start-2 row-start-2 grid aspect-square min-h-12 place-items-center rounded-sm border border-emerald-100/12 bg-[oklch(0.16_0.026_171)] text-amber-200">
                    <Compass
                        className="h-5 w-5 transition-transform duration-150 motion-reduce:transition-none"
                        style={{ transform: `rotate(${facing * 90}deg)` }}
                        aria-hidden="true"
                    />
                    <span className="sr-only">角色面向{FACING_LABELS[facing]}</span>
                </div>
            </div>
        </section>
    )
}

function MazeReplayPanel({
    unlocked,
    comparisonVisible,
    onToggle,
    demo,
    algorithmComparison,
    runDemo,
    clearDemo,
    inPanel = false,
}: {
    unlocked: boolean
    comparisonVisible: boolean
    onToggle: () => void
    demo: MazeDemo | null
    algorithmComparison: MazeAlgorithmComparison[]
    runDemo: (algorithm: MazeAlgorithm) => void
    clearDemo: () => void
    inPanel?: boolean
}) {
    const activeComparison = demo
        ? algorithmComparison.find((result) => result.algorithm === demo.algorithm)
        : null
    const leastVisited = Math.min(...algorithmComparison.map((result) => result.visitedCount))

    return (
        <section
            className={cn(
                inPanel
                    ? "maze-view-enter mt-3 rounded-lg border border-emerald-100/12 bg-[oklch(0.145_0.024_171)] p-3 sm:p-4"
                    : "mt-5",
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className={cn("flex items-center gap-2 font-black", inPanel && "text-emerald-50")}>
                        <BarChart3 className={cn("h-4 w-4", inPanel ? "text-lime-200" : "text-lime-600 dark:text-lime-300")} />
                        寻路复盘
                    </h2>
                    <p className={cn("mt-1 text-xs", inPanel ? "text-emerald-100/58" : "text-muted-foreground")}>
                        {unlocked ? "比较三种算法探索了多少格、最终走了多少步。" : "先靠自己的观察找到出口，算法地图会在通关后解锁。"}
                    </p>
                </div>
                {unlocked ? (
                    <Button
                        size="sm"
                        variant={comparisonVisible ? "secondary" : "outline"}
                        onClick={onToggle}
                    >
                        {comparisonVisible ? "收起复盘" : "展开复盘"}
                    </Button>
                ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-muted-foreground">
                        <EyeOff className="h-3.5 w-3.5" />
                        尚未解锁
                    </span>
                )}
            </div>

            {comparisonVisible && unlocked ? (
                <div className="maze-view-enter mt-3">
                    <div className="mb-3 flex flex-wrap gap-2">
                        {ALGORITHMS.map((algorithm) => (
                            <Button
                                key={algorithm.key}
                                size="sm"
                                variant={demo?.algorithm === algorithm.key ? "secondary" : "outline"}
                                onClick={() => runDemo(algorithm.key)}
                            >
                                <span className="sm:hidden">{algorithm.shortLabel}</span>
                                <span className="hidden sm:inline">{algorithm.label}</span>
                            </Button>
                        ))}
                        {demo ? (
                            <Button size="sm" variant="ghost" onClick={clearDemo}>清除演示</Button>
                        ) : null}
                    </div>

                    {demo ? (
                        <div
                            className={cn(
                                "mb-3 rounded-md px-3 py-2 text-center text-xs",
                                inPanel
                                    ? "bg-[oklch(0.09_0.018_172)] text-emerald-100/64"
                                    : "bg-muted/45 text-muted-foreground",
                            )}
                        >
                            {demo.done
                                ? `${ALGORITHM_LABELS[demo.algorithm]} 探索 ${demo.visited.length} 格，路线 ${Math.max(demo.path.length - 1, 0)} 步${activeComparison?.visitedCount === leastVisited ? "，本局探索范围最小。" : "。"}`
                                : `${ALGORITHM_LABELS[demo.algorithm]} 正在探索 ${demo.progress}/${demo.visited.length} 格`}
                        </div>
                    ) : null}

                    <div className="grid gap-2 sm:grid-cols-3">
                        {algorithmComparison.map((result) => {
                            const meta = ALGORITHMS.find((algorithm) => algorithm.key === result.algorithm)!
                            const isActive = demo?.algorithm === result.algorithm
                            const isLeastVisited = result.visitedCount === leastVisited
                            return (
                                <button
                                    key={result.algorithm}
                                    type="button"
                                    onClick={() => runDemo(result.algorithm)}
                                    className={cn(
                                        "rounded-md border px-3 py-3 text-left transition-[transform,background-color,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.98]",
                                        inPanel
                                            ? isActive
                                                ? "border-lime-300/70 bg-lime-300/12 text-emerald-50"
                                                : "border-emerald-100/14 bg-[oklch(0.115_0.018_172)] text-emerald-50 hover:border-lime-300/55 hover:bg-lime-300/8"
                                            : isActive
                                                ? "border-lime-500 bg-lime-500/10"
                                                : "border-border bg-background hover:border-lime-500/55 hover:bg-lime-500/5",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold">{meta.label}</span>
                                        {isLeastVisited ? (
                                            <span
                                                className={cn(
                                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                                    inPanel
                                                        ? "bg-lime-300/15 text-lime-100"
                                                        : "bg-lime-500/15 text-lime-700 dark:text-lime-300",
                                                )}
                                            >
                                                探索最少
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className={cn("mt-1 min-h-8 text-xs leading-4", inPanel ? "text-emerald-100/55" : "text-muted-foreground")}>
                                        {meta.description}
                                    </p>
                                    <div className={cn("mt-3 flex items-end justify-between gap-2 text-xs", inPanel && "text-emerald-100/70")}>
                                        <span>探索 <strong className={cn("text-base", inPanel ? "text-emerald-50" : "text-foreground")}>{result.visitedCount}</strong> 格</span>
                                        <span>路线 <strong className={cn("text-base", inPanel ? "text-emerald-50" : "text-foreground")}>{result.pathSteps}</strong> 步</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : null}
        </section>
    )
}

export default function MazePage() {
    const game = useMazeRunner(13)
    const { checkBadges } = useGamification()
    const [comparisonVisible, setComparisonVisible] = useState(false)
    const [showControlHint, setShowControlHint] = useState(true)
    const [moveFeedback, setMoveFeedback] = useState({ tick: 0, message: "使用方向键或下方方向盘开始探索" })
    const replayUnlocked = game.status === "won"
    const routeReview = getRouteReview(game.status, game.steps, game.optimalSteps)
    const { move, status } = game

    const handleMove = useCallback(
        (direction: MazeMoveDirection) => {
            if (status === "won") return
            const directionMeta = MOVE_META.find((item) => item.direction === direction)!
            const moved = move(direction)
            setShowControlHint(false)
            setMoveFeedback((current) => ({
                tick: current.tick + 1,
                message: moved
                    ? `${directionMeta.label}前进，新的区域已加入记忆地图`
                    : `${directionMeta.label}是墙，角色已转向查看`,
            }))
        },
        [move, status],
    )

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target
            if (
                target instanceof HTMLInputElement
                || target instanceof HTMLTextAreaElement
                || (target instanceof HTMLElement && target.isContentEditable)
            ) {
                return
            }

            const key = event.key.toLowerCase()
            const direction =
                key === "arrowup" || key === "w"
                    ? "up"
                    : key === "arrowright" || key === "d"
                        ? "right"
                        : key === "arrowdown" || key === "s"
                            ? "down"
                            : key === "arrowleft" || key === "a"
                                ? "left"
                                : null

            if (!direction) return
            event.preventDefault()
            handleMove(direction)
        }

        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [handleMove])

    useEffect(() => {
        if (game.status !== "won") return
        setComparisonVisible(true)
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

    const visitedSet = useMemo(() => {
        const result = new Set<string>()
        if (!game.demo) return result
        for (let index = 0; index < game.demo.progress; index++) {
            const point = game.demo.visited[index]
            if (point) result.add(`${point.row},${point.col}`)
        }
        return result
    }, [game.demo])

    const pathSet = useMemo(() => {
        const result = new Set<string>()
        if (!game.demo?.done) return result
        for (const point of game.demo.path) result.add(`${point.row},${point.col}`)
        return result
    }, [game.demo])

    const facingDelta = FACING_DELTAS[game.facing]

    const startNewGame = (size?: MazeSize) => {
        game.startNewGame(size)
        setComparisonVisible(false)
        setShowControlHint(true)
        setMoveFeedback({ tick: 0, message: "使用方向键或下方方向盘开始探索" })
    }

    return (
        <div className="playground-game-page">
            <div className="playground-game-main justify-start px-3 py-4 sm:px-6 sm:py-6 xl:px-8 xl:py-8">
                <div className="w-full max-w-6xl">
                    <header className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-lime-400/35 bg-lime-500/10 text-lime-600 dark:text-lime-300">
                                <Compass className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <h1 className="text-lg font-black tracking-tight sm:text-xl">迷宫探险</h1>
                                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                    记住走过的岔路，找到藏在迷雾里的出口。
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() => startNewGame()}
                            aria-label="生成新迷宫"
                        >
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </header>

                    <div className="overflow-hidden rounded-xl border border-[oklch(0.32_0.045_164)] bg-[oklch(0.12_0.02_174)] shadow-[0_28px_72px_-44px_oklch(0.08_0.03_165)]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[oklch(0.3_0.04_163)] px-3 py-3 sm:px-4">
                            <div className="flex items-center gap-4 text-emerald-50">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/48">本次探索</p>
                                    <p className="mt-0.5 text-lg font-black tabular-nums">{game.steps} <span className="text-xs font-bold">步</span></p>
                                </div>
                                <div className="h-8 w-px bg-emerald-100/12" />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/48">已知区域</p>
                                    <p className="mt-0.5 text-lg font-black tabular-nums">{game.exploredCells.size} <span className="text-xs font-bold">格</span></p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                                <span className="hidden text-xs font-bold text-emerald-100/58 md:inline">关卡</span>
                                {SIZES.map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        className={cn(
                                            "min-h-10 min-w-9 rounded-sm border px-1.5 text-xs font-black transition-[transform,background-color,border-color,color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 active:scale-[0.97] sm:px-2",
                                            game.size === size
                                                ? "border-lime-300/70 bg-lime-300 text-[oklch(0.13_0.025_171)]"
                                                : "border-emerald-100/15 text-emerald-100/62 hover:bg-emerald-100/10 hover:text-emerald-50",
                                        )}
                                        onClick={() => startNewGame(size)}
                                        aria-label={`${SIZE_LABELS[size]}关，${size}×${size}`}
                                    >
                                        <span className="sm:hidden">{size}</span>
                                        <span className="hidden sm:inline">{size}×{size}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid lg:grid-cols-[minmax(0,1fr)_250px]">
                            <div
                                key={moveFeedback.tick}
                                className={cn(
                                    "relative min-w-0 p-2 sm:p-4 lg:p-5",
                                    moveFeedback.message.includes("是墙") && "maze-collision-shake",
                                )}
                            >
                                {showControlHint && game.status === "playing" ? (
                                    <div className="mb-3 hidden items-start gap-2 rounded-md border border-amber-200/25 bg-[oklch(0.22_0.04_89)] px-3 py-2 text-xs font-semibold leading-5 text-amber-50 sm:flex">
                                        <Compass className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                                        <span>方向键始终对应地图上下左右；撞墙时只会转向，不会计步。</span>
                                    </div>
                                ) : null}

                                <div className="mb-2 flex items-center justify-between gap-2 px-0.5 text-[10px] font-bold text-emerald-100/58">
                                    <span>地图图例</span>
                                    <div className="flex items-center gap-3" aria-label="地图图例：浅色方块是墙，深色连通区域是路，黑色区域尚未探索">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-3 w-3 rounded-[2px] border border-[oklch(0.78_0.075_145/0.52)] bg-[oklch(0.56_0.055_151)]" />
                                            墙
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-3 w-3 rounded-[2px] bg-[oklch(0.19_0.035_169)]" />
                                            路
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="h-3 w-3 rounded-[2px] bg-[oklch(0.075_0.012_174)] shadow-[inset_0_0_0_1px_oklch(0.15_0.018_169)]" />
                                            未探索
                                        </span>
                                    </div>
                                </div>

                                <FogMazeBoard
                                    maze={game.maze}
                                    size={game.size}
                                    player={game.player}
                                    facing={game.facing}
                                    visibleCells={game.visibleCells}
                                    exploredCells={game.exploredCells}
                                    trail={game.trail}
                                    revealed={game.revealed}
                                    visitedSet={visitedSet}
                                    pathSet={pathSet}
                                />

                                <p className="sr-only" aria-live="polite">{moveFeedback.message}</p>

                                {game.status === "playing" ? (
                                    <MobileDirectionBar
                                        moves={game.absoluteMoves}
                                        facing={game.facing}
                                        status={game.status}
                                        onMove={handleMove}
                                    />
                                ) : (
                                    <div className="maze-view-enter mt-3 flex flex-col gap-3 rounded-lg border border-lime-300/35 bg-[oklch(0.25_0.07_151)] p-4 text-emerald-50 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lime-300 text-[oklch(0.15_0.03_165)]">
                                                <Trophy className="h-5 w-5" />
                                            </span>
                                            <div>
                                                <p className="font-black">找到出口，用了 {game.steps} 步</p>
                                                <p className="mt-0.5 text-xs text-emerald-100/68">
                                                    全图已揭开，最短路线是 {game.optimalSteps} 步。
                                                </p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => startNewGame()}>
                                            再探一座迷宫
                                        </Button>
                                    </div>
                                )}

                                {game.status === "won" ? (
                                    <MazeReplayPanel
                                        unlocked={replayUnlocked}
                                        comparisonVisible={comparisonVisible}
                                        onToggle={() => setComparisonVisible((visible) => !visible)}
                                        demo={game.demo}
                                        algorithmComparison={game.algorithmComparison}
                                        runDemo={game.runDemo}
                                        clearDemo={game.clearDemo}
                                        inPanel
                                    />
                                ) : null}
                            </div>

                            <aside className="hidden border-l border-[oklch(0.3_0.04_163)] bg-[oklch(0.155_0.027_170)] p-4 lg:block">
                                <div className="mb-4 flex items-center gap-3 border-b border-emerald-100/10 pb-4">
                                    <CompassDial facing={game.facing} />
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/45">你正面朝向</p>
                                        <p className="mt-1 font-black text-emerald-50">
                                            {FACING_LABELS[game.facing]}
                                            <span className="ml-1 text-xs font-semibold text-emerald-100/52">
                                                {facingDelta.row === -1 ? "（北）" : facingDelta.row === 1 ? "（南）" : facingDelta.col === 1 ? "（东）" : "（西）"}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {game.status === "playing" ? (
                                    <DirectionPad
                                        moves={game.absoluteMoves}
                                        facing={game.facing}
                                        status={game.status}
                                        onMove={handleMove}
                                    />
                                ) : (
                                    <div className="rounded-md border border-lime-300/22 bg-lime-300/8 px-3 py-3 text-emerald-50">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="h-4 w-4 text-lime-200" />
                                            <p className="text-sm font-black">复盘已解锁</p>
                                        </div>
                                        <p className="mt-1 text-[11px] font-semibold leading-4 text-emerald-100/58">
                                            方向控制已收起，可以在地图下方播放 BFS / DFS / A*。
                                        </p>
                                    </div>
                                )}

                                <div className="mt-4 border-t border-emerald-100/10 pt-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100/45">路线状态</p>
                                            <p className={cn("mt-1 text-sm font-black", routeReview.className)}>{routeReview.label}</p>
                                        </div>
                                        <p className="max-w-[120px] text-right text-[11px] font-semibold leading-4 text-emerald-100/52">
                                            {routeReview.detail}
                                        </p>
                                    </div>
                                    <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-100/48">
                                        <Footprints className="h-3.5 w-3.5" />
                                        亮处是当前视野，暗处是走过的记忆。
                                    </p>
                                </div>
                            </aside>
                        </div>
                    </div>

                    {!replayUnlocked ? (
                        <MazeReplayPanel
                            unlocked={replayUnlocked}
                            comparisonVisible={comparisonVisible}
                            onToggle={() => setComparisonVisible((visible) => !visible)}
                            demo={game.demo}
                            algorithmComparison={game.algorithmComparison}
                            runDemo={game.runDemo}
                            clearDemo={game.clearDemo}
                        />
                    ) : null}

                    <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        {SIZES.map((size) => {
                            const Icon = size >= 21 ? Bot : Trophy
                            return (
                                <div key={size} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-3 text-sm">
                                    <span className="flex items-center gap-2 font-bold text-muted-foreground">
                                        <Icon className="h-4 w-4" />
                                        {size}×{size}
                                    </span>
                                    <strong>{game.stats.bestSteps[size] ?? "暂无"}</strong>
                                </div>
                            )
                        })}
                    </section>
                </div>
            </div>
        </div>
    )
}
