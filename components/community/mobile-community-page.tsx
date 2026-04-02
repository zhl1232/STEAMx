"use client";

import { useState } from "react";
import Link from "next/link";
import { useCommunity } from "@/context/community-context";
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCard } from "@/components/features/community/challenge-card";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { LeaderboardContent } from "@/components/features/gamification/leaderboard-content";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";

export function MobileCommunityPage() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useCommunity();
    const [activeTab, setActiveTab] = useState<"discussions" | "challenges" | "leaderboard">("discussions");
    const featuredBirdChallenge = challenges.activeTimed.find((challenge) => challenge.tags.includes("鸟类"))
        || challenges.evergreen.find((challenge) => challenge.tags.includes("鸟类"));

    return (
        <div className="flex min-h-screen flex-col bg-background pb-24">
            <div className="mobile-subnav top-0 z-30">
                <MobilePageHeader
                    title="社区"
                    fallbackHref="/"
                    sticky={false}
                    className="border-none bg-transparent shadow-none"
                />
                <div className="px-4 pb-3 pt-1">
                    <div className="segmented-control flex w-full justify-between gap-1">
                        <button 
                            onClick={() => setActiveTab("discussions")}
                            className={cn(
                                "segmented-option min-w-0 flex-1 px-0",
                                activeTab === "discussions" && "segmented-option-active"
                            )}
                        >
                            讨论区
                        </button>
                        <button 
                            onClick={() => setActiveTab("challenges")}
                            className={cn(
                                "segmented-option min-w-0 flex-1 px-0",
                                activeTab === "challenges" && "segmented-option-active"
                            )}
                        >
                            挑战赛
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("leaderboard")}
                            className={cn(
                                "segmented-option min-w-0 flex-1 px-0",
                                activeTab === "leaderboard" && "segmented-option-active"
                            )}
                        >
                            排行榜
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 px-4 py-4">
                {activeTab === "discussions" ? (
                    <DiscussionList />
                ) : activeTab === "leaderboard" ? (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <LeaderboardContent compact listMaxHeight={420} className="w-full" />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        {featuredBirdChallenge && (
                            <div className="surface-panel rounded-[24px] bg-gradient-to-r from-emerald-50/85 to-sky-50/88 p-4 dark:from-emerald-950/24 dark:to-sky-950/22">
                                <div className="mb-2 inline-flex rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:bg-background/60 dark:text-emerald-300">
                                    自然观察专题
                                </div>
                                <h2 className="text-lg font-bold leading-tight">{featuredBirdChallenge.title}</h2>
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                    先进入自然观察频道，再去学习观察方法并提交你的第一条记录。
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <Link
                                        href={`/community/challenge/${featuredBirdChallenge.id}`}
                                        className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
                                    >
                                        进入挑战
                                    </Link>
                                    <Link
                                        href="/bird-observation"
                                        className="inline-flex items-center rounded-full border px-4 py-2 text-xs font-medium"
                                    >
                                        频道首页
                                    </Link>
                                </div>
                            </div>
                        )}

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
