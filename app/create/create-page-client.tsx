"use client";

import Image from "next/image";
import { useState, type KeyboardEvent } from "react";

import { useChallenge } from "@/lib/context/challenge-context";
import { ChallengeBoard } from "@/components/features/pbl/challenge-board";
import { CourseBoardLoader } from "@/components/features/courses/course-board-loader";
import { MobileGlobalHeader } from "@/components/layout/mobile-global-header";
import { cn } from "@/lib/utils";

const createHeroImage = "/assets/community-hero-kids-robot.png";
const mobileHeaderClassName =
    "border-b border-[hsl(var(--surface-border)/0.42)] bg-[linear-gradient(180deg,hsl(var(--surface-raised)/0.92)_0%,hsl(var(--app-canvas)/0.78)_100%)] backdrop-blur-xl";

type CreateTab = "pbl" | "courses";

const CREATE_TABS = [
    { value: "pbl" as const, label: "项目挑战", tabId: "create-tab-pbl", panelId: "create-panel-pbl" },
    { value: "courses" as const, label: "技能课程", tabId: "create-tab-courses", panelId: "create-panel-courses" },
] as const;

function CreateHero() {
    return (
        <section className="relative isolate min-h-[220px] overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.68)] bg-[hsl(var(--surface-raised))] shadow-[0_24px_70px_-44px_hsl(var(--brand-blue)/0.28)] min-[390px]:min-h-[236px] md:min-h-[360px] lg:min-h-[374px]">
            <Image
                src={createHeroImage}
                alt="孩子们围坐在桌前调试机器人小车"
                fill
                priority
                loading="eager"
                sizes="(max-width: 1024px) 100vw, 100vw"
                className="object-cover object-[66%_center] dark:brightness-75 md:object-[72%_center]"
            />
            <div className="pointer-events-none absolute inset-0 z-1 bg-[linear-gradient(180deg,rgba(4,16,31,0.04)_0%,rgba(4,16,31,0.2)_42%,rgba(4,16,31,0.64)_100%)] md:bg-[linear-gradient(90deg,rgba(247,251,255,0.92)_0%,rgba(247,251,255,0.74)_34%,rgba(247,251,255,0.18)_66%,rgba(247,251,255,0.02)_86%),linear-gradient(180deg,rgba(4,16,31,0.02)_0%,rgba(4,16,31,0.16)_100%)] md:dark:bg-[linear-gradient(90deg,rgba(7,16,29,0.86)_0%,rgba(7,16,29,0.62)_34%,rgba(7,16,29,0.18)_68%,rgba(7,16,29,0.02)_88%),linear-gradient(180deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.24)_100%)]" />

            <div className="relative z-10 flex min-h-[220px] flex-col justify-end p-5 text-white min-[390px]:min-h-[236px] md:min-h-[360px] md:justify-between md:px-8 md:py-9 md:text-foreground lg:min-h-[374px] lg:px-10">
                <div className="max-w-[20rem] md:max-w-lg">
                    <p className="max-w-[16rem] text-[20px] font-black leading-[1.3] tracking-normal [text-shadow:0_2px_8px_rgba(0,0,0,0.78)] min-[390px]:max-w-[18rem] min-[390px]:text-[22px] md:max-w-md md:text-[28px] md:leading-[1.12] md:text-[hsl(var(--community-hero-fg))] md:[text-shadow:0_2px_10px_rgba(255,255,255,0.7)] md:dark:text-slate-50 md:dark:[text-shadow:0_2px_8px_rgba(0,0,0,0.82)]">
                        动手实践，探索创造的乐趣
                    </p>
                    <p className="mt-3 hidden max-w-md text-base font-semibold leading-7 text-[hsl(var(--community-hero-muted))] md:block">
                        接一个真实项目挑战，或者进入技能课程一步步学本领。
                    </p>
                </div>
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
                title="创造营"
                showSearch={true}
                showUserButton={true}
                showNotification={true}
                className={mobileHeaderClassName}
            />
            <main className="app-shell-wide space-y-4 pb-28 pt-5 md:space-y-6 md:pb-14 md:pt-6">
                <CreateHero />

                <section aria-label="项目挑战与技能课程">
                    <div className="flex min-h-[44px] items-center justify-between gap-4 border-b border-[hsl(var(--surface-border)/0.72)] px-3 md:min-h-[58px] md:px-6">
                        <CreateTabs activeTab={activeTab} onChange={setActiveTab} />
                    </div>
                    <div
                        role="tabpanel"
                        id={activePanel.panelId}
                        aria-labelledby={activePanel.tabId}
                        className="mt-3 md:mt-5"
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
                            <CourseBoardLoader />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
