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

import { MessageSquare, Trophy } from "lucide-react";
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
            <div className="hidden md:block">
                <div className="page-shell py-10">
                    <section className="surface-panel mb-8 overflow-hidden px-8 py-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <p className="section-kicker">交流与挑战</p>
                                <h1 className="mt-3 text-4xl font-semibold tracking-tight">STEAM 创客社区</h1>
                                <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">
                                    在这里发起讨论、加入挑战、沉淀做中学的经验。页面风格和内容入口现在会和探索页、项目页保持同一套节奏。
                                </p>
                            </div>
                            <Link
                                href="/leaderboard"
                                className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                            >
                                查看排行榜
                            </Link>
                        </div>
                    </section>

                    <div className="mb-8 flex items-center justify-center">
                        <div className="segmented-control">
                            <button
                                onClick={() => setActiveTab("discussions")}
                                className={cn(
                                    "segmented-option px-6",
                                    activeTab === "discussions" && "segmented-option-active"
                                )}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                讨论区
                            </button>
                            <button
                                onClick={() => setActiveTab("challenges")}
                                className={cn(
                                    "segmented-option px-6",
                                    activeTab === "challenges" && "segmented-option-active"
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
                            <div className="space-y-10">
                                {featuredBirdChallenge && (
                                    <section className="surface-panel rounded-[28px] bg-gradient-to-r from-emerald-50/92 to-sky-50/95 px-6 py-8 dark:from-emerald-950/22 dark:to-sky-950/20">
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

                                {!challengesError && challenges.activeTimed && challenges.activeTimed.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="mb-4 flex items-center justify-between">
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

                                {!challengesError && challenges.evergreen && challenges.evergreen.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="mb-4 flex items-center justify-between">
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

                                {!challengesError && challenges.ended && challenges.ended.length > 0 && (
                                    <section className="space-y-4">
                                        <div className="mb-4 flex items-center justify-between">
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
                                    <div className="py-12 text-center text-muted-foreground">
                                        <p className="text-lg">暂无挑战赛</p>
                                        <p className="mt-1 text-sm">敬请期待新的挑战！</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function CommunityPage() {
    return (
        <Suspense
            fallback={
                <div className="page-shell py-10">
                    <section className="surface-panel min-h-[320px] px-6 py-12">
                        <div className="animate-pulse space-y-4 text-center">
                            <div className="mx-auto h-10 w-64 rounded-md bg-muted" />
                            <div className="mx-auto h-6 w-96 max-w-full rounded-md bg-muted" />
                        </div>
                    </section>
                </div>
            }
        >
            <CommunityPageContent />
        </Suspense>
    );
}
