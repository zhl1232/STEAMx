"use client";

import { useState } from "react";
import { useCommunity } from "@/context/community-context";
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCard } from "@/components/features/community/challenge-card";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileCommunityPage() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useCommunity();
    const [activeTab, setActiveTab] = useState<"discussions" | "challenges" | "leaderboard">("discussions");

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
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        {challengesError && !isLoading ? (
                            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
                                <p className="font-semibold">挑战赛加载失败</p>
                                <p className="mt-2 text-sm text-muted-foreground">{challengesError}</p>
                                <Button className="mt-4" onClick={() => void reloadChallenges()}>
                                    重试
                                </Button>
                            </div>
                        ) : isLoading ? (
                            <div className="grid gap-4 grid-cols-1">
                                {[1, 2].map((i) => (
                                    <ChallengeCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : (
                            <>
                                {challenges.activeTimed.length > 0 && (
                                    <div>
                                        <h2 className="text-lg font-bold mb-2">限时挑战</h2>
                                        <div className="grid gap-4 grid-cols-1">
                                            {challenges.activeTimed.map((challenge) => (
                                                <ChallengeCard key={challenge.id} challenge={challenge} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {challenges.evergreen.length > 0 && (
                                    <div>
                                        <h2 className="text-lg font-bold mb-2">学习挑战</h2>
                                        <div className="grid gap-4 grid-cols-1">
                                            {challenges.evergreen.map((challenge) => (
                                                <ChallengeCard key={challenge.id} challenge={challenge} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {challenges.ended.length > 0 && (
                                    <div>
                                        <h2 className="text-base font-bold text-muted-foreground mb-2">已结束</h2>
                                        <div className="grid gap-4 grid-cols-1">
                                            {challenges.ended.map((challenge) => (
                                                <ChallengeCard key={challenge.id} challenge={challenge} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {!challenges.activeTimed.length && !challenges.evergreen.length && !challenges.ended.length && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <p>暂无挑战赛</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
