import { Sparkles, Bomb, Dna, Bot } from "lucide-react"
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
        <div className="flex flex-col md:flex-row min-h-[calc(100vh-4rem)] bg-zinc-950/50">
            {/* 侧边导航栏 */}
            <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-black/20 backdrop-blur-md p-4 flex flex-col gap-2 md:gap-4 shrink-0 z-10">
                <div className="flex items-center gap-2 px-2 pb-2 md:pb-4 border-b border-white/10">
                    <div className="p-2 bg-indigo-500/20 rounded-lg">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="text-base md:text-lg font-bold text-white tracking-wider">数智游乐场</h2>
                        <p className="hidden md:block text-xs text-zinc-400">STEAM Playground</p>
                    </div>
                </div>

                <nav className="flex-1 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none md:space-y-1 md:mt-2">
                    {games.map((game) => (
                        <Link
                            key={game.href}
                            href={game.href}
                            className={`flex flex-col md:flex-row items-center md:items-start gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all duration-300 border border-transparent min-w-[72px] md:min-w-0 ${game.status === "active"
                                ? "hover:bg-white/5 hover:border-white/10 text-zinc-200"
                                : "opacity-50 cursor-not-allowed text-zinc-500"
                                }`}
                        >
                            <div className="md:mt-0.5">
                                <game.icon className="w-5 h-5 md:w-5 md:h-5" />
                            </div>
                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-1">
                                    <span className="font-medium text-[10px] md:text-sm whitespace-nowrap">{
                                        game.name.split(" ")[0] // Mobile only show first word
                                    } <span className="hidden md:inline">{game.name.split(" ")[1]}</span></span>
                                    {game.status === "coming_soon" && (
                                        <span className="hidden md:inline text-[10px] uppercase tracking-wider bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded-full">
                                            敬请期待
                                        </span>
                                    )}
                                </div>
                                <p className="hidden md:block text-xs mt-1 text-zinc-500">{game.description}</p>
                            </div>
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:block text-center p-4 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-white/5">
                    <p className="text-xs text-zinc-400">
                        用代码支配游戏
                        <br />
                        在实战中解构原理
                    </p>
                </div>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 overflow-x-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-black -z-10 pointer-events-none" />
                {children}
            </main>
        </div>
    )
}
