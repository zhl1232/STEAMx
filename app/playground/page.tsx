import { ArrowRight, Terminal } from "lucide-react"
import Link from "next/link"

export default function PlaygroundPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 lg:p-16">
            <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-medium">
                    <Terminal className="w-4 h-4" />
                    <span>Hello, World! 欢迎进入数智空间</span>
                </div>

                <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-indigo-400">
                    STEAM <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">Playground</span>
                </h1>

                <p className="text-lg lg:text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                    在这里，游戏不只是消遣。我们从实战中解构知识，用代码支配世界。
                    在这里探索矩阵运算、博弈论算法、元胞自动机背后的奇妙原理。
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
                    <Link
                        href="/playground/minesweeper"
                        className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-black font-semibold hover:scale-105 active:scale-95 transition-all w-full sm:w-auto overflow-hidden relative"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            开始排雷对局
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-200 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 border-t border-white/5 mt-16 text-left">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <h3 className="text-xl font-semibold mb-2 text-zinc-200">Play & Learn</h3>
                        <p className="text-zinc-500 text-sm">挑战高难度经典游戏，右侧互动知识书手把手解析背后用到的 STEAM 原理。</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <h3 className="text-xl font-semibold mb-2 text-zinc-200">Code Arena</h3>
                        <p className="text-zinc-500 text-sm">即将开启：编写你的自定义 AI 脚本，上传至云平台与其他玩家的算法一决高下。</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                        <h3 className="text-xl font-semibold mb-2 text-zinc-200">Earn Badges</h3>
                        <p className="text-zinc-500 text-sm">解开定式、完成无伤通关或破解算法瓶颈，斩获全站限定徽章与高额 XP。</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
