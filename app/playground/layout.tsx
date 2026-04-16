"use client"

import { useState, useCallback, useEffect } from "react"
import { Bomb, Dna, Bot, Grid3X3, Calculator, Layers, BarChart3, Hash, Crown, Home, Settings, Trash2, AlertTriangle, Zap } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { PLAYGROUND_KEYS, removePlaygroundItem, getPlaygroundItem } from "@/lib/playground/storage"
import { usePlaygroundSync } from "@/hooks/playground/use-playground-sync"

const games = [
    {
        name: "扫雷",
        nameEn: "Minesweeper",
        href: "/playground/minesweeper",
        icon: Bomb,
        description: "概率推演与矩阵计算",
        color: "text-blue-500",
        tag: "S·M",
    },
    {
        name: "五子棋",
        nameEn: "Gomoku",
        href: "/playground/gomoku",
        icon: Bot,
        description: "博弈论与极小极大算法",
        color: "text-purple-500",
        tag: "T",
    },
    {
        name: "生命游戏",
        nameEn: "Game of Life",
        href: "/playground/life",
        icon: Dna,
        description: "元胞自动机与涌现理论",
        color: "text-emerald-500",
        tag: "S",
    },
    {
        name: "2048",
        nameEn: "",
        href: "/playground/2048",
        icon: Grid3X3,
        description: "2 的幂次与贪心策略",
        color: "text-amber-500",
        tag: "M·T",
    },
    {
        name: "24 点",
        nameEn: "24 Game",
        href: "/playground/24game",
        icon: Calculator,
        description: "四则运算与组合数学",
        color: "text-violet-500",
        tag: "M",
    },
    {
        name: "汉诺塔",
        nameEn: "Hanoi",
        href: "/playground/hanoi",
        icon: Layers,
        description: "递归、分治与指数增长",
        color: "text-orange-500",
        tag: "T·E",
    },
    {
        name: "排序可视化",
        nameEn: "Sorting",
        href: "/playground/sorting",
        icon: BarChart3,
        description: "五大经典排序算法对比",
        color: "text-cyan-500",
        tag: "T",
    },
    {
        name: "数独",
        nameEn: "Sudoku",
        href: "/playground/sudoku",
        icon: Hash,
        description: "CSP 与回溯算法实战",
        color: "text-rose-500",
        tag: "M",
    },
    {
        name: "N 皇后",
        nameEn: "N-Queens",
        href: "/playground/nqueens",
        icon: Crown,
        description: "回溯搜索与剪枝可视化",
        color: "text-yellow-500",
        tag: "T·E",
    },
    {
        name: "电路拼图",
        nameEn: "Circuit",
        href: "/playground/circuit",
        icon: Zap,
        description: "串并联与逻辑门探索",
        color: "text-teal-500",
        tag: "S·E",
    },
]

