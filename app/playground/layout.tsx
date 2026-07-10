"use client"

import { useCallback, useEffect, useState } from "react"
import {
    AlertTriangle,
    Bomb,
    Bot,
    Brain,
    Calculator,
    ChevronRight,
    Compass,
    Crown,
    Dna,
    Grid3X3,
    Hash,
    Home,
    Layers,
    Medal,
    Palette,
    Settings,
    Trash2,
    Touchpad,
    type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { categoryToneClasses, type CategoryTone } from "@/components/ui/tone-badge"
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

type SteamTag = NonNullable<PlaygroundNavItem["steamTags"]>[number]

const STEAM_DOT_META: Record<SteamTag, { label: string; tone: CategoryTone }> = {
    Science: { label: "科学", tone: "science" },
    Technology: { label: "技术", tone: "tech" },
    Engineering: { label: "工程", tone: "engineering" },
    Arts: { label: "艺术", tone: "art" },
    Math: { label: "数学", tone: "math" },
}

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
        badgeGoal: "运行到 1000 代可解锁长时演化者。",
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
        badgeGoal: "首次合成 2048 可解锁方块合一。",
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
        badgeGoal: "最优步数通关可解锁巴别塔最优解，8 层通关可解锁八层通塔。",
        color: "text-orange-500 dark:text-orange-300",
        steamTags: ["Technology", "Engineering"],
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
        name: "数字华容道",
        nameEn: "15 Puzzle",
        href: "/playground/fifteen",
        icon: Grid3X3,
        description: "排列组合与可解性",
        mission: "滑动数字，还原从 1 到空格的顺序。",
        controls: "点击空格旁的数字移动，可切换 3×3/4×4/5×5。",
        badgeGoal: "通关更大棋盘，刷新最少步数。",
        color: "text-cyan-500 dark:text-cyan-300",
        steamTags: ["Math", "Engineering"],
    },
    {
        name: "记忆翻牌",
        nameEn: "Memory",
        href: "/playground/memory",
        icon: Brain,
        description: "工作记忆与图案联想",
        mission: "记住图案位置，翻出所有配对。",
        controls: "点击两张卡牌，配对成功后会保持翻开。",
        badgeGoal: "完成高难度翻牌可解锁记忆达人。",
        color: "text-fuchsia-500 dark:text-fuchsia-300",
        steamTags: ["Science", "Arts"],
    },
    {
        name: "速算闪电战",
        nameEn: "Quick Math",
        href: "/playground/quickmath",
        icon: Calculator,
        description: "限时心算与连击",
        mission: "60 秒内答对更多四则运算题。",
        controls: "键盘输入或点击屏幕数字键，回车提交。",
        badgeGoal: "冲击高分和最长连击。",
        color: "text-amber-500 dark:text-amber-300",
        steamTags: ["Math"],
    },
    {
        name: "迷宫探险",
        nameEn: "Maze",
        href: "/playground/maze",
        icon: Compass,
        description: "递归生成与寻路算法",
        mission: "从左上角走到右下角终点。",
        controls: "方向键/WASD 或移动端按钮移动。",
        badgeGoal: "用更少步数完成大迷宫。",
        color: "text-lime-500 dark:text-lime-300",
        steamTags: ["Technology", "Science"],
    },
    {
        name: "七巧板",
        nameEn: "Tangram",
        href: "/playground/tangram",
        icon: Palette,
        description: "几何拼合与空间想象",
        mission: "拖拽七块拼图，拼出目标剪影。",
        controls: "拖拽移动，单击旋转 45°，双击翻转平行四边形。",
        badgeGoal: "完成所有剪影挑战。",
        color: "text-violet-500 dark:text-violet-300",
        steamTags: ["Arts", "Math"],
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
                        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-xs"
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
                            className="surface-panel pointer-events-auto w-full max-w-sm p-5 shadow-[0_28px_80px_-42px_hsl(var(--surface-shadow)/0.7)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="mb-4 flex items-center gap-2">
                                <span className="surface-subtle grid h-9 w-9 place-items-center text-primary">
                                    <Settings className="h-4 w-4" />
                                </span>
                                <div>
                                    <h2 className="font-sans text-sm font-black">游乐场设置</h2>
                                    <p className="mt-0.5 text-xs text-muted-foreground">管理本地与云端游戏记录</p>
                                </div>
                            </div>

                            <div className="mb-4 space-y-1.5">
                                {error ? (
                                    <div className="surface-subtle border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                                        {error}
                                    </div>
                                ) : null}
                                {PLAYGROUND_KEYS.map(({ key, label }) => {
                                    const hasData = getPlaygroundItem(key) !== null
                                    const isPending = pendingAction === key || pendingAction === "all"
                                    return (
                                        <div key={key} className="flex items-center justify-between rounded-sm px-2.5 py-2 hover:bg-muted/50">
                                            <span className="text-xs font-semibold">{label}</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => clearOne(key)}
                                                disabled={!hasData || pendingAction !== null}
                                                className="min-h-11 px-3 text-xs font-bold text-destructive hover:bg-destructive/5 hover:text-destructive disabled:text-muted-foreground/30"
                                            >
                                                {hasData ? (isPending ? "处理中..." : "清除") : "无数据"}
                                            </Button>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="border-t border-border pt-3">
                                {!confirmAll ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setConfirmAll(true)}
                                        disabled={pendingAction !== null}
                                        className="min-h-11 w-full gap-2 border-destructive/20 text-xs font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        重置所有游戏数据
                                    </Button>
                                ) : (
                                    <div className="surface-subtle flex flex-col gap-3 border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-center">
                                        <div className="flex min-w-0 flex-1 items-start gap-2">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                                            <p className="text-xs leading-5 text-destructive">确定清除全部游戏数据？此操作不可撤销。</p>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                onClick={clearAll}
                                                disabled={pendingAction !== null}
                                                className="min-h-11 px-4 text-xs"
                                            >
                                                {pendingAction === "all" ? "处理中..." : "确定"}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setConfirmAll(false)}
                                                disabled={pendingAction !== null}
                                                className="min-h-11 px-4 text-xs"
                                            >
                                                取消
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                disabled={pendingAction !== null}
                                className="mt-2 min-h-11 w-full text-xs font-semibold text-muted-foreground"
                            >
                                关闭
                            </Button>
                        </div>
                    </motion.div>
                </>
            ) : null}
        </AnimatePresence>
    )
}

