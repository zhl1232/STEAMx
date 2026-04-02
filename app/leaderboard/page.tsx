import { Trophy } from "lucide-react";
import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

export default function LeaderboardPage() {
    return (
        <div className="page-shell pt-6 pb-24 md:py-8">
            <div className="md:hidden">
                <MobilePageHeader title="社区排行榜" fallbackHref="/community" />
            </div>

            <section className="surface-panel overflow-hidden px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
                <div className="mb-8 flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20">
                        <Trophy className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="section-kicker">社区活跃度</p>
                        <h1 className="mt-3 text-3xl font-semibold tracking-tight">社区排行榜</h1>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
                            看看谁是 STEAM 探索社区最近最活跃的探索者、创作者和实践者。
                        </p>
                    </div>
                </div>

                <LeaderboardContent listMaxHeight={480} />
            </section>
        </div>
    );
}
