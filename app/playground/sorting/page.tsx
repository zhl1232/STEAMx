"use client"

import { useSortingRace, type SortingAlgorithm, type SortingSpeed } from "@/hooks/playground/use-sorting-race"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Play,
    Pause,
    Shuffle,
    RotateCcw,
    Zap,
    BarChart3,
    Timer,
    ArrowUpDown,
    Brain,
    Sparkles,
} from "lucide-react"

const ALGORITHM_META: { key: SortingAlgorithm; label: string; complexity: string }[] = [
    { key: "bubble", label: "冒泡排序", complexity: "O(n²)" },
    { key: "selection", label: "选择排序", complexity: "O(n²)" },
    { key: "insertion", label: "插入排序", complexity: "O(n²)" },
    { key: "merge", label: "归并排序", complexity: "O(n log n)" },
    { key: "quick", label: "快速排序", complexity: "O(n log n)" },
]

const SPEED_OPTIONS: { key: SortingSpeed; label: string }[] = [
    { key: "slow", label: "慢" },
    { key: "normal", label: "中" },
    { key: "fast", label: "快" },
]

const ARRAY_SIZES = [20, 50, 100] as const

const BAR_COLORS: Record<string, string> = {
    default: "bg-primary/70",
    comparing: "bg-amber-400",
    swapping: "bg-red-400",
    sorted: "bg-emerald-400",
    pivot: "bg-violet-500",
}

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
}

