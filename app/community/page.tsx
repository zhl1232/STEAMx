"use client";

import Head from "next/head";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCommunity } from "@/context/community-context";
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCard } from "@/components/features/community/challenge-card";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { MobileCommunityPage } from "@/components/community/mobile-community-page";

import { MessageSquare, Trophy, Award } from "lucide-react";
import { cn } from "@/lib/utils";

function CommunityPageContent() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useCommunity();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") === "challenges" ? "challenges" : "discussions";
    const [activeTab, setActiveTab] = useState<"discussions" | "challenges">(initialTab);
    const featuredBirdChallenge = challenges.activeTimed.find((challenge) => challenge.tags.includes("鸟类"))
        || challenges.evergreen.find((challenge) => challenge.tags.includes("鸟类"));

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
                        <Link
                            href="/leaderboard"
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-8 py-2 text-sm font-medium ring-offset-background transition-all hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <Award className="mr-2 h-4 w-4" />
                            排行榜
                        </Link>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    {activeTab === "discussions" ? (
                        <DiscussionList />
                    ) : (
                        <div className="space-y-10">
                            {featuredBirdChallenge && (
                                <section className="rounded-3xl border bg-gradient-to-r from-emerald-50 to-sky-50 px-6 py-8 shadow-sm dark:from-emerald-950/20 dark:to-sky-950/20">
                                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                                        <div className="max-w-3xl">
                                            <div className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-background/60 dark:text-emerald-300">
                                                自然观察专题
                                            </div>
                                            <h2 className="text-2xl font-bold">{featuredBirdChallenge.title}</h2>
                                            <p className="mt-3 text-sm leading-7 text-muted-foreground md:text-base">
                                                从校园、公园和社区绿地开始，学习基础观察方法，提交你的第一条鸟类观察成果。现在可以直接进入挑战，也可以先去自然观察频道查看完整路径。
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            <Link
                                                href={`/community/challenge/${featuredBirdChallenge.id}`}
                                                className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                            >
                                                进入挑战
                                            </Link>
                                            <Link
                                                href="/bird-observation"
                                                className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                                            >
                                                查看频道首页
                                            </Link>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {challengesError && !isLoading && (
                                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
                                    <p className="text-lg font-semibold">挑战赛加载失败</p>
                                    <p className="mt-2 text-sm text-muted-foreground">{challengesError}</p>
                                    <Button className="mt-4" onClick={() => void reloadChallenges()}>
                                        重试
                                    </Button>
                                </div>
                            )}

                            {/* Active timed challenges */}
                            {!challengesError && challenges.activeTimed && challenges.activeTimed.length > 0 && (
                                <section>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-2xl font-bold">进行中的限时挑战</h2>
                                        <p className="text-muted-foreground">参与竞赛，赢取排名奖励！</p>
                                    </div>
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {challenges.activeTimed.map((challenge) => (
                                            <ChallengeCard key={challenge.id} challenge={challenge} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Evergreen challenges */}
                            {!challengesError && challenges.evergreen && challenges.evergreen.length > 0 && (
                                <section>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-2xl font-bold">常驻学习挑战</h2>
                                        <p className="text-muted-foreground">自主学习，随时完成</p>
                                    </div>
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {challenges.evergreen.map((challenge) => (
                                            <ChallengeCard key={challenge.id} challenge={challenge} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Ended challenges */}
                            {!challengesError && challenges.ended && challenges.ended.length > 0 && (
                                <section>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-bold text-muted-foreground">已结束的挑战</h2>
                                    </div>
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {challenges.ended.map((challenge) => (
                                            <ChallengeCard key={challenge.id} challenge={challenge} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {isLoading && (
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {[1, 2, 3].map((i) => (
                                        <ChallengeCardSkeleton key={i} />
                                    ))}
                                </div>
                            )}

                            {!challengesError && !isLoading && !challenges.activeTimed?.length && !challenges.evergreen?.length && !challenges.ended?.length && (
                                <div className="text-center py-12 text-muted-foreground">
                                    <p className="text-lg">暂无挑战赛</p>
                                    <p className="text-sm mt-1">敬请期待新的挑战！</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default function CommunityPage() {
    return (
        <Suspense
            fallback={
                <div className="container mx-auto min-h-[400px] max-w-5xl py-12">
                    <div className="animate-pulse space-y-4">
                        <div className="mx-auto h-10 w-64 rounded-md bg-muted" />
                        <div className="mx-auto h-6 w-96 max-w-full rounded-md bg-muted" />
                    </div>
                </div>
            }
        >
            <CommunityPageContent />
        </Suspense>
    );
}