function MobilePlaygroundHeader({ onSettings }: { onSettings: () => void }) {
    const pathname = usePathname()
    const isHome = pathname === "/playground"
    const navItems = [{ name: "首页", href: "/playground", icon: Home }, ...games]

    return (
        <div className="surface-panel sticky top-(--mobile-global-header-height,0px) z-30 rounded-none border-x-0 border-t-0 lg:hidden">
            <div className="flex min-h-14 items-center justify-between gap-3 px-4">
                {isHome ? (
                    <div className="w-11" />
                ) : (
                    <Link
                        href="/playground"
                        className="grid h-11 w-11 place-items-center rounded-sm border border-[hsl(var(--surface-border))] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="返回游乐场首页"
                    >
                        <Home className="h-5 w-5" />
                    </Link>
                )}
                <h1 className="min-w-0 flex-1 truncate text-center font-sans text-lg font-black tracking-tight">
                    {isHome ? "游乐场" : games.find((game) => pathname.startsWith(game.href))?.name ?? "游乐场"}
                </h1>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onSettings}
                    className="h-11 w-11 shrink-0"
                    aria-label="打开游乐场设置"
                >
                    <Settings className="h-5 w-5" />
                </Button>
            </div>
            {!isHome ? (
                <nav className="hidden gap-2 overflow-x-auto px-4 pb-3 no-scrollbar sm:flex" aria-label="游乐场游戏导航">
                    {navItems.map((item) => {
                        const active =
                            pathname === item.href || (item.href !== "/playground" && pathname.startsWith(item.href))
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-sm px-4 text-sm font-bold transition-colors",
                                    active
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        )
                    })}
                </nav>
            ) : null}
        </div>
    )
}

