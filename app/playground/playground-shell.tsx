"use client"

import {
    ArrowLeft,
    BookOpen,
    Bomb,
    Bot,
    Brain,
    Calculator,
    ChevronRight,
    Compass,
    Crosshair,
    Crown,
    Dna,
    Grid3X3,
    Hash,
    Home,
    Layers,
    Scale,
    TableCellsSplit,
    TestTubes,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { GameHelp, type GameHelpShortcut } from "@/components/features/playground/game-help"
import { UserButton } from "@/components/layout/user-button"
import { type CategoryTone } from "@/components/ui/tone-badge"
import { usePlaygroundSync } from "@/hooks/playground/use-playground-sync"
import { cn } from "@/lib/utils"
import { PLAYGROUND_DISCOVERY, PLAYGROUND_DISCOVERY_BY_HREF, PLAYGROUND_GROUPS } from "@/lib/playground/catalog"

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
        controls: "点击挖掘，右键或插旗模式插旗。",
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
        description: "元胞自动机挑战",
        mission: "用有限细胞完成稳定、振荡、传送或长寿目标。",
        controls: "点格子设计初态，运行判定后按细胞预算拿星。",
        badgeGoal: "完成全部 8 个挑战可解锁涌现工程师。",
        color: "text-emerald-500 dark:text-emerald-300",
        steamTags: ["Science"],
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
        name: "记忆翻牌",
        nameEn: "Memory",
        href: "/playground/memory",
        icon: Brain,
        description: "物理与数学概念配对",
        mission: "把名词和对应的解释翻成一对。",
        controls: "点两张牌：紫色是名词，黄色是解释。",
        badgeGoal: "完成高难度翻牌可解锁记忆达人。",
        color: "text-fuchsia-500 dark:text-fuchsia-300",
        steamTags: ["Science", "Arts"],
    },
    {
        name: "迷宫探险",
        nameEn: "Maze",
        href: "/playground/maze",
        icon: Compass,
        description: "五档迷雾地图与算法复盘",
        mission: "辨认墙与道路，避开误导岔路，找到藏在迷雾里的出口。",
        controls: "方向键或 WASD 对应地图上下左右；手机端箭头紧贴地图显示。",
        badgeGoal: "挑战 9×9 至 25×25 五档迷宫的最佳步数。",
        color: "text-lime-500 dark:text-lime-300",
        steamTags: ["Technology", "Science"],
    },
    {
        name: "数织",
        nameEn: "Nonogram",
        href: "/playground/nonogram",
        icon: TableCellsSplit,
        description: "线索推理与像素填图，28 关至 15×15",
        mission: "按顺序解锁，根据行列线索填出隐藏图案。",
        controls: "填色/叉号切换并可滑动连填；须按顺序通关解锁；错填扣试错（3 次）。",
        badgeGoal: "按顺序通关全部数织关卡。",
        color: "text-slate-500 dark:text-slate-300",
        steamTags: ["Math", "Arts"],
    },
    {
        name: "天平称重",
        nameEn: "Balance",
        href: "/playground/balance",
        icon: Scale,
        description: "三分法与科学推理",
        mission: "用有限次称量找出假币。",
        controls: "先选择左盘或右盘，把硬币点入托盘称量，再指认假币。",
        badgeGoal: "用更少称量通关。",
        color: "text-teal-500 dark:text-teal-300",
        steamTags: ["Science", "Math"],
    },
    {
        name: "函数战争",
        nameEn: "Function Wars",
        href: "/playground/functionwars",
        icon: Crosshair,
        description: "函数图像与坐标变换",
        mission: "完成 10 个战役关和 5 个挑战关，用函数弹道清除目标并连接信号中继。",
        controls: "选择武器、输入 f(x)，再开火；可用数学键盘补全函数。",
        badgeGoal: "完成 10 个战役关解锁曲线大师，再完成 5 个挑战关解锁函数指挥官。",
        color: "text-emerald-600 dark:text-emerald-300",
        steamTags: ["Math", "Technology"],
    },
]

const publicGames = PLAYGROUND_DISCOVERY.flatMap((entry) => {
    const game = games.find((item) => item.href === entry.href)
    return game ? [game] : []
})

