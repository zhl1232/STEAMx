"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
    ArrowRight,
    Image as ImageIcon,
    Lightbulb,
    Sparkles,
    Trophy,
    UsersRound,
    Wrench,
} from "lucide-react";

import { useChallenge } from "@/lib/context/challenge-context";
import {
    ChallengeBoard,
    getChallengeSubmissionCount,
} from "@/components/features/pbl/challenge-board";
import { CourseBoard } from "@/components/features/courses/course-board";
import { getFeaturedNatureChallenges } from "@/lib/pbl/featured-nature-challenges";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import type { Challenge } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";

const createHeroImage = "/assets/community-hero-kids-robot.png";
const natureFeatureImage = "/assets/home-nature-channel-bird.png";
const mobileHeaderClassName =
    "border-b border-[hsl(var(--surface-border)/0.42)] bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.92)_0%,hsl(var(--app-canvas)/0.78)_100%)] backdrop-blur-xl";

type CreateTab = "pbl" | "courses";

type ChallengeGroups = {
    activeTimed: Challenge[];
    evergreen: Challenge[];
    ended: Challenge[];
};

const heroMetricToneClassNames = [
    "text-[hsl(var(--brand-blue))]",
    "text-[hsl(var(--status-success))]",
    "text-[hsl(var(--brand-amber))]",
    "text-[hsl(var(--tone-art))]",
] as const;

const createValues = [
    {
        label: "动手实验",
        description: "科学原理，亲手验证",
        icon: Wrench,
        color: "text-[hsl(var(--brand-blue))]",
        chip: "bg-[hsl(var(--brand-blue)/0.12)] ring-[hsl(var(--brand-blue)/0.22)]",
    },
    {
        label: "解决问题",
        description: "真实场景，独立思考",
        icon: Lightbulb,
        color: "text-[hsl(var(--status-success))]",
        chip: "bg-[hsl(var(--status-success)/0.12)] ring-[hsl(var(--status-success)/0.22)]",
    },
    {
        label: "创意作品",
        description: "想法变现，独一无二",
        icon: Sparkles,
        color: "text-[hsl(var(--brand-amber))]",
        chip: "bg-[hsl(var(--brand-amber)/0.14)] ring-[hsl(var(--brand-amber)/0.24)]",
    },
    {
        label: "成果展示",
        description: "晒出成果，互相鼓励",
        icon: ImageIcon,
        color: "text-[hsl(var(--tone-art))]",
        chip: "bg-[hsl(var(--tone-art)/0.14)] ring-[hsl(var(--tone-art)/0.24)]",
    },
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

function buildHeroMetrics(challengeGroups: ChallengeGroups) {
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
        { value: formatMetricValue(challengeGroups.activeTimed.length), label: "限时专题", icon: Sparkles, color: heroMetricToneClassNames[1] },
        { value: formatMetricValue(participantCount), label: "参与人次", icon: UsersRound, color: heroMetricToneClassNames[2] },
        { value: formatMetricValue(submissionCount), label: "作品提交", icon: ImageIcon, color: heroMetricToneClassNames[3] },
    ] as const;
}

