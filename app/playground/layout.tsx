"use client"

import {
    Beaker,
    Bomb,
    Bot,
    Brain,
    Calculator,
    ChevronRight,
    Compass,
    Cpu,
    Crown,
    Dna,
    FlipHorizontal,
    Grid3X3,
    Hash,
    Home,
    Layers,
    Medal,
    Palette,
    Scale,
    Table,
    Touchpad,
    type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { GameHelp, type GameHelpShortcut } from "@/components/features/playground/game-help"
import { categoryToneClasses, type CategoryTone } from "@/components/ui/tone-badge"
import { usePlaygroundSync } from "@/hooks/playground/use-playground-sync"
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
        description: "五档迷雾地图与算法复盘",
        mission: "辨认墙与道路，避开误导岔路，找到藏在迷雾里的出口。",
        controls: "方向键或 WASD 对应地图上下左右；手机端箭头紧贴地图显示。",
        badgeGoal: "挑战 9×9 至 25×25 五档迷宫的最佳步数。",
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
    {
        name: "数织",
        nameEn: "Nonogram",
        href: "/playground/nonogram",
        icon: Table,
        description: "线索推理与像素填图，28 关至 15×15",
        mission: "按顺序解锁，根据行列线索填出隐藏图案。",
        controls: "填色/叉号切换并可滑动连填；须按顺序通关解锁；错填扣试错（3 次）。",
        badgeGoal: "按顺序通关全部数织关卡。",
        color: "text-slate-500 dark:text-slate-300",
        steamTags: ["Math", "Arts"],
    },
    {
        name: "球排序",
        nameEn: "Ball Sort",
        href: "/playground/ballsort",
        icon: Beaker,
        description: "状态空间与中转规划",
        mission: "把同色球倒进同一试管并填满。",
        controls: "先点源管再点目标管倾倒，空管可作中转。",
        badgeGoal: "刷新各关最少步数。",
        color: "text-cyan-500 dark:text-cyan-300",
        steamTags: ["Engineering", "Math"],
    },
    {
        name: "天平称重",
        nameEn: "Balance",
        href: "/playground/balance",
        icon: Scale,
        description: "三分法与科学推理",
        mission: "用有限次称量找出假币。",
        controls: "把硬币放入左右盘称量，再指认假币。",
        badgeGoal: "用更少称量通关。",
        color: "text-teal-500 dark:text-teal-300",
        steamTags: ["Science", "Math"],
    },
    {
        name: "像素对称",
        nameEn: "Symmetry",
        href: "/playground/symmetry",
        icon: FlipHorizontal,
        description: "轴对称与构图",
        mission: "按镜像规则画出目标剪影。",
        controls: "点击像素，镜像侧会同步填色。",
        badgeGoal: "完成全部对称画关卡。",
        color: "text-pink-500 dark:text-pink-300",
        steamTags: ["Arts", "Math"],
    },
    {
        name: "逻辑电路",
        nameEn: "Logic Circuit",
        href: "/playground/circuit",
        icon: Cpu,
        description: "布尔逻辑与门电路",
        mission: "选择与/或/非等门，让输出灯达到目标。",
        controls: "为每个门选类型，必要时拨动输入开关。",
        badgeGoal: "通关全部电路关卡。",
        color: "text-indigo-500 dark:text-indigo-300",
        steamTags: ["Technology", "Science"],
    },
]

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
    "/playground/2048": [
        { key: "← → ↑ ↓", label: "移动全部方块" },
        { key: "W / A / S / D", label: "移动全部方块" },
        { key: "滑动", label: "手机移动方块" },
        { key: "Ctrl / Cmd + Z", label: "撤销一步" },
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
    "/playground/fifteen": [
        { key: "点击数字", label: "把相邻数字移入空格" },
        { key: "滑动", label: "手机滑动移动数字" },
    ],
    "/playground/memory": [
        { key: "点击卡牌", label: "翻开一张卡牌" },
        { key: "再次点击", label: "寻找相同图案" },
    ],
    "/playground/quickmath": [
        { key: "0–9", label: "输入答案" },
        { key: "Backspace", label: "删除一位" },
        { key: "Enter", label: "提交答案" },
    ],
    "/playground/maze": [
        { key: "↑ / W", label: "向地图上方移动" },
        { key: "→ / D", label: "向地图右方移动" },
        { key: "↓ / S", label: "向地图下方移动" },
        { key: "← / A", label: "向地图左方移动" },
        { key: "手机箭头", label: "直接控制地图上的移动方向" },
    ],
    "/playground/tangram": [
        { key: "拖拽", label: "移动拼图片" },
        { key: "单击", label: "旋转 45°" },
        { key: "双击", label: "翻转平行四边形" },
    ],
    "/playground/nonogram": [
        { key: "点击 / 滑动", label: "连续填色或标叉" },
        { key: "模式按钮", label: "切换填色与叉号" },
    ],
    "/playground/ballsort": [
        { key: "点击源管", label: "拿起顶部同色球" },
        { key: "点击目标管", label: "倒入可用试管" },
    ],
    "/playground/balance": [
        { key: "点击硬币", label: "选中或取消硬币" },
        { key: "左右盘", label: "把硬币放入对应托盘" },
        { key: "称量", label: "比较两侧重量" },
    ],
    "/playground/symmetry": [
        { key: "点击像素", label: "填色或清除" },
        { key: "镜像侧", label: "自动同步对称图案" },
    ],
    "/playground/circuit": [
        { key: "点击门", label: "切换逻辑门类型" },
        { key: "输入开关", label: "改变输入信号" },
    ],
}

function MobilePlaygroundHeader() {
    const pathname = usePathname()
    const isHome = pathname === "/playground"
    const navItems = [{ name: "首页", href: "/playground", icon: Home }, ...games]
    const activeGame = games.find((game) => pathname.startsWith(game.href))

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
                {activeGame ? (
                    <GameHelp
                        name={activeGame.name}
                        description={activeGame.description}
                        mission={activeGame.mission}
                        controls={activeGame.controls}
                        badgeGoal={activeGame.badgeGoal}
                        shortcuts={GAME_SHORTCUTS[activeGame.href] ?? []}
                    />
                ) : (
                    <div className="w-11 shrink-0" aria-hidden />
                )}
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

function DesktopSidebar() {
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

                <nav className="flex h-[calc(100%-7.5rem)] flex-col gap-1.5 overflow-y-auto pr-1 no-scrollbar" aria-label="游乐场游戏导航">
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

                <div className="mt-4">
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
        <section className="hidden pt-3 lg:block lg:px-8 lg:pt-5">
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
    usePlaygroundSync()
    const pathname = usePathname()
    const activeGame = games.find((game) => pathname.startsWith(game.href))

    return (
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] md:min-h-[calc(100vh-4rem)]">
            <MobilePlaygroundHeader />
            <div className="relative app-shell-wide flex w-full max-md:px-0">
                <DesktopSidebar />
                <main className="relative min-w-0 flex-1 overflow-x-hidden pb-28 lg:pb-0">
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,hsl(var(--brand-blue)/0.12),transparent_34%),radial-gradient(circle_at_88%_8%,hsl(var(--brand-green)/0.12),transparent_30%),linear-gradient(180deg,hsl(var(--app-canvas)),hsl(var(--background))_78%)]" />
                    {activeGame ? <GameMissionBar game={activeGame} /> : null}
                    {children}
                </main>
            </div>
        </div>
    )
}