const GAME_SHORTCUTS: Record<string, GameHelpShortcut[]> = {
    "/playground/minesweeper": [
        { key: "点击", label: "挖掘格子" },
        { key: "右键 / 长按", label: "插旗或取消插旗" },
        { key: "模式按钮", label: "手机切换挖掘与插旗" },
    ],
    "/playground/gomoku": [
        { key: "点击棋盘", label: "在空位落子" },
        { key: "模式选择", label: "切换双人、AI 或在线对局" },
    ],
    "/playground/life": [
        { key: "点击 / 拖动", label: "放置或清除细胞" },
        { key: "Space", label: "运行或暂停" },
        { key: "N", label: "单步演化" },
    ],
    "/playground/24game": [
        { key: "点击数字", label: "输入牌面数字" },
        { key: "+ − × ÷", label: "输入运算符" },
        { key: "Enter", label: "提交表达式" },
    ],
    "/playground/hanoi": [
        { key: "点击柱子", label: "先选圆盘，再选目标柱" },
        { key: "1 / 2 / 3", label: "快速选择三根柱子" },
        { key: "A / B / C", label: "快速选择三根柱子" },
    ],
    "/playground/sudoku": [
        { key: "点击格子", label: "选中待填写位置" },
        { key: "1–9", label: "填写数字" },
        { key: "N", label: "切换笔记模式" },
        { key: "Delete", label: "清除当前格" },
    ],
    "/playground/nqueens": [
        { key: "点击棋盘", label: "放置或移除皇后" },
        { key: "演示", label: "观看回溯搜索过程" },
    ],
    "/playground/memory": [
        { key: "点击卡牌", label: "翻开一张卡牌" },
        { key: "再次点击", label: "寻找相同图案" },
    ],
    "/playground/maze": [
        { key: "↑ / W", label: "向地图上方移动" },
        { key: "→ / D", label: "向地图右方移动" },
        { key: "↓ / S", label: "向地图下方移动" },
        { key: "← / A", label: "向地图左方移动" },
        { key: "手机箭头", label: "直接控制地图上的移动方向" },
    ],
    "/playground/nonogram": [
        { key: "点击 / 滑动", label: "连续填色或标叉" },
        { key: "模式按钮", label: "切换填色与叉号" },
    ],
    "/playground/balance": [
        { key: "左盘 / 右盘", label: "选择当前投放托盘" },
        { key: "点击硬币", label: "放入当前托盘或从原盘移除" },
        { key: "称量", label: "比较两侧重量" },
        { key: "指认", label: "选择你认为的假币" },
    ],
    "/playground/functionwars": [
        { key: "输入 f(x)", label: "定义炮弹相对炮口的轨迹" },
        { key: "Enter", label: "按当前函数开火" },
        { key: "武器栏", label: "切换标准弹与特殊武器" },
        { key: "网格", label: "显示或隐藏坐标刻度" },
    ],
}

function GameNavGlyph({
    href,
    icon: Icon,
    active,
}: {
    href: string
    icon: LucideIcon
    active: boolean
}) {
    const customGlyph = (() => {
        switch (href) {
            case "/playground/nonogram":
                return (
                    <>
                        <rect x="5" y="5" width="22" height="22" rx="5" className="fill-slate-50 stroke-slate-300 dark:fill-slate-950 dark:stroke-slate-300/30" />
                        {[
                            [10, 10], [15, 10], [20, 10], [15, 15], [10, 20], [15, 20], [20, 20],
                        ].map(([x, y]) => (
                            <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="0.8" className="fill-slate-800 dark:fill-slate-100" />
                        ))}
                        <text x="8" y="13" className="fill-slate-400 text-[4px] font-black">3</text>
                    </>
                )
            case "/playground/balance":
                return (
                    <>
                        <path d="M16 7 V25" className="stroke-teal-800 dark:stroke-teal-100" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M8 12 L25 10" className="stroke-teal-800 dark:stroke-teal-100" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M8 12 L5 19 H12 Z" className="fill-teal-500 dark:fill-teal-300" />
                        <path d="M25 10 L21 17 H29 Z" className="fill-amber-400 dark:fill-amber-300" />
                        <rect x="11" y="25" width="10" height="2.5" rx="1.2" className="fill-teal-800 dark:fill-teal-100" />
                    </>
                )
            default:
                return null
        }
    })()

    return (
        <span
            className={cn(
                "surface-subtle grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-sm",
                active && "bg-background/90",
            )}
        >
            {customGlyph ? (
                <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
                    {customGlyph}
                </svg>
            ) : (
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
            )}
        </span>
    )
}