function SettingsDialog({ open, onClose, onClearCloud, onFlushCloud }: {
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

    const runAction = useCallback(async (actionKey: string, action: () => Promise<void>, successTitle: string) => {
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
    }, [toast])

    const clearOne = useCallback(async (key: string) => {
        await runAction(key, async () => {
            removePlaygroundItem(key)
            await onFlushCloud()
        }, "游戏数据已清除")
    }, [onFlushCloud, runAction])

    const clearAll = useCallback(async () => {
        await runAction("all", async () => {
            PLAYGROUND_KEYS.forEach(({ key }) => removePlaygroundItem(key))
            await onClearCloud()
        }, "全部游戏数据已重置")
    }, [onClearCloud, runAction])

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 8 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="w-full max-w-sm bg-popover border border-border rounded-2xl shadow-2xl p-5 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Settings className="w-4 h-4 text-primary" />
                                <h2 className="text-sm font-bold">游乐场设置</h2>
                            </div>

                            <div className="space-y-1.5 mb-4">
                                <p className="text-xs text-muted-foreground mb-2">登录后数据自动云同步，清除将同时删除本地和云端记录</p>
                                {error && (
                                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                                        {error}
                                    </div>
                                )}
                                {PLAYGROUND_KEYS.map(({ key, label }) => {
                                    const hasData = getPlaygroundItem(key) !== null
                                    const isPending = pendingAction === key || pendingAction === "all"
                                    return (
                                        <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40">
                                            <span className="text-xs font-medium">{label}</span>
                                            <button
                                                onClick={() => clearOne(key)}
                                                disabled={!hasData || pendingAction !== null}
                                                className="text-[10px] text-destructive hover:text-destructive/80 disabled:text-muted-foreground/30 disabled:cursor-not-allowed transition-colors px-2 py-0.5 rounded border border-transparent hover:border-destructive/20"
                                            >
                                                {hasData ? (isPending ? "处理中..." : "清除") : "无数据"}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="border-t border-border pt-3 space-y-2">
                                {!confirmAll ? (
                                    <button
                                        onClick={() => setConfirmAll(true)}
                                        disabled={pendingAction !== null}
                                        className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-destructive py-2 rounded-xl border border-destructive/20 hover:bg-destructive/5 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        重置所有游戏数据
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 p-2 bg-destructive/5 rounded-xl border border-destructive/20">
                                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                                        <p className="text-[10px] text-destructive flex-1">确定清除全部游戏数据？此操作不可撤销。</p>
                                        <button onClick={clearAll} disabled={pendingAction !== null} className="text-[10px] font-bold text-white bg-destructive px-2 py-1 rounded-md hover:bg-destructive/90 disabled:opacity-60">
                                            {pendingAction === "all" ? "处理中..." : "确定"}
                                        </button>
                                        <button onClick={() => setConfirmAll(false)} disabled={pendingAction !== null} className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 disabled:opacity-60">
                                            取消
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={onClose}
                                disabled={pendingAction !== null}
                                className="w-full text-xs text-muted-foreground hover:text-foreground py-2 mt-2 transition-colors"
                            >
                                关闭
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const { clearCloud, flushToCloud } = usePlaygroundSync()

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card/30 backdrop-blur-xl p-4 flex flex-col gap-2 md:gap-4 shrink-0 z-10">
                <div className="flex items-center justify-between md:hidden">
                    <div>
                        <p className="text-sm font-semibold">游乐场</p>
                        <p className="text-[11px] text-muted-foreground">本地进度会在登录后自动同步到云端</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="inline-flex items-center justify-center rounded-xl border border-border p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        aria-label="打开游乐场设置"
                    >
                        <Settings className="h-4 w-4" />
                    </button>
                </div>
                <nav className="flex-1 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible md:overflow-y-auto pb-2 md:pb-0 scrollbar-none md:space-y-0.5">
                    <Link
                        href="/playground"
                        className={cn(
                            "flex-shrink-0 flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-2 p-2 md:px-3 md:py-2 rounded-xl transition-all duration-200 border min-w-[72px] md:min-w-0",
                            pathname === "/playground"
                                ? "bg-primary/10 border-primary/30 text-foreground shadow-sm"
                                : "border-transparent hover:bg-primary/5 hover:border-primary/10 text-muted-foreground"
                        )}
                    >
                        <Home className={cn("w-4 h-4", pathname === "/playground" ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-semibold text-[10px] md:text-xs whitespace-nowrap">首页</span>
                    </Link>
                    <div className="hidden md:block w-full h-px bg-border my-0.5" />
                    {games.map((game) => {
                        const isActive = pathname.startsWith(game.href)
                        return (
                            <Link
                                key={game.href}
                                href={game.href}
                                className={cn(
                                    "flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all duration-200 border min-w-[72px] md:min-w-0",
                                    isActive
                                        ? "bg-primary/10 border-primary/30 text-foreground shadow-sm"
                                        : "border-transparent hover:bg-primary/5 hover:border-primary/10 text-foreground"
                                )}
                            >
                                <div className="md:mt-0.5">
                                    <game.icon className={cn("w-5 h-5", isActive ? game.color : "text-muted-foreground")} />
                                </div>
                                <div className="flex-1 text-center md:text-left min-w-0">
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-1">
                                        <span className={cn(
                                            "font-semibold text-[10px] md:text-sm whitespace-nowrap",
                                            isActive && "text-foreground"
                                        )}>
                                            {game.name}
                                            {game.nameEn && (
                                                <span className="hidden md:inline text-muted-foreground/60 font-normal ml-1">
                                                    {game.nameEn}
                                                </span>
                                            )}
                                        </span>
                                        <span className={cn(
                                            "hidden md:inline text-[9px] px-1.5 py-0.5 rounded-full font-bold tracking-wider",
                                            isActive
                                                ? "bg-primary/15 text-primary"
                                                : "bg-muted/60 text-muted-foreground/60"
                                        )}>
                                            {game.tag}
                                        </span>
                                    </div>
                                    <p className={cn(
                                        "hidden md:block text-xs mt-0.5",
                                        isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                                    )}>
                                        {game.description}
                                    </p>
                                </div>
                            </Link>
                        )
                    })}
                </nav>

                <div className="hidden md:flex flex-col gap-2">
                    <button
                        onClick={() => setSettingsOpen(true)}
                        type="button"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        设置
                    </button>
                    <div className="text-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl border border-border shadow-inner">
                        <p className="text-xs text-primary font-medium">
                            用代码支配游戏
                            <br />
                            在实战中解构原理
                        </p>
                    </div>
                </div>
                <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} onClearCloud={clearCloud} onFlushCloud={flushToCloud} />
            </aside>

            <main className="flex-1 overflow-x-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10 pointer-events-none" />
                {children}
            </main>
        </div>
    )
}