export default function SortingPage() {
    const {
        bars,
        algorithm,
        arraySize,
        status,
        speed,
        comparisons,
        swaps,
        elapsedMs,
        stats,
        setAlgorithm,
        setArraySize,
        setSpeed,
        generateArray,
        start,
        pause,
        resume,
        reset,
    } = useSortingRace()

    const isActive = status === "running" || status === "paused"

    return (
        <div className="flex flex-col xl:flex-row h-full">
            {/* Left: main visualization area */}
            <div className="flex-1 p-2 sm:p-6 xl:p-10 flex flex-col items-center xl:justify-center w-full min-w-0">
                {/* Header */}
                <div className="w-full max-w-5xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-sky-500/10 border border-sky-500/40 flex items-center justify-center shrink-0">
                            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-2xl font-bold tracking-tight leading-tight">
                                排序可视化 · 算法竞赛场
                            </h1>
                            <p className="text-[11px] sm:text-sm text-muted-foreground">
                                观察不同排序算法如何一步步将混乱变为有序。
                            </p>
                        </div>
                    </div>

                    {/* Live counters */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500" />
                            <span className="tabular-nums font-medium">{comparisons}</span>
                            <span className="text-muted-foreground/60">比较</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                            <Shuffle className="w-3.5 h-3.5 text-red-400" />
                            <span className="tabular-nums font-medium">{swaps}</span>
                            <span className="text-muted-foreground/60">交换</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                            <Timer className="w-3.5 h-3.5 text-sky-400" />
                            <span className="tabular-nums font-medium">{formatMs(elapsedMs)}</span>
                        </div>
                    </div>
                </div>

                {/* Algorithm selector */}
                <div className="w-full max-w-5xl flex flex-wrap items-center gap-1.5 mb-2">
                    {ALGORITHM_META.map(({ key, label, complexity }) => (
                        <button
                            key={key}
                            onClick={() => setAlgorithm(key)}
                            disabled={isActive}
                            className={cn(
                                "rounded-full px-3 py-1.5 text-xs font-medium h-8 transition-colors",
                                "disabled:opacity-40 disabled:pointer-events-none",
                                algorithm === key
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border bg-background hover:bg-muted text-muted-foreground",
                            )}
                        >
                            {label}
                            <span className="ml-1 opacity-60">{complexity}</span>
                        </button>
                    ))}
                </div>

                {/* Controls toolbar */}
                <div className="w-full max-w-5xl flex flex-wrap items-center gap-2 mb-3">
                    {/* Play / Pause / Resume */}
                    <button
                        onClick={
                            status === "running"
                                ? pause
                                : status === "paused"
                                  ? resume
                                  : start
                        }
                        className={cn(
                            "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium h-8 transition-colors",
                            status === "running"
                                ? "bg-amber-500 text-white hover:bg-amber-600"
                                : "bg-sky-500 text-white hover:bg-sky-600",
                        )}
                    >
                        {status === "running" ? (
                            <Pause className="w-3.5 h-3.5" />
                        ) : (
                            <Play className="w-3.5 h-3.5" />
                        )}
                        {status === "running" ? "暂停" : status === "paused" ? "继续" : "开始"}
                    </button>

                    {/* Shuffle */}
                    <button
                        onClick={generateArray}
                        disabled={isActive}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                        <Shuffle className="w-3.5 h-3.5" />
                        随机
                    </button>

                    {/* Reset */}
                    <button
                        onClick={reset}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium h-8 border border-border bg-background hover:bg-muted transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重置
                    </button>

                    <div className="w-px h-5 bg-border hidden sm:block" />

                    {/* Array size */}
                    <div className="flex items-center rounded-full border border-border bg-background overflow-hidden h-8">
                        {ARRAY_SIZES.map((size) => (
                            <button
                                key={size}
                                onClick={() => setArraySize(size)}
                                disabled={isActive}
                                className={cn(
                                    "px-2.5 py-1 text-xs transition-colors h-full disabled:opacity-40 disabled:pointer-events-none",
                                    arraySize === size
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "hover:bg-muted text-muted-foreground",
                                )}
                            >
                                {size}
                            </button>
                        ))}
                    </div>

                    {/* Speed */}
                    <div className="flex items-center rounded-full border border-border bg-background overflow-hidden h-8">
                        {SPEED_OPTIONS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setSpeed(key)}
                                className={cn(
                                    "px-2.5 py-1 text-xs transition-colors h-full",
                                    speed === key
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "hover:bg-muted text-muted-foreground",
                                )}
                            >
                                {key === "fast" && <Zap className="w-3 h-3 inline mr-0.5" />}
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Bar visualization */}
                <div className="w-full max-w-5xl rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-2 sm:p-4 shadow-inner">
                    <div className="relative h-[300px] sm:h-[400px] flex items-end gap-px bg-muted/20 rounded-xl overflow-hidden px-1 pb-1">
                        {bars.map((bar, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 min-w-0 rounded-t-sm transition-all duration-100",
                                    BAR_COLORS[bar.state],
                                )}
                                style={{ height: `${bar.value}%` }}
                            />
                        ))}
                        {/* Bottom axis line */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
                    </div>

                    {/* Color legend */}
                    <div className="flex items-center gap-3 mt-2 px-1 flex-wrap">
                        {[
                            { color: "bg-primary/70", label: "默认" },
                            { color: "bg-amber-400", label: "比较中" },
                            { color: "bg-red-400", label: "交换中" },
                            { color: "bg-emerald-400", label: "已排序" },
                            { color: "bg-violet-500", label: "枢轴" },
                        ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <div className={cn("w-2.5 h-2.5 rounded-sm", color)} />
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div className="w-full xl:w-96 border-t xl:border-t-0 xl:border-l border-border bg-card/50 backdrop-blur-2xl flex flex-col h-full z-10">
                <Tabs defaultValue="concepts" className="flex-1 flex flex-col">
                    <div className="border-b border-border px-4 pt-3">
                        <TabsList className="grid grid-cols-2 w-full bg-muted/40">
                            <TabsTrigger value="concepts" className="text-xs sm:text-sm">
                                概念讲解
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
                                    <Brain className="w-4 h-4 text-sky-500" />
                                    排序算法一览
                                </h2>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    排序是计算机科学最基础的操作之一。不同算法在时间复杂度、稳定性和适用场景上各有优劣。
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                                    <h3 className="text-xs font-semibold">冒泡排序 · Bubble Sort</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        反复比较相邻元素，若顺序错误则交换。每轮将最大值「冒泡」到末尾。时间 O(n²)，稳定排序。
                                    </p>
                                </div>
                                <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                                    <h3 className="text-xs font-semibold">选择排序 · Selection Sort</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        每轮从未排序部分找到最小元素，放到已排序部分末尾。时间 O(n²)，不稳定。
                                    </p>
                                </div>
                                <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                                    <h3 className="text-xs font-semibold">插入排序 · Insertion Sort</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        将每个元素插入到前方已排序部分的正确位置，类似整理扑克牌。时间 O(n²)，对近乎有序的数据很高效，稳定。
                                    </p>
                                </div>
                                <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                                    <h3 className="text-xs font-semibold">归并排序 · Merge Sort</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        分治策略：将数组一分为二，递归排序后合并。时间 O(n log n)，稳定，但需要额外空间。
                                    </p>
                                </div>
                                <div className="rounded-xl bg-muted/30 p-3 space-y-1">
                                    <h3 className="text-xs font-semibold">快速排序 · Quick Sort</h3>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        选择一个枢轴（pivot），将数组分为小于和大于枢轴的两部分，递归排序。平均 O(n log n)，最坏 O(n²)，不稳定但实际运行极快。
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground/90 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    颜色含义
                                </h3>
                                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
                                    <li><span className="text-primary font-medium">蓝色</span> — 默认状态，尚未被访问</li>
                                    <li><span className="text-amber-400 font-medium">黄色</span> — 正在比较的元素</li>
                                    <li><span className="text-red-400 font-medium">红色</span> — 正在交换的元素</li>
                                    <li><span className="text-emerald-400 font-medium">绿色</span> — 已经排好序的元素</li>
                                    <li><span className="text-violet-500 font-medium">紫色</span> — 枢轴元素（快速排序/选择排序）</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground/90">
                                    为什么 O(n log n) 重要？
                                </h3>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    当数据量 n 从 100 增长到 10,000 时，O(n²) 算法的操作次数从 10,000 增长到 100,000,000（一亿），而 O(n log n) 只从约 664 增长到约 133,000。规模越大，差距越悬殊——这就是算法效率的力量。
                                </p>
                            </div>

                            <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                                <h3 className="text-xs font-semibold flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                                    试一试
                                </h3>
                                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                                    <li>选择冒泡排序和快速排序分别运行 100 个元素，对比比较和交换次数。</li>
                                    <li>调整速度为「慢」，仔细观察每一步的比较与交换过程。</li>
                                    <li>尝试不同数组大小，感受 O(n²) 和 O(n log n) 的差距。</li>
                                </ul>
                            </div>
                        </TabsContent>

                        <TabsContent value="stats" className="m-0 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-base font-semibold flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-sky-500" />
                                    本地统计
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="rounded-xl bg-muted/30 p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">总运行次数</p>
                                        <p className="text-lg font-bold tabular-nums">{stats.totalRuns}</p>
                                    </div>
                                    <Play className="w-5 h-5 text-muted-foreground/40" />
                                </div>

                                {ALGORITHM_META.map(({ key, label }) => {
                                    const count = stats.algorithmsUsed[key] ?? 0
                                    if (count === 0) return null
                                    return (
                                        <div key={key} className="rounded-xl bg-muted/30 p-3 flex items-center justify-between">
                                            <div>
                                                <p className="text-[11px] text-muted-foreground">{label}</p>
                                                <p className="text-lg font-bold tabular-nums">{count}</p>
                                            </div>
                                            <ArrowUpDown className="w-5 h-5 text-muted-foreground/40" />
                                        </div>
                                    )
                                })}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
