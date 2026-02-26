import { Bomb, Dna, Bot } from "lucide-react"
import Link from "next/link"

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
    const games = [
        {
            name: "扫雷 (Minesweeper)",
            href: "/playground/minesweeper",
            icon: Bomb,
            description: "概率推演与矩阵计算",
            status: "active",
        },
        {
            name: "五子棋 (Gomoku)",
            href: "/playground/gomoku",
            icon: Bot,
            description: "博弈论与极小极大算",
            status: "coming_soon",
        },
        {
            name: "生命游戏 (Game of Life)",
            href: "/playground/life",
            icon: Dna,
            description: "元胞自动机与涌现",
            status: "coming_soon",
        },
    ]

    return (
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)]">
            {/* 侧边导航栏 */}
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card/30 backdrop-blur-xl p-4 flex flex-col gap-2 md:gap-4 shrink-0 z-10">
                <nav className="flex-1 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none md:space-y-1">
                    {games.map((game) => (
                        <Link
                            key={game.href}
                            href={game.href}
                            className={`flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all duration-300 border border-transparent min-w-[72px] md:min-w-0 ${game.status === "active"
                                ? "hover:bg-primary/10 hover:border-primary/20 text-foreground bg-primary/5"
                                : "opacity-40 cursor-not-allowed text-muted-foreground"
                                }`}
                        >
                            <div className="md:mt-0.5">
                                <game.icon className={`w-5 h-5 md:w-5 md:h-5 ${game.status === 'active' ? 'text-primary' : ''}`} />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-1">
                                    <span className="font-semibold text-[10px] md:text-sm whitespace-nowrap">{
                                        game.name.split(" ")[0] // Mobile only show first word
                                    } <span className="hidden md:inline">{game.name.split(" ")[1]}</span></span>
                                    {game.status === "coming_soon" && (
                                        <span className="hidden md:inline text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                                            敬请期待
                                        </span>
                                    )}
                                </div>
                                <p className={`hidden md:block text-xs mt-1 ${game.status === 'active' ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>{game.description}</p>
                            </div>
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:block text-center p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl border border-border shadow-inner">
                    <p className="text-xs text-primary font-medium">
                        用代码支配游戏
                        <br />
                        在实战中解构原理
                    </p>
                </div>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 overflow-x-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10 pointer-events-none" />
                <div className="absolute inset-0 bg-[grid-black/[0.02] dark:bg-grid-white/[0.02]] bg-[size:40px_40px] -z-10" />
                {children}
            </main>
        </div>
    )
}
