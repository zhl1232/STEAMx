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
    { label: "动手实验", description: "科学原理，亲手验证", icon: Wrench, color: "text-[hsl(var(--brand-blue))]" },
    { label: "解决问题", description: "真实场景，独立思考", icon: Lightbulb, color: "text-[hsl(var(--status-success))]" },
    { label: "创意作品", description: "想法变现，独一无二", icon: Sparkles, color: "text-[hsl(var(--brand-amber))]" },
    { label: "成果展示", description: "晒出成果，互相鼓励", icon: ImageIcon, color: "text-[hsl(var(--tone-engineering))]" },
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

function CreateHero({ metrics }: { metrics: ReturnType<typeof buildHeroMetrics> }) {
    return (
        <section className="surface-card relative overflow-hidden rounded-[var(--radius-xl)] md:rounded-[var(--radius-md)]">
            <div className="relative min-h-[300px] md:min-h-[260px] xl:min-h-[282px]">
                <Image
                    src={createHeroImage}
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
                        <h1 className="community-hero-title whitespace-nowrap">
                            STEAM 创造营
                        </h1>
                        <p className="community-hero-lead">
                            动手做、解决真问题，把好奇变成作品
                        </p>
                    </div>

                    <div className="mt-auto grid max-w-[610px] grid-cols-4 gap-1 rounded-[var(--radius-md)] border border-white/60 bg-white/55 px-2 py-2 backdrop-blur-sm min-[390px]:gap-2 min-[390px]:px-3 dark:border-white/10 dark:bg-[hsl(var(--surface-shadow)/0.55)] md:mt-6 md:gap-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-0">
                        {metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="min-w-0 overflow-hidden px-1 py-1.5 text-center md:px-2 md:py-1"
                            >
                                <metric.icon className="mx-auto mb-1 h-5 w-5 text-foreground/85 dark:text-white/85 md:hidden" strokeWidth={2.4} />
                                <div className={cn("text-[20px] font-black leading-none tabular-nums md:text-[28px] md:drop-shadow-[0_2px_8px_rgba(255,255,255,0.72)]", metric.color)}>
                                    {metric.value}
                                </div>
                                <div className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-none text-[hsl(var(--community-hero-muted))] md:text-[13px] md:drop-shadow-[0_1px_6px_rgba(255,255,255,0.76)] md:dark:drop-shadow-[0_2px_7px_rgba(0,0,0,0.85)]">
                                    {metric.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 hidden max-w-[780px] grid-cols-4 gap-3 md:grid">
                        {createValues.map((item) => (
                            <div
                                key={item.label}
                                className="flex min-w-0 items-center gap-3 rounded-[var(--radius-sm)] border border-white/60 bg-white/40 px-4 py-3 text-left shadow-sm backdrop-blur-md transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9)] dark:hover:bg-white/[0.13]"
                            >
                                <item.icon className={cn("h-6 w-6 shrink-0", item.color, "dark:text-white/90")} strokeWidth={2.2} />
                                <div className="min-w-0">
                                    <div className="truncate text-[13px] font-bold text-foreground dark:text-white">
                                        {item.label}
                                    </div>
                                    <div className="mt-1 truncate text-[11px] text-muted-foreground dark:text-white/70">
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
    const href = challenge ? `/pbl/${challenge.id}` : "/nature";
    const title = challenge?.title || "自然观察专题挑战";
    const description = challenge?.description || "观察自然，记录生命，保护我们共同的家园";
    const badge = challenge
        ? (challenge.challengeType === "timed" ? "限时专题" : "本期专题")
        : "本期专题";

    return (
        <Link
            href={href}
            className="surface-card group relative hidden min-h-[282px] overflow-hidden rounded-md md:block"
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
            />
            <main className="app-shell-wide pb-28 pt-4 md:py-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,2.08fr)_minmax(360px,0.92fr)] xl:grid-cols-[minmax(0,2.12fr)_minmax(420px,0.9fr)]">
                    <CreateHero metrics={metrics} />
                    <NatureFeatureCard challenge={featureChallenge} />
                </div>

                <section className="mt-5">
                    <div className="surface-panel overflow-hidden">
                        <div className="flex min-h-[58px] items-center justify-between gap-4 border-b border-border px-4 md:px-6">
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
            </main>
        </div>
    );
}