function CreateHero() {
    return (
        <section className="relative isolate min-h-[232px] overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.68)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_70px_-44px_hsl(var(--brand-blue)/0.28)] md:min-h-[360px] lg:min-h-[374px]">
            <Image
                src={createHeroImage}
                alt="孩子们围坐在桌前调试机器人小车"
                fill
                priority
                loading="eager"
                sizes="(max-width: 1024px) 100vw, calc(100vw - 520px)"
                className="object-cover object-[66%_center] dark:brightness-75 md:object-[72%_center]"
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,16,31,0.02)_0%,rgba(4,16,31,0.08)_44%,rgba(4,16,31,0.48)_100%)] md:bg-[linear-gradient(90deg,rgba(247,251,255,0.92)_0%,rgba(247,251,255,0.74)_34%,rgba(247,251,255,0.18)_66%,rgba(247,251,255,0.02)_86%),linear-gradient(180deg,rgba(4,16,31,0.02)_0%,rgba(4,16,31,0.16)_100%)] md:dark:bg-[linear-gradient(90deg,rgba(7,16,29,0.86)_0%,rgba(7,16,29,0.62)_34%,rgba(7,16,29,0.18)_68%,rgba(7,16,29,0.02)_88%),linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.24)_100%)]" />

            <div className="relative z-10 flex min-h-[232px] flex-col justify-end p-4 text-white min-[390px]:min-h-[244px] md:min-h-[360px] md:justify-between md:px-8 md:py-9 md:text-foreground lg:min-h-[374px] lg:px-10">
                <div className="max-w-[18rem] md:max-w-[32rem]">
                    <p className="max-w-[13.5rem] text-[16px] font-extrabold leading-[1.28] tracking-normal [text-shadow:0_2px_7px_rgba(0,0,0,0.72)] min-[390px]:text-[17px] md:max-w-[28rem] md:text-[28px] md:font-black md:leading-[1.12] md:text-[hsl(var(--community-hero-fg))] md:[text-shadow:0_2px_10px_rgba(255,255,255,0.7)] md:dark:text-slate-50 md:dark:[text-shadow:0_2px_8px_rgba(0,0,0,0.82)]">
                        动手实践，探索创造的乐趣
                    </p>
                    <p className="mt-3 hidden max-w-md text-sm font-semibold leading-6 text-[hsl(var(--community-hero-muted))] md:block md:text-base md:leading-7">
                        挑一个真实挑战开始，或者进入训练营把 Scratch 作品一步步做出来。
                    </p>
                </div>
            </div>
        </section>
    );
}

