"use client";

import Head from "next/head";
import { useState } from "react";
import { useCommunity } from "@/context/community-context";
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCard } from "@/components/features/community/challenge-card";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { MobileCommunityPage } from "@/components/community/mobile-community-page";

import { MessageSquare, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CommunityPage() {
    const { challenges } = useCommunity();
    const [activeTab, setActiveTab] = useState<"discussions" | "challenges">("discussions");
    const [isLoading, _setIsLoading] = useState(false);

    return (
        <>
            <Head>
                <title>STEAM 创客社区 - 讨论与挑战</title>
                <meta name="description" content="加入 STEAM 创客社区，参与讨论和挑战，分享创意，赢取徽章。" />
            </Head>

            {/* Mobile View */}
            <div className="block md:hidden">
                <MobileCommunityPage />
            </div>

            {/* Desktop View */}
            <div className="hidden md:block container mx-auto py-12 max-w-5xl bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-black">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold mb-4">STEAM 创客社区</h1>
                    <p className="text-xl text-muted-foreground">
                        连接全球的小小科学家和工程师，分享你的创意，解决难题。
                    </p>
                </div>

                <div className="flex justify-center mb-12">
                    <div className="inline-flex h-12 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                        <button
                            onClick={() => setActiveTab("discussions")}
                            className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-8 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                activeTab === "discussions"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "hover:bg-background/50"
                            )}
                        >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            讨论区
                        </button>
                        <button
                            onClick={() => setActiveTab("challenges")}
                            className={cn(
                                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-8 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                                activeTab === "challenges"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "hover:bg-background/50"
                            )}
                        >
                            <Trophy className="mr-2 h-4 w-4" />
                            挑战赛
                        </button>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {activeTab === "discussions" ? (
                        <DiscussionList />
                    ) : (
                        <div className="space-y-8">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold">本月挑战</h2>
                                <p className="text-muted-foreground">参与挑战，赢取限定徽章！</p>
                            </div>
                            {isLoading ? (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {[1, 2, 3].map((i) => (
                                        <ChallengeCardSkeleton key={i} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {challenges.map((challenge) => (
                                        <ChallengeCard key={challenge.id} challenge={challenge} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

