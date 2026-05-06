"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useCommunity } from '@/lib/context/community-context';
import { DiscussionList } from "@/components/features/community/discussion-list";
import { ChallengeCardSkeleton } from "@/components/ui/loading-skeleton";
import { Button } from "@/components/ui/button";
import { getFeaturedNatureChallenges } from "@/lib/community/featured-nature-challenges";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SteamLogo } from "@/components/layout/logo";
import { UserButton } from "@/components/layout/user-button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import type { Challenge } from "@/lib/mappers/types";

import {
    ArrowRight,
    ChevronRight,
    Handshake,
    Image as ImageIcon,
    MessageCircle,
    MessageSquare,
    Search,
    Sparkles,
    Trophy,
    UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const communityHeroImage = "/assets/community-hero-kids-robot.png";
const natureFeatureImage = "/assets/home-nature-channel-bird.png";

type CommunityTab = "discussions" | "challenges";
type ChallengeGroups = {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
};

const heroMetricToneClassNames = [
    "md:text-[#2f6f9f] md:dark:text-[#9cc9ef]",
    "md:text-[#2d8464] md:dark:text-[#91dab9]",
    "md:text-[#b96b2f] md:dark:text-[#f3b37a]",
    "md:text-[#7566b4] md:dark:text-[#bfb6f4]",
] as const;

const communityValues = [
    { label: "交流想法", description: "分享你的创意和经验", icon: MessageSquare, color: "text-[#1677ff]" },
    { label: "互相帮助", description: "解答问题，互助成长", icon: Handshake, color: "text-[#16a05a]" },
    { label: "协作共创", description: "组合合作，完成项目", icon: Sparkles, color: "text-[#ff7a1a]" },
    { label: "成果展示", description: "展示成果，获得反馈", icon: ImageIcon, color: "text-[#ff8a00]" },
] as const;

function formatMetricValue(value: number) {
    if (value >= 10000) {
        const formatted = (value / 10000).toFixed(value >= 100000 ? 0 : 1).replace(/\.0$/, "");
        return `${formatted}万`;
    }

    if (value >= 1000) {
        const formatted = (value / 1000).toFixed(1).replace(/\.0$/, "");
        return `${formatted}k`;
    }

    return value.toLocaleString("zh-CN");
}

function getChallengeSubmissionCount(challenge: Challenge) {
    return challenge.submissionsCount ?? challenge.completionsCount ?? 0;
}

function buildHeroMetrics(challengeGroups: ChallengeGroups, discussionTotal: number | null) {
    const allChallenges = [
        ...challengeGroups.activeTimed,
        ...challengeGroups.evergreen,
        ...challengeGroups.ended,
    ];
    const activeChallengeCount = challengeGroups.activeTimed.length + challengeGroups.evergreen.length;
    const participantCount = allChallenges.reduce((sum, challenge) => sum + (challenge.participants || 0), 0);
    const submissionCount = allChallenges.reduce((sum, challenge) => sum + getChallengeSubmissionCount(challenge), 0);

    return [
        { value: formatMetricValue(activeChallengeCount), label: "进行挑战", icon: Trophy, color: heroMetricToneClassNames[0] },
        { value: formatMetricValue(discussionTotal ?? 0), label: "讨论主题", icon: MessageCircle, color: heroMetricToneClassNames[1] },
        { value: formatMetricValue(participantCount), label: "参与人次", icon: UsersRound, color: heroMetricToneClassNames[2] },
        { value: formatMetricValue(submissionCount), label: "挑战提交", icon: ImageIcon, color: heroMetricToneClassNames[3] },
    ] as const;
}

function MobileCommunityHeader() {
    return (
        <header className="sticky top-0 z-40 border-b border-[#dfe8f2]/80 bg-[#f7fbff]/92 px-5 pb-3 pt-[calc(0.85rem+env(safe-area-inset-top))] backdrop-blur-xl dark:border-[#243348] dark:bg-[#07101d]/92 md:hidden">
            <div className="flex h-11 items-center justify-between gap-3">
                <Link href="/" className="flex min-w-0 items-center gap-2.5">
                    <SteamLogo className="h-8 w-8 shrink-0" />
                    <span className="truncate text-[22px] font-black tracking-normal text-[#143f7d] dark:text-[#8bbdff]">
                        STEAM 探索
                    </span>
                </Link>
                <nav className="flex shrink-0 items-center gap-1.5">
                    <Link
                        href="/explore"
                        className="grid h-10 w-10 place-items-center rounded-full text-[#0d1b34] transition hover:bg-[#eaf3ff] dark:text-[#d9e4f2] dark:hover:bg-[#172234]"
                        aria-label="搜索"
                    >
                        <Search className="h-6 w-6" strokeWidth={2.05} />
                    </Link>
                    <div className="[&_button]:h-10 [&_button]:w-10 [&_svg]:h-6 [&_svg]:w-6">
                        <NotificationBell />
                    </div>
                    <div className="[&_button]:h-10 [&_button]:w-10">
                        <UserButton />
                    </div>
                </nav>
            </div>
        </header>
    );
}

function CommunityHero({ metrics }: { metrics: ReturnType<typeof buildHeroMetrics> }) {
    return (
        <section className="surface-card relative overflow-hidden rounded-[18px] md:rounded-[16px]">
            <div className="relative min-h-[300px] md:min-h-[260px] xl:min-h-[282px]">
                <Image
                    src={communityHeroImage}
                    alt="孩子们围坐在桌前调试机器人小车"
                    fill
                    priority
                    loading="eager"
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 64vw, 1180px"
                    className="object-cover object-[68%_center] dark:brightness-90 md:object-[72%_center]"
                />
                <div className="absolute inset-x-0 top-0 h-[58%] bg-[linear-gradient(180deg,rgba(247,251,255,0.86)_0%,rgba(247,251,255,0.58)_46%,rgba(247,251,255,0.08)_100%)] dark:bg-[linear-gradient(180deg,rgba(7,16,29,0.76)_0%,rgba(7,16,29,0.48)_46%,rgba(7,16,29,0.06)_100%)] md:inset-0 md:h-auto md:bg-[linear-gradient(90deg,rgba(247,251,255,0.82)_0%,rgba(247,251,255,0.6)_28%,rgba(247,251,255,0.28)_48%,rgba(247,251,255,0.06)_68%,rgba(247,251,255,0)_82%)] md:dark:bg-[linear-gradient(90deg,rgba(7,16,29,0.78)_0%,rgba(7,16,29,0.52)_28%,rgba(7,16,29,0.24)_50%,rgba(7,16,29,0.06)_72%,rgba(7,16,29,0)_84%)]" />
                <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/20 to-transparent md:hidden" />
                <div className="absolute inset-x-0 bottom-0 hidden h-[32%] bg-gradient-to-t from-black/30 via-black/10 to-transparent md:block" />

                <div className="relative z-10 flex min-h-[300px] flex-col px-5 pb-4 pt-7 min-[390px]:px-7 md:min-h-[260px] md:justify-center md:px-8 md:py-7 xl:min-h-[282px] xl:px-10">
                    <div className="max-w-[310px] md:max-w-[650px]">
                        <h1 className="whitespace-nowrap text-[32px] font-black leading-none tracking-normal text-[#0b1831] dark:text-[#edf6ff] min-[390px]:text-[36px] md:text-[44px] xl:text-[52px]">
                            STEAM 创客社区
                        </h1>
                        <p className="mt-4 max-w-[15rem] text-[17px] font-medium leading-7 text-[#27364c] dark:text-[#c7d5e7] min-[390px]:max-w-[17rem] md:max-w-[34rem] md:text-[18px]">
                            分享想法，交流经验，一起用创造改变世界
                        </p>
                    </div>

                    <div className="mt-auto grid max-w-[610px] grid-cols-4 gap-1 rounded-[14px] border border-white/15 bg-black/50 px-2 py-2 shadow-[0_16px_32px_-22px_rgba(0,0,0,0.72)] backdrop-blur-md md:mt-6 md:gap-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                        {metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="min-w-0 px-1 py-1.5 text-center md:px-2 md:py-1"
                            >
                                <metric.icon className="mx-auto mb-1 h-5 w-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.52)] md:hidden" strokeWidth={2.4} />
                                <div className={cn("text-[20px] font-black leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.58)] md:text-[28px] md:drop-shadow-[0_2px_8px_rgba(255,255,255,0.72)]", metric.color)}>
                                    {metric.value}
                                </div>
                                <div className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none text-white/90 drop-shadow-[0_2px_7px_rgba(0,0,0,0.65)] md:text-[13px] md:text-[#2d3b52] md:drop-shadow-[0_1px_6px_rgba(255,255,255,0.76)] md:dark:text-[#d4e1f1] md:dark:drop-shadow-[0_2px_7px_rgba(0,0,0,0.85)]">
                                    {metric.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 hidden max-w-[780px] grid-cols-4 gap-3 md:grid">
                        {communityValues.map((item) => (
                            <div
                                key={item.label}
                                className="flex min-w-0 items-center gap-3 rounded-[10px] border border-white/60 bg-white/40 px-4 py-3 text-left shadow-sm backdrop-blur-md transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9)] dark:hover:bg-white/[0.13]"
                            >
                                <item.icon className="h-6 w-6 shrink-0 text-[#1f2937] dark:text-white/90" strokeWidth={2.2} />
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-bold text-[#1f2937] dark:text-white">
                                        {item.label}
                                    </div>
                                    <div className="mt-1 truncate text-[11px] text-[#4b5563] dark:text-white/70">
                                        {item.description}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function NatureFeatureCard({ challenge }: { challenge?: Challenge }) {
    const href = challenge ? `/community/challenge/${challenge.id}` : "/nature";
    const title = challenge?.title || "自然观察专题勇者挑战";
    const description = challenge?.description || "观察自然，记录生命，保护我们共同的家园";
    const badge = challenge
        ? (challenge.challengeType === "timed" ? "限时专题" : "本期专题")
        : "本期专题";

    return (
        <Link
            href={href}
            className="surface-card group relative hidden min-h-[282px] overflow-hidden rounded-[16px] md:block"
        >
            <Image
                src={natureFeatureImage}
                alt="蓝色鸟停在树枝上"
                fill
                sizes="(max-width: 1280px) 34vw, 560px"
                className="object-cover object-[68%_center] transition duration-500 group-hover:scale-105 dark:brightness-90"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(246,253,246,0.96)_0%,rgba(246,253,246,0.82)_43%,rgba(246,253,246,0.22)_72%,rgba(246,253,246,0.04)_100%)] dark:bg-[linear-gradient(90deg,rgba(6,22,14,0.9)_0%,rgba(6,22,14,0.72)_44%,rgba(6,22,14,0.18)_78%,rgba(6,22,14,0.04)_100%)]" />
            <div className="relative z-10 flex h-full max-w-[310px] flex-col justify-center px-8 py-7">
                <span className="mb-4 w-fit rounded-[8px] bg-[#dff4e6] px-4 py-2 text-[13px] font-bold text-[#168249] shadow-sm dark:bg-[#163c27] dark:text-[#7ee0a2]">
                    {badge}
                </span>
                <h2 className="text-[26px] font-black leading-tight text-[#0b1831] dark:text-[#edf6ff]">
                    {title}
                </h2>
                <p className="mt-3 text-[15px] font-medium leading-7 text-[#2b3b52] dark:text-[#c5d4e6]">
                    {description}
                </p>
                <span className="mt-7 inline-flex h-11 w-fit items-center gap-2 rounded-[12px] bg-[#1f9a55] px-5 text-[15px] font-bold text-white shadow-[0_16px_32px_-20px_rgba(31,154,85,0.82)] transition group-hover:bg-[#168249]">
                    参与专题挑战
                    <ArrowRight className="h-4 w-4" />
                </span>
            </div>
        </Link>
    );
}

function CommunityTabs({
    activeTab,
    onChange,
}: {
    activeTab: CommunityTab;
    onChange: (tab: CommunityTab) => void;
}) {
    return (
        <div className="flex min-w-0 items-center gap-6 md:gap-8">
            {([
                ["discussions", "讨论区"],
                ["challenges", "挑战"],
            ] as const).map(([value, label]) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => onChange(value)}
                    className={cn(
                        "relative h-[50px] whitespace-nowrap px-1 text-[18px] font-semibold text-[#536179] transition hover:text-[#126ee8] md:h-[58px]",
                        activeTab === value && "text-[#126ee8] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-[#1677ff]"
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function getChallengeMeta(challenge: Challenge) {
    const participantText = `${challenge.participants.toLocaleString("zh-CN")} 人参与`;
    const submissionText = `${getChallengeSubmissionCount(challenge).toLocaleString("zh-CN")} 次提交`;

    return { participantText, submissionText };
}

function CompactChallengeCard({
    challenge,
    ended = false,
    action = false,
}: {
    challenge: Challenge;
    ended?: boolean;
    action?: boolean;
}) {
    const { participantText, submissionText } = getChallengeMeta(challenge);
    const imageSrc = challenge.image || "/projects/generated/project-0010.webp";

    return (
        <article className="group relative grid min-h-[116px] grid-cols-[112px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[14px] border border-[#dde8f4] bg-white/82 p-2 shadow-[0_14px_34px_-30px_rgba(20,72,132,0.55)] transition hover:border-[#bdd7f7] hover:bg-white dark:border-[#243348] dark:bg-[#0d1828]/82 dark:hover:border-[#35516f] min-[420px]:grid-cols-[132px_minmax(0,1fr)] md:grid-cols-[132px_minmax(0,1fr)] md:gap-4">
            <Link
                href={`/community/challenge/${challenge.id}`}
                className="absolute inset-0 z-10 rounded-[14px]"
                aria-label={`进入挑战：${challenge.title}`}
            />
            <div className="relative min-h-[98px] overflow-hidden rounded-[10px] bg-[#eaf2fb]">
                <OptimizedImage
                    src={imageSrc}
                    alt={challenge.title}
                    fill
                    variant="thumbnail"
                    className="object-cover transition duration-500 group-hover:scale-105"
                />
                {challenge.challengeType === "timed" && !ended ? (
                    <span className="absolute left-2 top-2 rounded-[7px] bg-[#18365a]/92 px-2 py-1 text-[11px] font-semibold text-white shadow-sm">
                        {challenge.daysLeft > 0 ? `剩余 ${challenge.daysLeft} 天` : "即将截止"}
                    </span>
                ) : null}
                {ended ? (
                    <span className="absolute left-2 top-2 rounded-[7px] bg-black/58 px-2 py-1 text-[11px] font-semibold text-white">
                        已结束
                    </span>
                ) : null}
            </div>

            <div className="relative z-0 flex min-w-0 flex-col justify-center py-1 pr-1 pointer-events-none">
                <h3 className="line-clamp-2 min-h-[48px] whitespace-normal break-words text-[16px] font-black leading-6 text-[#12213a] transition group-hover:text-[#126ee8] dark:text-[#edf6ff] md:text-[17px]">
                    {challenge.title}
                </h3>
                <p className="mt-1 hidden text-[13px] leading-5 text-[#627087] dark:text-[#adbbcc] xl:line-clamp-1">
                    {challenge.description}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#536179] dark:text-[#b5c4d5]">
                    <span className="inline-flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5" />
                        {participantText}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-[#ff9a1f]" />
                        <span className="truncate">{submissionText}</span>
                    </span>
                </div>
            </div>

            {action && !ended ? (
                <span className="pointer-events-none absolute bottom-3 right-3 z-0 hidden h-9 items-center rounded-[10px] bg-[#1677ff] px-4 text-[13px] font-bold text-white shadow-[0_14px_28px_-20px_rgba(22,119,255,0.78)] min-[560px]:inline-flex">
                    参与挑战
                </span>
            ) : null}
        </article>
    );
}

function ChallengeRailSection({
    title,
    challenges,
    ended = false,
    onMore,
    action = false,
    showMore = true,
}: {
    title: string;
    challenges: Challenge[];
    ended?: boolean;
    onMore: () => void;
    action?: boolean;
    showMore?: boolean;
}) {
    if (challenges.length === 0) return null;

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-[18px] font-black text-[#12213a] dark:text-[#edf6ff] md:text-[20px]">{title}</h2>
                {showMore ? (
                    <button
                        type="button"
                        onClick={onMore}
                        className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#1677ff] transition hover:text-[#0f5fcf]"
                    >
                        查看更多
                        <ChevronRight className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            <div className="space-y-3">
                {challenges.slice(0, 2).map((challenge) => (
                    <CompactChallengeCard key={challenge.id} challenge={challenge} ended={ended} action={action} />
                ))}
            </div>
        </section>
    );
}

function ChallengeRail({
    activeTimed,
    evergreen,
    ended,
    isLoading,
    challengesError,
    reloadChallenges,
    onMore,
    className,
    action = false,
}: {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
    isLoading: boolean;
    challengesError: string | null;
    reloadChallenges: () => void;
    onMore: () => void;
    className?: string;
    action?: boolean;
}) {
    return (
        <aside className={cn("surface-panel space-y-7 overflow-hidden p-4 md:p-5", className)}>
            {challengesError && !isLoading ? (
                <div className="rounded-[16px] border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
                    <p className="text-base font-bold">挑战加载失败</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{challengesError}</p>
                    <Button className="mt-4 rounded-[10px]" onClick={() => void reloadChallenges()}>
                        重试
                    </Button>
                </div>
            ) : null}

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 rounded-[14px] border border-[#dde8f4] bg-white/70 p-2 dark:border-[#243348] dark:bg-[#0d1828]/70">
                            <div className="h-[98px] animate-pulse rounded-[10px] bg-muted" />
                            <div className="space-y-3 py-2">
                                <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                                <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
                                <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {!challengesError && !isLoading ? (
                <>
                    <ChallengeRailSection title="进行中的限时挑战" challenges={activeTimed} onMore={onMore} action={action} />
                    <ChallengeRailSection title="长期学习挑战" challenges={evergreen} onMore={onMore} action={action} />
                    <ChallengeRailSection title="已结束挑战" challenges={ended} ended onMore={onMore} />
                    {activeTimed.length === 0 && evergreen.length === 0 && ended.length === 0 ? (
                        <div className="rounded-[16px] border border-[#dde8f4] bg-white/70 px-5 py-10 text-center text-sm text-muted-foreground dark:border-[#243348] dark:bg-[#0d1828]/70">
                            暂无挑战
                        </div>
                    ) : null}
                </>
            ) : null}
        </aside>
    );
}

function ChallengeBoard({
    activeTimed,
    evergreen,
    ended,
    isLoading,
    challengesError,
    reloadChallenges,
    tabs,
}: {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
    isLoading: boolean;
    challengesError: string | null;
    reloadChallenges: () => void;
    tabs: ReactNode;
}) {
    const hasChallenges = activeTimed.length > 0 || evergreen.length > 0 || ended.length > 0;

    return (
        <section className="surface-panel overflow-hidden">
            <div className="flex min-h-[58px] items-center justify-between gap-4 border-b border-[#dfe8f2] px-4 dark:border-[#243348] md:px-6">
                {tabs}
            </div>
            <div className="space-y-7 p-4 md:p-6">
                {challengesError && !isLoading ? (
                    <div className="rounded-[16px] border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
                        <p className="text-lg font-bold">挑战加载失败</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{challengesError}</p>
                        <Button className="mt-4 rounded-[10px]" onClick={() => void reloadChallenges()}>
                            重试
                        </Button>
                    </div>
                ) : null}

                {isLoading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => (
                            <ChallengeCardSkeleton key={item} />
                        ))}
                    </div>
                ) : null}

                {!challengesError && !isLoading ? (
                    <>
                        {activeTimed.length > 0 ? (
                            <ChallengeRailSection title="进行中的限时挑战" challenges={activeTimed} onMore={() => {}} action showMore={false} />
                        ) : null}
                        {evergreen.length > 0 ? (
                            <ChallengeRailSection title="长期学习挑战" challenges={evergreen} onMore={() => {}} action showMore={false} />
                        ) : null}
                        {ended.length > 0 ? (
                            <ChallengeRailSection title="已结束挑战" challenges={ended} ended onMore={() => {}} showMore={false} />
                        ) : null}
                        {!hasChallenges ? (
                            <div className="rounded-[16px] border border-[#dde8f4] bg-white/70 px-6 py-14 text-center dark:border-[#243348] dark:bg-[#0d1828]/70">
                                <p className="text-lg font-bold">暂无挑战</p>
                                <p className="mt-2 text-sm text-muted-foreground">敬请期待新的挑战。</p>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </section>
    );
}

function CommunityPageContent() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useCommunity();
    const searchParams = useSearchParams();
    const initialTab = searchParams.get("tab") === "challenges" ? "challenges" : "discussions";
    const [activeTab, setActiveTab] = useState<CommunityTab>(initialTab);
    const [hasMounted, setHasMounted] = useState(false);
    const [discussionTotal, setDiscussionTotal] = useState<number | null>(null);
    const featuredNatureChallenges = getFeaturedNatureChallenges(challenges);
    const activeTimed = challenges.activeTimed ?? [];
    const evergreen = challenges.evergreen ?? [];
    const ended = challenges.ended ?? [];
    const displayChallengeGroups = hasMounted
        ? { activeTimed, evergreen, ended }
        : { activeTimed: [], evergreen: [], ended: [] };
    const displayIsLoading = hasMounted ? isLoading : true;
    const displayChallengesError = hasMounted ? challengesError : null;
    const metrics = buildHeroMetrics(displayChallengeGroups, hasMounted ? discussionTotal : null);
    const featureChallenge = hasMounted ? featuredNatureChallenges[0] : undefined;
    const tabs = <CommunityTabs activeTab={activeTab} onChange={setActiveTab} />;

    useEffect(() => {
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (typeof fetch !== "function") return;

        let cancelled = false;

        fetch("/api/discussions?page=0&pageSize=1&sort=newest")
            .then((response) => {
                if (!response.ok) return null;
                return response.json() as Promise<{ total?: number }>;
            })
            .then((payload) => {
                if (!cancelled && typeof payload?.total === "number") {
                    setDiscussionTotal(payload.total);
                }
            })
            .catch(() => {
                if (!cancelled) setDiscussionTotal(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f7fbff_0%,#f2f7fd_54%,hsl(var(--background))_100%)] dark:bg-[linear-gradient(180deg,#07101d_0%,#0a1421_56%,hsl(var(--background))_100%)]">
            <MobileCommunityHeader />
            <main className="mx-auto w-full max-w-[1840px] px-4 pb-28 pt-4 min-[390px]:px-5 md:px-8 md:py-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,2.08fr)_minmax(360px,0.92fr)] xl:grid-cols-[minmax(0,2.12fr)_minmax(420px,0.9fr)]">
                    <CommunityHero metrics={metrics} />
                    <NatureFeatureCard challenge={featureChallenge} />
                </div>

                    <div
                        className={cn(
                            "mt-5 grid items-start gap-5",
                            activeTab === "discussions"
                                ? "lg:grid-cols-[minmax(0,2.08fr)_minmax(360px,0.92fr)] xl:grid-cols-[minmax(0,2.12fr)_minmax(420px,0.9fr)]"
                                : "lg:grid-cols-1"
                        )}
                    >
                        {activeTab === "discussions" ? (
                            <DiscussionList tabsSlot={tabs} />
                        ) : (
                            <ChallengeBoard
                                activeTimed={displayChallengeGroups.activeTimed}
                                evergreen={displayChallengeGroups.evergreen}
                                ended={displayChallengeGroups.ended}
                                isLoading={displayIsLoading}
                                challengesError={displayChallengesError}
                                reloadChallenges={reloadChallenges}
                                tabs={tabs}
                            />
                        )}

                        {activeTab === "discussions" ? (
                            <ChallengeRail
                                activeTimed={displayChallengeGroups.activeTimed}
                                evergreen={displayChallengeGroups.evergreen}
                                ended={displayChallengeGroups.ended}
                                isLoading={displayIsLoading}
                                challengesError={displayChallengesError}
                                reloadChallenges={reloadChallenges}
                                onMore={() => setActiveTab("challenges")}
                                className="hidden lg:block"
                            />
                        ) : null}
                    </div>

                    {activeTab === "discussions" ? (
                        <ChallengeRail
                            activeTimed={displayChallengeGroups.activeTimed}
                            evergreen={displayChallengeGroups.evergreen}
                            ended={displayChallengeGroups.ended}
                            isLoading={displayIsLoading}
                            challengesError={displayChallengesError}
                            reloadChallenges={reloadChallenges}
                            onMore={() => setActiveTab("challenges")}
                            className="mt-4 lg:hidden"
                            action
                        />
                    ) : null}
            </main>
        </div>
    );
}

export default function CommunityPage() {
    return (
        <Suspense
            fallback={
                <div className="mx-auto w-full max-w-[1840px] px-4 py-10 md:px-8">
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
