"use client";

import { Trophy } from "lucide-react";
import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";

export default function LeaderboardPage() {
    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600">
                    <Trophy className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">社区排行榜</h1>
                    <p className="text-muted-foreground">
                        看看谁是 STEAM 社区最活跃的探索者！
                    </p>
                </div>
            </div>

            <LeaderboardContent listMaxHeight={480} />
        </div>
    );
}
