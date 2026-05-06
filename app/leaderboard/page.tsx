import { Medal, Sparkles, Trophy } from "lucide-react";

import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function LeaderboardPage() {
    return (
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,4rem))] pb-24 md:min-h-[calc(100vh-4rem)] md:pb-10">
            <div className="md:hidden">
                <MobilePageHeader
                    title="社区排行榜"
                    fallbackHref="/community"
                    className="border-border/40 bg-background/80"
                    titleClassName="text-center text-lg"
                />
            </div>

            <main className="page-shell pt-5 md:pt-8">
                <section className="relative overflow-hidden rounded-[28px] border border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.86)] px-5 py-8 shadow-[0_26px_70px_-48px_hsl(var(--surface-shadow)/0.55)] backdrop-blur sm:px-7 md:px-8 lg:px-10">
                    <div
                        className="absolute inset-0 bg-[length:780px_auto] bg-[right_-120px_top_-80px] bg-no-repeat opacity-90 dark:opacity-35 md:bg-[length:880px_auto] md:bg-[right_top_-160px]"
                        style={{ backgroundImage: "url('/assets/leaderboard-blue-honor-bg.png')" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--surface-raised))] via-[hsl(var(--surface-raised)/0.88)] to-[hsl(var(--surface-raised)/0.18)] dark:from-[hsl(var(--background)/0.92)] dark:via-[hsl(var(--background)/0.72)] dark:to-[hsl(var(--background)/0.2)]" />

                    <div className="relative flex min-h-[220px] flex-col justify-between gap-8 md:min-h-[250px] lg:flex-row lg:items-end">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                                <Trophy className="h-3.5 w-3.5" />
                                社区荣誉榜
                            </div>
                            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
                                社区排行榜
                            </h1>
                            <p className="mt-4 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">
                                看见持续探索、认真创作和互相帮助的伙伴，用清晰的成长记录赢得荣誉。
                            </p>
                        </div>

                        <div className="grid max-w-md grid-cols-3 gap-3 text-center lg:w-[390px]">
                            {[
                                { icon: Trophy, label: "积分榜", value: "XP" },
                                { icon: Medal, label: "徽章榜", value: "成就" },
                                { icon: Sparkles, label: "实干榜", value: "项目" },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    className="rounded-2xl border border-white/70 bg-white/75 px-3 py-4 shadow-[0_16px_36px_-28px_rgba(37,99,235,0.65)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06]"
                                >
                                    <item.icon className="mx-auto h-5 w-5 text-blue-600 dark:text-blue-300" />
                                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</div>
                                    <div className="mt-1 text-xs text-muted-foreground">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <LeaderboardContent className="mt-5 md:mt-7" />
            </main>
        </div>
    );
}