function DesktopSidebar({ onSettings }: { onSettings: () => void }) {
    const pathname = usePathname()

    return (
        <aside className="hidden w-[220px] shrink-0 lg:block">
            <div className="surface-panel sticky top-16 h-[calc(100vh-4rem)] overflow-hidden rounded-none border-y-0 border-l-0 p-4">
                <div className="mb-5">
                    <div className="flex items-center gap-2">
                        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                            <Grid3X3 className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="font-sans text-lg font-black">游乐场</h2>
                            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">进度登录后自动同步</p>
                        </div>
                    </div>
                </div>

                <nav className="flex h-[calc(100%-9.5rem)] flex-col gap-1.5 overflow-y-auto pr-1 no-scrollbar" aria-label="游乐场游戏导航">
                    <Link
                        href="/playground"
                        aria-current={pathname === "/playground" ? "page" : undefined}
                        className={cn(
                            "flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors",
                            pathname === "/playground"
                                ? "bg-primary text-primary-foreground shadow-xs"
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
                                    "group flex min-h-[54px] items-center gap-3 rounded-md px-3 transition-colors",
                                    active
                                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/20"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                                )}
                            >
                                <span className="surface-subtle grid h-8 w-8 shrink-0 place-items-center rounded-sm">
                                    <game.icon className={cn("h-[18px] w-[18px]", active ? game.color : "text-muted-foreground group-hover:text-primary")} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-bold">{game.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground">{game.nameEn || game.description}</span>
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
                                                className={cn(
                                                    "h-1.5 w-1.5 rounded-full",
                                                    categoryToneClasses[STEAM_DOT_META[tag].tone].badge,
                                                )}
                                            />
                                        ))}
                                    </span>
                                ) : null}
                            </Link>
                        )
                    })}
                </nav>

                <div className="mt-4 space-y-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onSettings}
                        className="min-h-11 w-full gap-2 text-xs font-bold"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        设置
                    </Button>
                    <div className="surface-subtle px-3 py-3 text-center">
                        <p className="text-xs font-semibold leading-5 text-muted-foreground">
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

function MissionHintCard({
    kicker,
    icon: Icon,
    tone,
    children,
}: {
    kicker: string
    icon: LucideIcon
    tone: CategoryTone
    children: string
}) {
    const toneClass = categoryToneClasses[tone]

    return (
        <div className={cn("flex min-w-0 items-start gap-3 rounded-sm px-3 py-3", toneClass.bg)}>
            <span
                className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-background/80",
                    toneClass.text,
                )}
            >
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
                <div className={cn("text-xs font-bold", toneClass.text)}>{kicker}</div>
                <p className="mt-0.5 text-sm font-semibold leading-6 text-foreground md:truncate">{children}</p>
            </div>
        </div>
    )
}

function GameMissionCards({ game }: { game: PlaygroundNavItem }) {
    const Icon = game.icon

    return (
        <div className="grid gap-2 p-3 sm:gap-3 lg:grid-cols-3">
            <MissionHintCard kicker="本局目标" icon={Icon} tone="tech">
                {game.mission}
            </MissionHintCard>
            <MissionHintCard kicker="操作提示" icon={Touchpad} tone="science">
                {game.controls}
            </MissionHintCard>
            <MissionHintCard kicker="下一枚徽章" icon={Medal} tone="engineering">
                {game.badgeGoal}
            </MissionHintCard>
        </div>
    )
}

function GameMissionBar({ game }: { game: PlaygroundNavItem }) {
    return (
        <section className="hidden pt-3 sm:block lg:px-8 lg:pt-5">
            <details className="surface-panel group xl:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-black">本局提示</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
                </summary>
                <GameMissionCards game={game} />
            </details>
            <div className="surface-panel hidden xl:block">
                <GameMissionCards game={game} />
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
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] md:min-h-[calc(100vh-4rem)]">
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
