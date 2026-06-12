"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";
import {
    Image as ImageIcon,
    Lightbulb,
    Sparkles,
    Wrench,
} from "lucide-react";

import { useChallenge } from "@/lib/context/challenge-context";
import { ChallengeBoard } from "@/components/features/pbl/challenge-board";
import { CourseBoard } from "@/components/features/courses/course-board";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { cn } from "@/lib/utils";

const createHeroImage = "/assets/community-hero-kids-robot.png";
const mobileHeaderClassName =
    "border-b border-[hsl(var(--surface-border)/0.42)] bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.92)_0%,hsl(var(--app-canvas)/0.78)_100%)] backdrop-blur-xl";

type CreateTab = "pbl" | "courses";

const CREATE_TABS = [
    { value: "pbl" as const, label: "PBL 挑战", tabId: "create-tab-pbl", panelId: "create-panel-pbl" },
    { value: "courses" as const, label: "训练营", tabId: "create-tab-courses", panelId: "create-panel-courses" },
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

function CreateHero() {
    return (
        <section className="relative isolate min-h-[232px] overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.68)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_70px_-44px_hsl(var(--brand-blue)/0.28)] md:min-h-[360px] lg:min-h-[374px]">
            <Image
                src={createHeroImage}
                alt="孩子们围坐在桌前调试机器人小车"
                fill
                priority
                loading="eager"
                sizes="(max-width: 1024px) 100vw, 100vw"
                className="object-cover object-[66%_center] dark:brightness-75 md:object-[72%_center]"
            />
            <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(180deg,rgba(4,16,31,0.02)_0%,rgba(4,16,31,0.08)_44%,rgba(4,16,31,0.48)_100%)] md:bg-[linear-gradient(90deg,rgba(247,251,255,0.92)_0%,rgba(247,251,255,0.74)_34%,rgba(247,251,255,0.18)_66%,rgba(247,251,255,0.02)_86%),linear-gradient(180deg,rgba(4,16,31,0.02)_0%,rgba(4,16,31,0.16)_100%)] md:dark:bg-[linear-gradient(90deg,rgba(7,16,29,0.86)_0%,rgba(7,16,29,0.62)_34%,rgba(7,16,29,0.18)_68%,rgba(7,16,29,0.02)_88%),linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.24)_100%)]" />

            <div className="relative z-10 flex min-h-[232px] flex-col justify-end p-4 text-white min-[390px]:min-h-[244px] md:min-h-[360px] md:justify-between md:px-8 md:py-9 md:text-foreground lg:min-h-[374px] lg:px-10">
                <div className="max-w-[18rem] md:max-w-[32rem]">
                    <p className="max-w-[13.5rem] text-[16px] font-extrabold leading-[1.28] tracking-normal [text-shadow:0_2px_7px_rgba(0,0,0,0.72)] min-[390px]:text-[17px] md:max-w-[28rem] md:text-[28px] md:font-black md:leading-[1.12] md:text-[hsl(var(--community-hero-fg))] md:[text-shadow:0_2px_10px_rgba(255,255,255,0.7)] md:dark:text-slate-50 md:dark:[text-shadow:0_2px_8px_rgba(0,0,0,0.82)]">
                        动手实践，探索创造的乐趣
                    </p>
                    <p className="mt-2 max-w-[15rem] text-[13px] font-semibold leading-5 text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.68)] min-[390px]:max-w-[16rem] min-[390px]:text-sm min-[390px]:leading-[1.45] md:mt-3 md:max-w-md md:text-base md:leading-7 md:text-[hsl(var(--community-hero-muted))] md:[text-shadow:none]">
                        <span className="md:hidden">挑挑战或进训练营，把想法做出来。</span>
                        <span className="hidden md:inline">挑一个真实挑战开始，或者进入训练营把 Scratch 作品一步步做出来。</span>
                    </p>
                </div>
            </div>
        </section>
    );
}

function CreatePathCardsSection() {
    return (
        <section aria-label="创造路径">
            <p className="mb-2 text-xs font-medium text-muted-foreground md:hidden">左右滑动查看更多</p>
            <div className="relative md:static">
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
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-[linear-gradient(270deg,hsl(var(--app-canvas))_0%,hsl(var(--app-canvas)/0)_100%)] md:hidden"
                />
            </div>
        </section>
    );
}

function CreateTabs({
    activeTab,
    onChange,
}: {
    activeTab: CreateTab;
    onChange: (tab: CreateTab) => void;
}) {
    const focusTab = (tabId: string) => {
        document.getElementById(tabId)?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
            return;
        }

        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (index + direction + CREATE_TABS.length) % CREATE_TABS.length;
        const nextTab = CREATE_TABS[nextIndex];
        onChange(nextTab.value);
        focusTab(nextTab.tabId);
    };

    return (
        <div role="tablist" aria-label="创造内容分类" className="flex min-w-0 items-center gap-6 md:gap-8">
            {CREATE_TABS.map((tab, index) => (
                <button
                    key={tab.value}
                    id={tab.tabId}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.value}
                    aria-controls={tab.panelId}
                    tabIndex={activeTab === tab.value ? 0 : -1}
                    onClick={() => onChange(tab.value)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    className={cn(
                        "community-tab",
                        activeTab === tab.value && "community-tab-active",
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export function CreatePageClient() {
    const { challenges, challengesError, isLoading, reloadChallenges } = useChallenge();
    const [activeTab, setActiveTab] = useState<CreateTab>("pbl");
    const activeTimed = challenges.activeTimed ?? [];
    const evergreen = challenges.evergreen ?? [];
    const ended = challenges.ended ?? [];
    const activePanel = CREATE_TABS.find((tab) => tab.value === activeTab) ?? CREATE_TABS[0];

    return (
        <div className="min-h-screen app-canvas-community">
            <MobileGlobalHeader
                variant="title"
                title="创造"
                showSearch={true}
                showUserButton={true}
                showNotification={true}
                className={mobileHeaderClassName}
            />
            <main className="app-shell-wide space-y-4 pb-28 pt-5 md:space-y-6 md:pb-14 md:pt-6">
                <CreateHero />
                <CreatePathCardsSection />

                <section aria-label="挑战与训练营">
                    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[hsl(var(--surface-border)/0.78)] bg-[hsl(var(--surface-raised)/0.94)] shadow-[0_18px_48px_-40px_hsl(var(--surface-shadow)/0.32)] backdrop-blur-sm md:border-[hsl(var(--surface-border)/0.9)] md:bg-[hsl(var(--surface-raised)/0.9)] md:shadow-[0_24px_70px_-46px_hsl(var(--surface-shadow)/0.42)]">
                        <div className="flex min-h-[48px] items-center justify-between gap-4 border-b border-[hsl(var(--surface-border)/0.62)] px-1 md:min-h-[58px] md:border-[hsl(var(--surface-border)/0.72)] md:px-6">
                            <CreateTabs activeTab={activeTab} onChange={setActiveTab} />
                        </div>
                        <div
                            role="tabpanel"
                            id={activePanel.panelId}
                            aria-labelledby={activePanel.tabId}
                        >
                            {activeTab === "pbl" ? (
                                <ChallengeBoard
                                    activeTimed={activeTimed}
                                    evergreen={evergreen}
                                    ended={ended}
                                    isLoading={isLoading}
                                    challengesError={challengesError}
                                    reloadChallenges={reloadChallenges}
                                />
                            ) : (
                                <CourseBoard />
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
