import type { Metadata } from "next";
import { Trophy } from "lucide-react";

import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { BRAND_FULL_NAME } from "@/lib/brand";

export const metadata: Metadata = buildPageMetadata({
    title: "社区排行榜",
    description: `查看${BRAND_FULL_NAME}社区中的等级、经验、徽章和项目活跃度排行榜，了解谁在持续创作、分享与完成项目。`,
    path: "/leaderboard",
    keywords: ["社区排行榜", "STEAM经验榜", "创作排行"],
});

export default function LeaderboardPage() {
    return (
        <div className="app-canvas min-h-[calc(100dvh-var(--mobile-global-header-height,3rem))] pb-24 md:min-h-[calc(100vh-4rem)] md:pb-10">
            <div className="md:hidden">
                <MobilePageHeader
                    title="社区排行榜"
                    fallbackHref="/create"
                    className="border-border/40 bg-background/80"
                    titleClassName="text-center text-lg"
                />
            </div>

            <main className="app-shell-wide pt-4 md:px-8 md:pt-8">
                <section className="relative overflow-hidden rounded-(--radius-lg) border border-[hsl(var(--surface-border)/0.9)] bg-[hsl(var(--surface-raised)/0.9)] px-4 py-5 shadow-[0_28px_78px_-50px_hsl(var(--surface-shadow)/0.58)] backdrop-blur-sm sm:rounded-xl sm:px-7 sm:py-8 md:px-9 lg:px-10 xl:px-12">
                    <div
                        className="absolute inset-0 bg-cover bg-position-[58%_center] bg-no-repeat opacity-95 dark:opacity-35 md:bg-center"
                        style={{ backgroundImage: "url('/assets/leaderboard-community-honor-bg.webp')" }}
                    />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_6%,hsl(var(--brand-blue)/0.12),transparent_36%),linear-gradient(90deg,hsl(var(--surface-raised)/0.98)_0%,hsl(var(--surface-raised)/0.9)_34%,hsl(var(--surface-raised)/0.52)_62%,hsl(var(--surface-raised)/0.18)_100%)] dark:bg-[radial-gradient(circle_at_78%_6%,hsl(var(--brand-blue)/0.2),transparent_36%),linear-gradient(90deg,hsl(var(--background)/0.96)_0%,hsl(var(--background)/0.82)_42%,hsl(var(--background)/0.42)_100%)]" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white/35 to-transparent dark:from-white/4" />

                    <div className="relative flex md:min-h-[250px] md:items-center xl:min-h-[274px]">
                        <div className="max-w-3xl self-center">
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-xs dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
                                <Trophy className="h-3.5 w-3.5" />
                                社区荣誉榜
                            </div>
                            <h1 className="mt-4 text-[2rem] font-black leading-tight tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl lg:text-6xl">
                                社区排行榜
                            </h1>
                            <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:line-clamp-none sm:text-lg sm:leading-8">
                                看见持续探索、认真创作和互相帮助的伙伴，用清晰的成长记录赢得荣誉。
                            </p>
                        </div>
                    </div>
                </section>

                <LeaderboardContent className="mt-5 md:mt-7" />
            </main>
        </div>
    );
}
