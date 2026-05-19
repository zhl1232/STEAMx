"use client"

import { useCallback, useEffect, useState } from "react"
import {
    AlertTriangle,
    BarChart3,
    Bomb,
    Bot,
    Calculator,
    Crown,
    Dna,
    Grid3X3,
    Hash,
    Home,
    Layers,
    Medal,
    Settings,
    Trash2,
    Touchpad,
    Zap,
    type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useToast } from "@/hooks/use-toast"
import { usePlaygroundSync } from "@/hooks/playground/use-playground-sync"
import { getPlaygroundItem, PLAYGROUND_KEYS, removePlaygroundItem } from "@/lib/playground/storage"
import { cn } from "@/lib/utils"

type PlaygroundNavItem = {
    name: string
    nameEn?: string
    href: string
    icon: LucideIcon
    description: string
    mission: string
    controls: string
    badgeGoal: string
    color: string
    steamTags?: ("Science" | "Technology" | "Engineering" | "Arts" | "Math")[]
}

const STEAM_DOT_META = {
    Science: { label: "科学 Science", color: "bg-blue-500" },
    Technology: { label: "技术 Technology", color: "bg-violet-500" },
    Engineering: { label: "工程 Engineering", color: "bg-orange-500" },
    Arts: { label: "艺术 Arts", color: "bg-fuchsia-500" },
    Math: { label: "数学 Math", color: "bg-emerald-500" },
} as const

const games: PlaygroundNavItem[] = [
    {
        name: "扫雷",
        nameEn: "Minesweeper",
        href: "/playground/minesweeper",
        icon: Bomb,
        description: "概率推演与矩阵计算",
        mission: "推断安全格，避开所有地雷。",
        controls: "点击挖掘，右键或标记模式插旗。",
        badgeGoal: "完成高级难度可解锁排雷专家。",
        color: "text-blue-500 dark:text-blue-300",
        steamTags: ["Science", "Math"],
    },
    {
        name: "五子棋",
        nameEn: "Gomoku",
        href: "/playground/gomoku",
        icon: Bot,
        description: "博弈论与极小极大算法",
        mission: "率先连成五子，识别对手威胁。",
        controls: "点击棋盘落子，可切换人人/AI 模式。",
        badgeGoal: "战胜 AI 可解锁博弈策士。",
        color: "text-violet-500 dark:text-violet-300",
        steamTags: ["Technology"],
    },
    {
        name: "生命游戏",
        nameEn: "Game of Life",
        href: "/playground/life",
        icon: Dna,
        description: "元胞自动机与涌现理论",
        mission: "构造细胞图案，观察涌现结构。",
        controls: "点格子切换生命，播放后观察演化。",
        badgeGoal: "运行到 1000 代可解锁永恒观测者。",
        color: "text-emerald-500 dark:text-emerald-300",
        steamTags: ["Science"],
    },
    {
        name: "2048",
        href: "/playground/2048",
        icon: Grid3X3,
        description: "2 的幂次与贪心策略",
        mission: "合并同数方块，冲击 2048。",
        controls: "方向键、WASD 或滑动移动方块。",
        badgeGoal: "首次合成 2048 可解锁达成徽章。",
        color: "text-amber-500 dark:text-amber-300",
        steamTags: ["Math", "Technology"],
    },
    {
        name: "24 点",
        nameEn: "24 Game",
        href: "/playground/24game",
        icon: Calculator,
        description: "四则运算与组合数学",
        mission: "用四张牌和四则运算凑出 24。",
        controls: "输入表达式，手机可用快捷键盘。",
        badgeGoal: "连续解出 5 题可解锁连胜达人。",
        color: "text-sky-500 dark:text-sky-300",
        steamTags: ["Math"],
    },
    {
        name: "汉诺塔",
        nameEn: "Hanoi",
        href: "/playground/hanoi",
        icon: Layers,
        description: "递归、分治与指数增长",
        mission: "用最少步数搬完整座塔。",
        controls: "选择圆盘，再点击目标柱移动。",
        badgeGoal: "最优步数通关可解锁最优解。",
        color: "text-orange-500 dark:text-orange-300",
        steamTags: ["Technology", "Engineering"],
    },
    {
        name: "排序可视化",
        nameEn: "Sorting",
        href: "/playground/sorting",
        icon: BarChart3,
        description: "五大经典排序算法对比",
        mission: "比较算法如何把数组变成有序。",
        controls: "选择算法、速度和数据量后开始。",
        badgeGoal: "完成多算法对比，点亮排序专家目标。",
        color: "text-cyan-500 dark:text-cyan-300",
        steamTags: ["Technology"],
    },
    {
        name: "数独",
        nameEn: "Sudoku",
        href: "/playground/sudoku",
        icon: Hash,
        description: "CSP 与回溯算法实战",
        mission: "填满九宫格且每行列宫不重复。",
        controls: "选格后输入数字，必要时使用笔记。",
        badgeGoal: "通关困难难度可解锁数独高手。",
        color: "text-rose-500 dark:text-rose-300",
        steamTags: ["Math"],
    },
    {
        name: "N 皇后",
        nameEn: "N-Queens",
        href: "/playground/nqueens",
        icon: Crown,
        description: "回溯搜索与剪枝可视化",
        mission: "放置 N 个互不攻击的皇后。",
        controls: "点击棋盘放置或移除皇后。",
        badgeGoal: "累计手动解出 5 次可解锁回溯专家。",
        color: "text-yellow-500 dark:text-yellow-300",
        steamTags: ["Technology", "Engineering"],
    },
    {
        name: "电路拼图",
        nameEn: "Circuit",
        href: "/playground/circuit",
        icon: Zap,
        description: "串并联与逻辑门探索",
        mission: "连接元件，让电路成功点亮。",
        controls: "旋转、连接或移动元件完成回路。",
        badgeGoal: "完成逻辑门关卡可解锁逻辑门大师。",
        color: "text-teal-500 dark:text-teal-300",
        steamTags: ["Science", "Engineering"],
    },
]