function MobilePlaygroundHeader() {
    const pathname = usePathname()
    const isHome = pathname === "/playground"
    const activeGame = games.find((game) => pathname.startsWith(game.href))

    return (
        <div className="playground-mobile-header surface-panel sticky top-(--mobile-global-header-height,0px) z-30 rounded-none border-x-0 border-t-0 lg:hidden">
            {/* 手机端只保留一行：返回 · 标题 · 账号/玩法说明 */}
            <nav className="flex min-h-14 items-center gap-2 px-2" aria-label="主站与账号导航">
                {isHome ? (
                    <Link href="/explore" aria-label="返回项目" title="返回项目" className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-foreground hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" aria-hidden />
                    </Link>
                ) : (
                    <Link
                        href="/playground"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-foreground hover:bg-muted"
                        aria-label="返回游乐场首页"
                    >
                        <ArrowLeft className="h-5 w-5" aria-hidden />
                    </Link>
                )}
                <h1 className="min-w-0 flex-1 truncate text-center font-sans text-lg font-black tracking-tight">
                    {isHome ? "游乐场" : activeGame?.name ?? "游乐场"}
                </h1>
                {activeGame ? (
                    <GameHelp
                        name={activeGame.name}
                        description={activeGame.description}
                        mission={activeGame.mission}
                        controls={activeGame.controls}
                        badgeGoal={activeGame.badgeGoal}
                        shortcuts={GAME_SHORTCUTS[activeGame.href] ?? []}
                    />
                ) : null}
                <div className="flex min-w-11 shrink-0 justify-end md:hidden [&_a]:min-h-11 [&_a]:text-[15px] [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:text-[15px]"><UserButton compact /></div>
            </nav>
        </div>
    )
}

function DesktopSidebar() {
    const pathname = usePathname()

    const renderGame = (game: PlaygroundNavItem) => {
        const active = pathname.startsWith(game.href)
        return (
            <Link
                key={game.href}
                href={game.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                    "group flex min-h-11 items-center gap-3 rounded-md px-3 transition-colors",
                    active
                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/20"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
            >
                <GameNavGlyph href={game.href} icon={game.icon} active={active} />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{game.name}</span>
                </span>
            </Link>
        )
    }

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
                        </div>
                    </div>
                </div>

                <nav className="flex h-[calc(100%-4rem)] flex-col gap-1 overflow-y-auto pr-1 no-scrollbar" aria-label="游乐场游戏导航">
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
                    <Link href="/playground/physics-lab" className="group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground">
                        <TestTubes className="h-5 w-5" aria-hidden />
                        物理实验室
                    </Link>
                    <Link href="/textbook" className="group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground">
                        <BookOpen className="h-5 w-5" aria-hidden />
                        3D 物理课本
                    </Link>
                    {PLAYGROUND_GROUPS.map((group) => {
                        const entries = publicGames.filter((game) => PLAYGROUND_DISCOVERY_BY_HREF.get(game.href)?.group === group.id)
                        return group.id === "more" ? (
                            <details key={group.id} open={entries.some((game) => pathname.startsWith(game.href)) || undefined}>
                                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-foreground/70">{group.title}</summary>
                                {entries.map(renderGame)}
                            </details>
                        ) : (
                            <div key={group.id}>
                                <p className="px-3 pb-1 pt-4 text-sm font-semibold text-foreground/70">{group.title}</p>
                                {entries.map(renderGame)}
                            </div>
                        )
                    })}
                </nav>
            </div>
        </aside>
    )
}

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    usePlaygroundSync()
    const pathname = usePathname()
    const activeGame = games.find((game) => pathname.startsWith(game.href))

    if (pathname.startsWith("/playground/physics-lab")) {
        return (
            <main className="app-canvas app-shell-wide min-w-0">
                {children}
            </main>
        )
    }

    return (
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] md:min-h-[calc(100vh-4rem)]">
            <MobilePlaygroundHeader />
            <div className="relative app-shell-wide flex w-full max-md:px-0">
                <DesktopSidebar />
                <main data-playground-main className="relative min-w-0 flex-1 overflow-x-hidden pb-28 lg:pb-0">
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--brand-blue)/0.12),transparent_34%),radial-gradient(circle_at_88%_8%,hsl(var(--brand-green)/0.12),transparent_30%),linear-gradient(180deg,hsl(var(--app-canvas)),hsl(var(--background))_78%)]" />
                    {children}
                </main>
            </div>
        </div>
    )
}