function CreatePathCardsSection() {
    return (
        <section aria-label="创造路径">
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
                {createValues.map((item) => (
                    <div
                        key={item.label}
                        className="relative flex w-[58vw] max-w-[240px] shrink-0 snap-start items-start gap-3 overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.88)] bg-[hsl(var(--surface-raised))] p-3.5 shadow-[0_14px_36px_-30px_hsl(var(--surface-shadow)/0.24)] md:w-auto md:max-w-none md:flex-col md:gap-3 md:p-5"
                    >
                        <span
                            className={cn(
                                "grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] ring-1 ring-inset md:h-11 md:w-11",
                                item.chip,
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", item.color)} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-sans text-base font-bold leading-5 text-foreground md:mt-1 md:text-lg md:leading-6">
                                {item.label}
                            </h3>
                            <p className="mt-1.5 text-xs leading-5 text-muted-foreground md:text-sm md:leading-6">
                                {item.description}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function NatureFeatureCard({ challenge }: { challenge?: Challenge }) {
    const href = challenge ? `/pbl/${challenge.id}` : "/nature";
    const title = challenge?.title || "自然观察专题挑战";
    const description = challenge?.description || "观察自然，记录生命，保护我们共同的家园";
    const badge = challenge
        ? (challenge.challengeType === "timed" ? "限时专题" : "本期专题")
        : "本期专题";

    return (
        <Link
            href={href}
            className="surface-card group relative block min-h-[260px] overflow-hidden rounded-[var(--radius-sm)]"
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
                <span className="status-success-surface mb-4 w-fit rounded-[var(--radius-xs)] border px-4 py-2 text-[13px] font-bold shadow-sm">
                    {badge}
                </span>
                <h2 className="text-panel-title font-black leading-tight text-[hsl(var(--community-hero-fg))]">
                    {title}
                </h2>
                <p className="mt-3 text-[15px] font-medium leading-7 text-[hsl(var(--community-hero-muted))]">
                    {description}
                </p>
                <span className="mt-7 inline-flex h-11 w-fit items-center gap-2 rounded-[var(--radius-sm)] bg-[hsl(var(--status-success))] px-5 text-[15px] font-bold text-[hsl(var(--status-success-foreground))] shadow-[0_16px_32px_-20px_hsl(var(--status-success)/0.82)] transition group-hover:bg-[hsl(var(--status-success)/0.9)]">
                    参与专题挑战
                    <ArrowRight className="h-4 w-4" />
                </span>
            </div>
        </Link>
    );
}

function CreateStatsCard({ metrics }: { metrics: ReturnType<typeof buildHeroMetrics> }) {
    return (
        <section className="surface-panel p-5">
            <div className="flex items-start justify-between gap-4">
                <h2 className="text-[20px] font-bold leading-7 text-foreground">本期进度</h2>
                <span className="shrink-0 pt-1 text-xs font-semibold text-muted-foreground">公开数据</span>
            </div>
            <div className="mt-4 divide-y divide-border/70">
                {metrics.map((metric) => (
                    <div key={metric.label} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[hsl(var(--surface-muted)/0.72)]">
                            <metric.icon className={cn("h-5 w-5", metric.color)} strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-xl font-black leading-6 tabular-nums text-foreground">{metric.value}</p>
                            <p className="mt-1 text-xs font-semibold text-muted-foreground">{metric.label}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function DesktopCreateSidebar({
    challenge,
    metrics,
}: {
    challenge?: Challenge;
    metrics: ReturnType<typeof buildHeroMetrics>;
}) {
    return (
        <aside className="hidden min-w-0 lg:block">
            <div className="sticky top-20 space-y-5">
                <NatureFeatureCard challenge={challenge} />
                <CreateStatsCard metrics={metrics} />
            </div>
        </aside>
    );
}

function CreateTabs({
    activeTab,
    onChange,
}: {
    activeTab: CreateTab;
    onChange: (tab: CreateTab) => void;
}) {
    return (
        <div className="flex min-w-0 items-center gap-6 md:gap-8">
            {([
                ["pbl", "PBL 挑战"],
                ["courses", "训练营"],
            ] as const).map(([value, label]) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onChange(value)}
                        className={cn(
                            "community-tab",
                            activeTab === value && "community-tab-active",
                        )}
                    >
                        {label}
                    </button>
                ))}
        </div>
    );
}

export function CreatePageClient() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useChallenge();
    const [activeTab, setActiveTab] = useState<CreateTab>("pbl");
    const featuredNatureChallenges = getFeaturedNatureChallenges(challenges);
    const activeTimed = challenges.activeTimed ?? [];
    const evergreen = challenges.evergreen ?? [];
    const ended = challenges.ended ?? [];
    const displayChallengeGroups = { activeTimed, evergreen, ended };
    const metrics = buildHeroMetrics(displayChallengeGroups);
    const featureChallenge = featuredNatureChallenges[0];

    return (
        <div className="min-h-screen app-canvas-community">
            <MobileGlobalHeader
                variant="title"
                title="创造"
                showUserButton={false}
                showNotification={true}
                className={mobileHeaderClassName}
            />
            <main className="app-shell-wide grid gap-5 pb-28 pt-5 md:pb-14 md:pt-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
                <div className="min-w-0 space-y-4 md:space-y-6">
                    <CreateHero />
                    <CreatePathCardsSection />

                    <section>
                        <div className="overflow-hidden rounded-none bg-transparent shadow-none md:rounded-[var(--radius-sm)] md:border md:border-[hsl(var(--surface-border)/0.9)] md:bg-[hsl(var(--surface-raised)/0.9)] md:shadow-[0_24px_70px_-46px_hsl(var(--surface-shadow)/0.42)] md:backdrop-blur-sm">
                            <div className="flex min-h-[48px] items-center justify-between gap-4 px-0 md:min-h-[58px] md:border-b md:border-[hsl(var(--surface-border)/0.72)] md:px-6">
                                <CreateTabs activeTab={activeTab} onChange={setActiveTab} />
                            </div>
                            {activeTab === "pbl" ? (
                                <ChallengeBoard
                                    activeTimed={displayChallengeGroups.activeTimed}
                                    evergreen={displayChallengeGroups.evergreen}
                                    ended={displayChallengeGroups.ended}
                                    isLoading={isLoading}
                                    challengesError={challengesError}
                                    reloadChallenges={reloadChallenges}
                                />
                            ) : (
                                <CourseBoard />
                            )}
                        </div>
                    </section>
                </div>

                <DesktopCreateSidebar challenge={featureChallenge} metrics={metrics} />
            </main>
        </div>
    );
}