function SettingsDialog({
    open,
    onClose,
    onClearCloud,
    onFlushCloud,
}: {
    open: boolean
    onClose: () => void
    onClearCloud: () => Promise<void>
    onFlushCloud: () => Promise<void>
}) {
    const [confirmAll, setConfirmAll] = useState(false)
    const [pendingAction, setPendingAction] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()

    useEffect(() => {
        if (open) return
        setConfirmAll(false)
        setPendingAction(null)
        setError(null)
    }, [open])

    const runAction = useCallback(
        async (actionKey: string, action: () => Promise<void>, successTitle: string) => {
            setPendingAction(actionKey)
            setError(null)

            try {
                await action()
                toast({ title: successTitle })
                window.location.reload()
            } catch (err) {
                const message = err instanceof Error ? err.message : "操作失败，请稍后重试"
                setError(message)
                toast({
                    title: "操作失败",
                    description: message,
                    variant: "destructive",
                })
            } finally {
                setPendingAction(null)
            }
        },
        [toast],
    )

    const clearOne = useCallback(
        async (key: string) => {
            await runAction(
                key,
                async () => {
                    removePlaygroundItem(key)
                    await onFlushCloud()
                },
                "游戏数据已清除",
            )
        },
        [onFlushCloud, runAction],
    )

    const clearAll = useCallback(async () => {
        await runAction(
            "all",
            async () => {
                PLAYGROUND_KEYS.forEach(({ key }) => removePlaygroundItem(key))
                await onClearCloud()
            },
            "全部游戏数据已重置",
        )
    }, [onClearCloud, runAction])

    return (
        <AnimatePresence>
            {open ? (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.16 }}
                        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div
                            className="pointer-events-auto w-full max-w-sm rounded-[22px] border border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.98)] p-5 shadow-[0_28px_80px_-42px_hsl(var(--surface-shadow)/0.7)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mb-4 flex items-center gap-2">
                                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                                    <Settings className="h-4 w-4" />
                                </span>
                                <div>
                                    <h2 className="font-sans text-sm font-black">游乐场设置</h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">管理本地与云端游戏记录</p>
                                </div>
                            </div>

                            <div className="mb-4 space-y-1.5">
                                {error ? (
                                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                                        {error}
                                    </div>
                                ) : null}
                                {PLAYGROUND_KEYS.map(({ key, label }) => {
                                    const hasData = getPlaygroundItem(key) !== null
                                    const isPending = pendingAction === key || pendingAction === "all"
                                    return (
                                        <div key={key} className="flex items-center justify-between rounded-xl px-2.5 py-2 hover:bg-muted/50">
                                            <span className="text-xs font-semibold">{label}</span>
                                            <button
                                                onClick={() => clearOne(key)}
                                                disabled={!hasData || pendingAction !== null}
                                                className="min-h-8 rounded-full border border-transparent px-3 text-[11px] font-bold text-destructive transition-colors hover:border-destructive/20 hover:bg-destructive/5 disabled:cursor-not-allowed disabled:text-muted-foreground/30"
                                            >
                                                {hasData ? (isPending ? "处理中..." : "清除") : "无数据"}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="border-t border-border pt-3">
                                {!confirmAll ? (
                                    <button
                                        onClick={() => setConfirmAll(true)}
                                        disabled={pendingAction !== null}
                                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-destructive/20 text-xs font-bold text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        重置所有游戏数据
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 p-2">
                                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                                        <p className="flex-1 text-[10px] leading-4 text-destructive">确定清除全部游戏数据？此操作不可撤销。</p>
                                        <button
                                            onClick={clearAll}
                                            disabled={pendingAction !== null}
                                            className="rounded-lg bg-destructive px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-60"
                                        >
                                            {pendingAction === "all" ? "处理中..." : "确定"}
                                        </button>
                                        <button
                                            onClick={() => setConfirmAll(false)}
                                            disabled={pendingAction !== null}
                                            className="px-2 py-1.5 text-[10px] text-muted-foreground disabled:opacity-60"
                                        >
                                            取消
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={onClose}
                                disabled={pendingAction !== null}
                                className="mt-2 min-h-10 w-full text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                            >
                                关闭
                            </button>
                        </div>
                    </motion.div>
                </>
            ) : null}
        </AnimatePresence>
    )
}

function MobilePlaygroundHeader({ onSettings }: { onSettings: () => void }) {
    const pathname = usePathname()
    const navItems = [{ name: "首页", href: "/playground", icon: Home }, ...games]

    return (
        <div className="sticky top-[var(--mobile-global-header-height,0px)] z-30 border-b border-[hsl(var(--surface-border)/0.86)] bg-[hsl(var(--surface-raised)/0.92)] backdrop-blur-xl lg:hidden">
            <div className="flex min-h-14 items-center justify-between px-4">
                <div className="w-10" />
                <h1 className="font-sans text-lg font-black tracking-tight">游乐场</h1>
                <button
                    type="button"
                    onClick={onSettings}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-[hsl(var(--surface-border)/0.85)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="打开游乐场设置"
                >
                    <Settings className="h-5 w-5" />
                </button>
            </div>
            <nav className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar" aria-label="游乐场游戏导航">
                {navItems.map((item) => {
                    const active = pathname === item.href || (item.href !== "/playground" && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-2xl px-4 text-sm font-bold transition-colors",
                                active
                                    ? "bg-foreground text-background shadow-sm"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

function DesktopSidebar({ onSettings }: { onSettings: () => void }) {
    const pathname = usePathname()

    return (
        <aside className="hidden w-[220px] shrink-0 lg:block">
            <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-hidden border-r border-[hsl(var(--surface-border)/0.82)] bg-[hsl(var(--surface-raised)/0.76)] p-4 shadow-[18px_0_54px_-46px_hsl(var(--surface-shadow)/0.7)] backdrop-blur-xl">
                <div className="mb-5">
                    <div className="flex items-center gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                            <Grid3X3 className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="font-sans text-lg font-black">游乐场</h2>
                            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">进度登录后自动同步</p>
                        </div>
                    </div>
                </div>

                <nav className="flex h-[calc(100%-9.5rem)] flex-col gap-1.5 overflow-y-auto pr-1 no-scrollbar" aria-label="游乐场游戏导航">
                    <Link
                        href="/playground"
                        aria-current={pathname === "/playground" ? "page" : undefined}
                        className={cn(
                            "flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-bold transition-colors",
                            pathname === "/playground"
                                ? "bg-foreground text-background shadow-sm"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        <Home className="h-5 w-5" />
                        首页
                    </Link>
                    {games.map((game) => {
                        const active = pathname.startsWith(game.href)
                        return (
                            <Link
                                key={game.href}
                                href={game.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "group flex min-h-[54px] items-center gap-3 rounded-2xl px-3 transition-colors",
                                    active
                                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/20"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                )}
                            >
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-background/80 ring-1 ring-inset ring-border/70 dark:bg-white/[0.05]">
                                    <game.icon className={cn("h-[18px] w-[18px]", active ? game.color : "text-muted-foreground group-hover:text-primary")} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{game.name}</span>
                                    <span className="block truncate text-[10px] text-muted-foreground">{game.nameEn || game.description}</span>
                                </span>
                                {game.steamTags?.length ? (
                                    <span
                                        className="flex items-center gap-1 rounded-full bg-muted px-1.5 py-1"
                                        title={game.steamTags.map((tag) => STEAM_DOT_META[tag].label).join(" / ")}
                                        aria-label={`STEAM 维度：${game.steamTags.map((tag) => STEAM_DOT_META[tag].label).join("、")}`}
                                    >
                                        {game.steamTags.map((tag) => (
                                            <span
                                                key={`${game.href}-${tag}`}
                                                className={cn("h-1.5 w-1.5 rounded-full", STEAM_DOT_META[tag].color)}
                                            />
                                        ))}
                                    </span>
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-4 space-y-2">
                    <button
                        onClick={onSettings}
                        type="button"
                        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--surface-border)/0.84)] text-xs font-bold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        设置
                    </button>
                    <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3 text-center">
                        <p className="text-xs font-bold leading-5 text-muted-foreground">
                            用游戏理解算法
                            <br />
                            用实战拆解原理
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    )
}

function GameMissionBar({ game }: { game: PlaygroundNavItem }) {
    const Icon = game.icon

    return (
        <section className="px-4 pt-4 sm:px-6 lg:px-8 lg:pt-5">
            <div className="app-shell-wide grid w-full gap-3 rounded-[22px] border border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.88)] p-3 shadow-[0_18px_54px_-42px_hsl(var(--surface-shadow)/0.58)] backdrop-blur md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-primary/10 px-3 py-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-background/82 text-primary shadow-sm">
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide text-primary">本局目标</div>
                        <p className="mt-0.5 truncate text-sm font-bold text-foreground">{game.mission}</p>
                    </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-emerald-50/70 px-3 py-3 dark:bg-emerald-400/10">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-600 shadow-sm dark:bg-white/[0.08] dark:text-emerald-300">
                        <Touchpad className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300">操作提示</div>
                        <p className="mt-0.5 truncate text-sm font-bold text-foreground">{game.controls}</p>
                    </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-orange-50/75 px-3 py-3 dark:bg-orange-400/10">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-orange-600 shadow-sm dark:bg-white/[0.08] dark:text-orange-300">
                        <Medal className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">下一枚徽章</div>
                        <p className="mt-0.5 truncate text-sm font-bold text-foreground">{game.badgeGoal}</p>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    const [settingsOpen, setSettingsOpen] = useState(false)
    const { clearCloud, flushToCloud } = usePlaygroundSync()
    const pathname = usePathname()
    const activeGame = games.find((game) => pathname.startsWith(game.href))

    return (
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,4rem))] md:min-h-[calc(100vh-4rem)]">
            <MobilePlaygroundHeader onSettings={() => setSettingsOpen(true)} />
            <div className="relative app-shell-wide flex w-full">
                <DesktopSidebar onSettings={() => setSettingsOpen(true)} />
                <main className="relative min-w-0 flex-1 overflow-x-hidden pb-28 lg:pb-0">
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--brand-blue)/0.12),transparent_34%),radial-gradient(circle_at_88%_8%,hsl(var(--brand-green)/0.12),transparent_30%),linear-gradient(180deg,hsl(var(--app-canvas)),hsl(var(--background))_78%)]" />
                    {activeGame ? <GameMissionBar game={activeGame} /> : null}
                    {children}
                </main>
            </div>
            <SettingsDialog
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                onClearCloud={clearCloud}
                onFlushCloud={flushToCloud}
            />
        </div>
    )
}
