"use client";

import { useState } from "react";
import { useCommunity } from "@/context/community-context";
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCard } from "@/components/features/community/challenge-card";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { cn } from "@/lib/utils";

export function MobileCommunityPage() {
    const { challenges } = useCommunity();
    const [activeTab, setActiveTab] = useState<"discussions" | "challenges" | "leaderboard">("discussions");
    const [isLoading] = useState(false);

    return (
        <div className="flex flex-col min-h-screen bg-background pb-20">
            {/* Sticky Header with Title and Tabs */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">

                
                <div className="flex px-4 gap-6 pt-3">
                    <button 
                        onClick={() => setActiveTab("discussions")}
                        className={cn(
                            "pb-3 text-sm font-medium transition-colors relative",
                            activeTab === "discussions" ? "text-primary text-base font-bold" : "text-muted-foreground"
                        )}
                    >
                        讨论区
                        {activeTab === "discussions" && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />}
                    </button>
                    <button 
                         onClick={() => setActiveTab("challenges")}
                        className={cn(
                            "pb-3 text-sm font-medium transition-colors relative",
                            activeTab === "challenges" ? "text-primary text-base font-bold" : "text-muted-foreground"
                        )}
                    >
                        挑战赛
                        {activeTab === "challenges" && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("leaderboard")}
                        className={cn(
                            "pb-3 text-sm font-medium transition-colors relative",
                            activeTab === "leaderboard" ? "text-primary text-base font-bold" : "text-muted-foreground"
                        )}
                    >
                        排行榜
                        {activeTab === "leaderboard" && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full" />}
                    </button>
                </div>
            </div>

            <div className="flex-1 px-4 py-4 min-h-0">
                {activeTab === "discussions" ? (
                    <DiscussionList />
                ) : activeTab === "leaderboard" ? (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <LeaderboardContent compact listMaxHeight={420} className="w-full" />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold mb-1">本月挑战</h2>
                            <p className="text-xs text-muted-foreground">参与挑战，赢取限定徽章！</p>
                        </div>
                        {isLoading ? (
                            <div className="grid gap-4 grid-cols-1">
                                {[1, 2].map((i) => (
                                    <ChallengeCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid gap-4 grid-cols-1">
                                {challenges.map((challenge) => (
                                    <ChallengeCard key={challenge.id} challenge={challenge} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
