"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Award,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Circle,
    Hammer,
    Leaf,
    Loader2,
    LockKeyhole,
    ShieldCheck,
    Star,
    Trophy,
    UserRoundPlus,
} from "lucide-react";

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { LevelGuideDialog } from "@/components/features/gamification/level-guide-dialog";
import { LeaderboardItemSkeleton } from "@/components/ui/leaderboard-skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import type { BadgeTier } from "@/lib/gamification/types";
import { logger } from "@/lib/logger";
import type { GrowthTaskId, ProfileGrowthTask } from "@/lib/profile/growth-tasks";
import { getNameColorClassName } from "@/lib/shop/items";
import { cn } from "@/lib/utils";

export interface LeaderboardUser {
    id: string;
    name: string;
    xp: number;
    level: number;
    value: number;
    avatar: string | null | undefined;
    avatarFrameId?: string | null;
    nameColorId?: string | null;
    isCurrentUser?: boolean;
}

export type LeaderboardType = "xp" | "badges" | "projects" | "observations";
export type XpTimeRange = "weekly" | "monthly" | "alltime";

type LeaderboardConfig = {
    label: string;
    icon: ReactNode;
    valueLabel: string;
    description: string;
};

const RANK_STYLES: Record<number, { badge: string; card: string; value: string; label: string }> = {
    1: {
        badge: "from-amber-300 to-orange-500 text-white shadow-orange-500/25",
        card: "border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-amber-500/10 dark:border-amber-400/30 dark:from-amber-500/10 dark:via-white/[0.04] dark:to-orange-500/10",
        value: "text-orange-500 dark:text-amber-300",
        label: "冠军",
    },
    2: {
        badge: "from-slate-200 to-blue-300 text-slate-700 shadow-blue-400/20",
        card: "border-blue-200/80 bg-gradient-to-br from-blue-50 via-white to-slate-50 shadow-blue-500/10 dark:border-blue-300/25 dark:from-blue-500/10 dark:via-white/[0.04] dark:to-slate-500/10",
        value: "text-blue-600 dark:text-blue-300",
        label: "亚军",
    },
    3: {
        badge: "from-orange-200 to-orange-500 text-white shadow-orange-500/20",
        card: "border-orange-200/80 bg-gradient-to-br from-orange-50 via-white to-rose-50 shadow-orange-500/10 dark:border-orange-300/25 dark:from-orange-500/10 dark:via-white/[0.04] dark:to-rose-500/10",
        value: "text-orange-600 dark:text-orange-300",
        label: "季军",
    },
};

const PODIUM_ORDER = [2, 1, 3] as const;
const XP_TIME_RANGE_LABEL: Record<XpTimeRange, string> = { weekly: "本周", monthly: "本月", alltime: "总榜" };
const LEADERBOARD_TABS = ["xp", "badges", "projects", "observations"] as const;
const GROWTH_TASK_PREVIEW_LIMIT = 3;

const GROWTH_TASK_STATUS_ORDER: Record<ProfileGrowthTask["status"], number> = {
    claimable: 0,
    in_progress: 1,
    claimed: 2,
};

function getGrowthTaskPreview(tasks: ProfileGrowthTask[]) {
    return [...tasks]
        .sort((a, b) => {
            const statusDiff = GROWTH_TASK_STATUS_ORDER[a.status] - GROWTH_TASK_STATUS_ORDER[b.status];
            if (statusDiff !== 0) return statusDiff;
            return b.progress - a.progress;
        })
        .slice(0, GROWTH_TASK_PREVIEW_LIMIT);
}

function LeaderboardGrowthGraduatedCard() {
    return (
        <div className="rounded-md border border-blue-100 bg-gradient-to-br from-blue-50/90 to-white p-4 dark:border-blue-400/20 dark:from-blue-500/10 dark:to-white/[0.02]">
            <div className="flex items-start gap-2">
                <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">新手引导已完成</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        新手引导全部完成，来挑战下一阶段，把作品带到更大的舞台吧。
                    </p>
                    <Link
                        href="/create"
                        className="mt-3 inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300"
                    >
                        前往挑战中心
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function getValueColumnLabel(tab: LeaderboardType, range: XpTimeRange) {
    if (tab === "xp") return `${XP_TIME_RANGE_LABEL[range]}经验`;
    if (tab === "badges") return "徽章数量";
    if (tab === "observations") return "条记录";
    return "项目数量";
}

function getRowHighlights(tab: LeaderboardType, rank: number) {
    if (tab === "badges") {
        return rank <= 10 ? ["徽章解锁", "成长成就"] : ["成就积累", "持续成长"];
    }

    if (tab === "projects") {
        return rank <= 10 ? ["项目实践", "完成记录"] : ["实践积累", "稳步推进"];
    }

    if (tab === "observations") {
        return rank <= 10 ? ["自然观察", "公开记录"] : ["观察积累", "持续记录"];
    }

    return rank <= 10 ? ["经验表现", "持续探索"] : ["持续记录", "稳步成长"];
}

function getTabConfig(tab: LeaderboardType): LeaderboardConfig {
    switch (tab) {
        case "xp":
            return {
                label: "经验榜",
                icon: <Star className="h-4 w-4" />,
                valueLabel: "经验",
                description: "按经验值统计持续探索与学习贡献",
            };
        case "badges":
            return {
                label: "徽章榜",
                icon: <Award className="h-4 w-4" />,
                valueLabel: "枚徽章",
                description: "按已解锁徽章数量统计成长成就",
            };
        case "projects":
            return {
                label: "实干榜",
                icon: <Hammer className="h-4 w-4" />,
                valueLabel: "个项目",
                description: "按发布与完成的项目统计实践成果",
            };
        case "observations":
            return {
                label: "观察榜",
                icon: <Leaf className="h-4 w-4" />,
                valueLabel: "条记录",
                description: "按公开通过的自然观察记录统计",
            };
    }
}

function getPodiumBadges(tab: LeaderboardType, rank: number): Array<{ icon: string; tier: BadgeTier; seriesKey?: string; label: string }> {
    if (tab === "badges") {
        return [
            { icon: "award", tier: rank === 1 ? "gold" : "silver", seriesKey: "level", label: "等级晋升" },
            { icon: "trophy", tier: "gold", seriesKey: "milestone", label: "成就里程碑" },
            { icon: "heart", tier: rank === 3 ? "bronze" : "silver", seriesKey: "popularity", label: "人气之星" },
        ];
    }

    if (tab === "projects") {
        return [
            { icon: "trophy", tier: rank === 1 ? "gold" : "bronze", seriesKey: "milestone", label: "完成里程碑" },
            { icon: "blueprint", tier: "silver", seriesKey: "engineering_expert", label: "工程实践" },
            { icon: "upload", tier: rank === 1 ? "gold" : "bronze", seriesKey: "intro_publish", label: "发布成长" },
        ];
    }

    if (tab === "observations") {
        return [
            { icon: "binoculars", tier: rank === 1 ? "gold" : "silver", seriesKey: "bird_observer", label: "自然观察先锋" },
            { icon: "feather", tier: "silver", seriesKey: "species_collector", label: "物种收集" },
            { icon: "binoculars", tier: rank === 3 ? "bronze" : "silver", seriesKey: "bird_observer", label: "观察记录" },
        ];
    }

    return [
        { icon: "award", tier: rank === 1 ? "gold" : "bronze", seriesKey: "level", label: "经验先锋" },
        { icon: "flame", tier: rank === 1 ? "gold" : "silver", seriesKey: "streak", label: "持续探索" },
        { icon: "message_circle", tier: rank === 3 ? "bronze" : "silver", seriesKey: "social", label: "社区贡献" },
    ];
}

function PodiumBadgeStrip({ tab, rank }: { tab: LeaderboardType; rank: number }) {
    return (
        <div className="mt-4 hidden items-center justify-center gap-3 md:flex">
            {getPodiumBadges(tab, rank).map((badge) => (
                <div key={`${badge.icon}-${badge.tier}`} className="group relative" title={badge.label}>
                    <BadgeIcon icon={badge.icon} tier={badge.tier} seriesKey={badge.seriesKey} size="md" showGlow />
                </div>
            ))}
        </div>
    );
}

function RankBadge({ rank }: { rank: number }) {
    if (rank <= 3) {
        return (
            <span
                className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-xs font-black shadow-lg sm:h-9 sm:w-9 sm:text-sm",
                    RANK_STYLES[rank].badge,
                )}
            >
                {rank}
            </span>
        );
    }

    return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300 sm:h-9 sm:w-9 sm:text-sm">
            {rank}
        </span>
    );
}

function PodiumCard({
    user,
    rank,
    currentTab,
    valueLabel,
}: {
    user: LeaderboardUser | null;
    rank: number;
    currentTab: LeaderboardType;
    valueLabel: string;
}) {
    const style = RANK_STYLES[rank];
    const isChampion = rank === 1;

    return (
        <article
            className={cn(
                "relative flex min-h-[136px] flex-col items-center justify-between overflow-visible rounded-lg border px-1.5 pb-2.5 pt-5 text-center shadow-[0_26px_56px_-42px_hsl(var(--surface-shadow)/0.58)] md:min-h-[214px] md:rounded-lg md:px-4 md:pb-5 md:pt-9",
                style.card,
                isChampion && "md:-translate-y-4 md:min-h-[232px] md:pb-6 md:pt-10",
                !user && "border-dashed bg-gradient-to-br from-white via-slate-50 to-blue-50/70 opacity-95 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-blue-400/10",
            )}
        >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <RankBadge rank={rank} />
            </div>
            <div className="pointer-events-none absolute -right-4 -top-8 h-24 w-24 rounded-full bg-white/60 blur-2xl dark:bg-white/10 md:-right-8" />
            <div className="pointer-events-none absolute inset-x-5 bottom-3 h-8 rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent blur-xl dark:via-white/10" />

            {user ? (
                <>
                    <AvatarWithFrame
                        src={user.avatar}
                        fallback={user.name[0] ?? "?"}
                        avatarFrameId={user.avatarFrameId}
                        className={cn(
                            "h-10 w-10 border-2 border-white shadow-lg dark:border-slate-900 md:h-16 md:w-16 md:border-4",
                            isChampion && "h-11 w-11 md:h-20 md:w-20",
                        )}
                        avatarClassName={cn("h-10 w-10 md:h-16 md:w-16", isChampion && "h-11 w-11 md:h-20 md:w-20")}
                    />

                    <div className="mt-2 min-w-0 md:mt-4">
                        <div className={cn("truncate text-xs font-bold text-slate-950 dark:text-slate-50 md:text-base", getNameColorClassName(user.nameColorId ?? null))}>
                            {user.name}
                        </div>
                        <div className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300 md:mt-2 md:px-2.5 md:py-1 md:text-xs">
                            Lv.{user.level}
                        </div>
                    </div>

                    <div className={cn("mt-2 text-base font-black leading-none tabular-nums md:mt-4 md:text-2xl", style.value)}>
                        {user.value.toLocaleString()}
                        <span className="ml-0 block text-[10px] font-semibold leading-4 md:ml-1 md:inline md:text-sm">{valueLabel}</span>
                    </div>

                    <PodiumBadgeStrip tab={currentTab} rank={rank} />
                </>
            ) : (
                <>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-blue-200 bg-white/80 text-blue-500 shadow-sm dark:border-blue-300/25 dark:bg-white/[0.06] dark:text-blue-300 md:h-16 md:w-16">
                        {rank === 1 ? <Trophy className="h-5 w-5 md:h-7 md:w-7" /> : <UserRoundPlus className="h-5 w-5 md:h-7 md:w-7" />}
                    </div>
                    <div className="mt-2 md:mt-4">
                        <div className="text-xs font-black text-slate-700 dark:text-slate-200 md:text-base">虚位以待</div>
                        <div className="mt-2 hidden items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border/70 dark:bg-white/[0.05] md:inline-flex">
                            <LockKeyhole className="h-3.5 w-3.5" />
                            第 {rank} 名席位
                        </div>
                    </div>
                    <p className="mt-4 hidden max-w-[13rem] text-sm leading-6 text-muted-foreground md:block">
                        完成记录、挑战或互动后，就能登上这里。
                    </p>
                    <div className="mt-4 hidden h-12 w-full max-w-[9rem] rounded-t-lg border border-dashed border-blue-200/80 bg-blue-50/70 dark:border-blue-300/20 dark:bg-blue-400/10 md:block" />
                </>
            )}
        </article>
    );
}

function PodiumSkeleton() {
    return (
        <div className="grid grid-cols-3 gap-2 md:gap-4 md:items-end">
            {[1, 2, 3].map((item) => (
                <div key={item} className="h-[126px] animate-pulse rounded-lg border border-border/60 bg-muted/50 md:h-[190px] md:rounded-lg" />
            ))}
        </div>
    );
}

function LeaderboardRow({
    user,
    rank,
    valueLabel,
    currentTab,
}: {
    user: LeaderboardUser;
    rank: number;
    valueLabel: string;
    currentTab: LeaderboardType;
}) {
    const highlights = getRowHighlights(currentTab, rank);

    return (
        <div
            className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-white/[0.04] sm:grid-cols-[64px_minmax(0,1fr)_96px_132px] xl:grid-cols-[72px_minmax(220px,1fr)_112px_150px_minmax(220px,0.72fr)] xl:px-5",
                user.isCurrentUser && "bg-blue-50/90 ring-1 ring-inset ring-blue-200/80 dark:bg-blue-400/10 dark:ring-blue-300/20",
            )}
        >
            <div className="flex items-center justify-center">
                <RankBadge rank={rank} />
            </div>

            <div className="flex min-w-0 items-center gap-3 xl:gap-4">
                <AvatarWithFrame
                    src={user.avatar}
                    fallback={user.name[0] ?? "?"}
                    avatarFrameId={user.avatarFrameId}
                    className="h-11 w-11 shrink-0 border-2 border-background shadow-sm xl:h-12 xl:w-12"
                    avatarClassName="h-11 w-11 xl:h-12 xl:w-12"
                />
                <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className={cn("truncate font-semibold text-slate-950 dark:text-slate-50", getNameColorClassName(user.nameColorId ?? null))}>
                            {user.name}
                        </span>
                        {user.isCurrentUser ? (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">我</span>
                        ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 xl:hidden">
                            Lv.{user.level}
                        </span>
                        <span className="hidden sm:inline">持续探索者</span>
                    </div>
                </div>
            </div>

            <div className="hidden text-center text-xs text-muted-foreground sm:block xl:hidden">
                {highlights[0]}
            </div>

            <div className="hidden items-center justify-center xl:flex">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                    Lv.{user.level}
                </span>
            </div>

            <div className="text-right">
                <div className="text-xl font-black tabular-nums text-blue-600 dark:text-blue-300 xl:text-2xl">
                    {user.value.toLocaleString()}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{valueLabel}</div>
            </div>

            <div className="hidden min-w-0 items-center justify-end gap-2 xl:flex">
                {highlights.map((highlight, index) => (
                    <span
                        key={highlight}
                        className={cn(
                            "truncate rounded-full px-2.5 py-1 text-xs font-semibold",
                            index === 0
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
                        )}
                    >
                        {highlight}
                    </span>
                ))}
            </div>
        </div>
    );
}

function CurrentUserStrip({
    user,
    rank,
    valueLabel,
}: {
    user: LeaderboardUser;
    rank: number;
    valueLabel: string;
}) {
    return (
        <div className="mt-4 overflow-hidden rounded-md border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-[0_18px_44px_-34px_rgba(37,99,235,0.55)] dark:border-blue-300/20 dark:from-blue-400/10 dark:to-cyan-400/10">
            <div className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
                <div>
                    <div className="text-xs font-semibold text-blue-600 dark:text-blue-300">我的排名</div>
                    <div className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-200">{rank}</div>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                    <AvatarWithFrame
                        src={user.avatar}
                        fallback={user.name[0] ?? "?"}
                        avatarFrameId={user.avatarFrameId}
                        className="h-11 w-11 border-2 border-background"
                        avatarClassName="h-11 w-11"
                    />
                    <div className="min-w-0">
                        <div className={cn("truncate font-bold", getNameColorClassName(user.nameColorId ?? null))}>{user.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Lv.{user.level} · 继续完成记录可提升名次</div>
                    </div>
                </div>
                <div className="text-right text-sm font-bold tabular-nums text-blue-700 dark:text-blue-200">
                    {user.value.toLocaleString()}
                    <span className="ml-1 text-xs font-medium text-muted-foreground">{valueLabel}</span>
                </div>
            </div>
        </div>
    );
}

function LeaderboardGrowthTaskList({
    isSignedIn,
    tasks,
    growthTasksGraduatedAt,
    isLoading,
    hasError,
    claimingTaskId,
    onClaimGrowthTask,
    onReloadGrowthTasks,
}: {
    isSignedIn: boolean;
    tasks: ProfileGrowthTask[] | null;
    growthTasksGraduatedAt: string | null;
    isLoading: boolean;
    hasError: boolean;
    claimingTaskId: GrowthTaskId | null;
    onClaimGrowthTask: (taskId: GrowthTaskId) => void;
    onReloadGrowthTasks: () => void;
}) {
    if (!isSignedIn) {
        return (
            <div className="rounded-md border border-blue-100 bg-blue-50/70 p-4 text-sm dark:border-blue-300/20 dark:bg-blue-400/10">
                <div className="font-semibold text-slate-900 dark:text-slate-100">登录后查看你的新手引导进度</div>
                <p className="mt-2 leading-6 text-muted-foreground">新手引导会根据个人中心的真实项目、观察和连续探索记录同步。</p>
                <Link href="/login" className="mt-3 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
                    去登录
                    <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="space-y-2">
                        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                        <div className="h-1.5 animate-pulse rounded-full bg-muted" />
                        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                ))}
            </div>
        );
    }

    if (hasError) {
        return (
            <div className="rounded-md border border-orange-200 bg-orange-50/70 p-4 text-sm dark:border-orange-300/20 dark:bg-orange-400/10">
                <div className="font-semibold text-orange-700 dark:text-orange-300">新手引导加载失败</div>
                <p className="mt-2 leading-6 text-muted-foreground">没有展示临时数据，稍后可重新同步真实进度。</p>
                <button
                    type="button"
                    onClick={onReloadGrowthTasks}
                    className="mt-3 rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-600"
                >
                    重试
                </button>
            </div>
        );
    }

    if (growthTasksGraduatedAt) {
        return <LeaderboardGrowthGraduatedCard />;
    }

    const previewTasks = getGrowthTaskPreview(tasks ?? []);

    if (previewTasks.length === 0) {
        return <div className="rounded-md border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground dark:bg-white/[0.03]">暂无新手引导数据</div>;
    }

    return (
        <div className="space-y-4">
            {previewTasks.map((task) => {
                const isClaiming = claimingTaskId === task.id;
                return (
                    <div key={task.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2 font-medium">
                                <span className={cn("shrink-0", task.done ? "text-emerald-500" : "text-blue-500")}>
                                    {task.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                </span>
                                <span className="truncate">{task.label}</span>
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">{task.status === "claimed" ? "已领取" : task.progressLabel}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                                className={cn("h-full rounded-full", task.done ? "bg-emerald-500" : "bg-blue-500")}
                                style={{ width: `${task.progress}%` }}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-orange-500">{task.reward}</span>
                            {task.status === "claimable" ? (
                                <button
                                    type="button"
                                    disabled={isClaiming}
                                    onClick={() => onClaimGrowthTask(task.id)}
                                    className="inline-flex h-7 min-w-14 items-center justify-center rounded-full bg-blue-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                    {isClaiming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "领取"}
                                </button>
                            ) : task.status === "claimed" ? (
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">已完成</span>
                            ) : (
                                <Link href={task.href} className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
                                    去完成
                                </Link>
                            )}
                        </div>
                    </div>
                );
            })}
            <Link href="/profile" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
                查看全部任务
                <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
        </div>
    );
}

function LeaderboardSidePanel({
    isSignedIn,
    growthTasks,
    growthTasksGraduatedAt,
    growthTasksLoading,
    growthTasksError,
    claimingTaskId,
    onClaimGrowthTask,
    onReloadGrowthTasks,
}: {
    isSignedIn: boolean;
    growthTasks: ProfileGrowthTask[] | null;
    growthTasksGraduatedAt: string | null;
    growthTasksLoading: boolean;
    growthTasksError: boolean;
    claimingTaskId: GrowthTaskId | null;
    onClaimGrowthTask: (taskId: GrowthTaskId) => void;
    onReloadGrowthTasks: () => void;
}) {
    return (
        <aside className="hidden self-start lg:sticky lg:top-20 lg:block lg:space-y-5">
            <section className="surface-panel p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-bold">成长体系</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                    经验规则、等级进度和升级权益统一在成长体系中查看，排行榜按真实经验记录更新。
                </p>
                <LevelGuideDialog defaultTab="earn">
                    <button
                        type="button"
                        className="mt-4 inline-flex min-h-9 items-center rounded-full border border-blue-200 bg-blue-50/70 px-4 text-sm font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300 dark:hover:bg-blue-400/15"
                    >
                        查看成长体系
                        <ChevronRight className="ml-1 h-4 w-4" />
                    </button>
                </LevelGuideDialog>
            </section>

            <section className="surface-panel p-5 lg:p-6">
                <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <h3 className="font-bold">新手引导</h3>
                </div>
                <LeaderboardGrowthTaskList
                    isSignedIn={isSignedIn}
                    tasks={growthTasks}
                    growthTasksGraduatedAt={growthTasksGraduatedAt}
                    isLoading={growthTasksLoading}
                    hasError={growthTasksError}
                    claimingTaskId={claimingTaskId}
                    onClaimGrowthTask={onClaimGrowthTask}
                    onReloadGrowthTasks={onReloadGrowthTasks}
                />
            </section>
        </aside>
    );
}

export interface LeaderboardContentProps {
    compact?: boolean;
    className?: string;
}

export function LeaderboardContent({ compact, className }: LeaderboardContentProps) {
    const { user, refreshProfile } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentTab, setCurrentTab] = useState<LeaderboardType>("xp");
    const [xpTimeRange, setXpTimeRange] = useState<XpTimeRange>("weekly");
    const [growthTasks, setGrowthTasks] = useState<ProfileGrowthTask[] | null>(null);
    const [growthTasksGraduatedAt, setGrowthTasksGraduatedAt] = useState<string | null>(null);
    const [growthTasksLoading, setGrowthTasksLoading] = useState(false);
    const [growthTasksError, setGrowthTasksError] = useState(false);
    const [claimingTaskId, setClaimingTaskId] = useState<GrowthTaskId | null>(null);

    const loadGrowthTasks = useCallback(
        async (signal?: AbortSignal) => {
            if (!user?.id) {
                setGrowthTasks(null);
                setGrowthTasksGraduatedAt(null);
                setGrowthTasksLoading(false);
                setGrowthTasksError(false);
                return;
            }

            try {
                setGrowthTasksLoading(true);
                setGrowthTasksError(false);

                const response = await fetch("/api/profile/growth-tasks/sync", {
                    method: "POST",
                    signal,
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || "新手引导加载失败");
                }
                if (signal?.aborted) return;
                setGrowthTasks((payload?.tasks as ProfileGrowthTask[] | undefined) || []);
                const nextGraduatedAt =
                    typeof payload?.graduatedAt === "string" && payload.graduatedAt ? payload.graduatedAt : null;
                setGrowthTasksGraduatedAt(nextGraduatedAt);
            } catch (error) {
                if ((error as { name?: string }).name === "AbortError") return;
                logger.warn("Failed to load leaderboard growth tasks", { error });
                setGrowthTasks([]);
                setGrowthTasksGraduatedAt(null);
                setGrowthTasksError(true);
            } finally {
                if (!signal?.aborted) {
                    setGrowthTasksLoading(false);
                }
            }
        },
        [user?.id],
    );

    const handleClaimGrowthTask = useCallback(
        async (taskId: GrowthTaskId) => {
            if (!user?.id || claimingTaskId) return;

            setClaimingTaskId(taskId);
            try {
                const response = await fetch("/api/profile/growth-tasks/claim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ taskId }),
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || "领取失败");
                }

                await refreshProfile();
                await loadGrowthTasks();

                if (payload?.graduated) {
                    return;
                }

                if (payload?.alreadyClaimed) {
                    toast({ title: "奖励已领取" });
                    return;
                }

                toast({
                    title: "领取成功",
                    description: payload?.taskLabel
                        ? `已领取「${payload.taskLabel}」奖励，+${Number(payload?.xpGranted || 0)} 经验`
                        : `已领取 +${Number(payload?.xpGranted || 0)} 经验`,
                });
            } catch (error) {
                toast({
                    title: "领取失败",
                    description: error instanceof Error ? error.message : "请稍后重试",
                    variant: "destructive",
                });
            } finally {
                setClaimingTaskId(null);
            }
        },
        [claimingTaskId, loadGrowthTasks, refreshProfile, toast, user?.id],
    );

    useEffect(() => {
        const controller = new AbortController();
        void loadGrowthTasks(controller.signal);
        return () => controller.abort();
    }, [loadGrowthTasks]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchLeaderboard = async () => {
            try {
                setIsLoading(true);
                setLeaderboardData([]);

                const params = new URLSearchParams({
                    type: currentTab,
                    range: xpTimeRange,
                    limit: "20",
                });
                const response = await fetch(`/api/leaderboard?${params.toString()}`, {
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                const data = await response.json();
                const users = (data?.users as LeaderboardUser[] | undefined) || [];
                setLeaderboardData(
                    users.map((row) => ({
                        ...row,
                        isCurrentUser: row.isCurrentUser ?? user?.id === row.id,
                    })),
                );
            } catch (error) {
                if ((error as { name?: string }).name === "AbortError") return;
                logger.error("Error fetching leaderboard", { error });
                setLeaderboardData([]);
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        void fetchLeaderboard();
        return () => controller.abort();
    }, [user, currentTab, xpTimeRange]);

    const config = getTabConfig(currentTab);
    const podiumUsers = useMemo(() => {
        const top = leaderboardData.slice(0, 3);
        return PODIUM_ORDER.map((rank) => ({ user: top[rank - 1] ?? null, rank }));
    }, [leaderboardData]);
    const listUsers = leaderboardData.slice(3);
    const currentUserIndex = leaderboardData.findIndex((row) => row.isCurrentUser);
    const currentUser = currentUserIndex >= 0 ? leaderboardData[currentUserIndex] : null;
    const valueColumnLabel = getValueColumnLabel(currentTab, xpTimeRange);

    return (
        <div className={cn("grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]", className)}>
            <section className="min-w-0">
                <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as LeaderboardType)} className="w-full">
                    <div className="surface-panel p-2.5 sm:p-4 lg:p-5">
                        <div className="flex flex-col gap-2.5 sm:gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <TabsList className={cn("grid h-auto w-full grid-cols-4 rounded-lg bg-muted/60 p-1 dark:bg-white/[0.04] sm:max-w-[560px] sm:rounded-md xl:max-w-[600px]", compact && "mb-0")}>
                                {LEADERBOARD_TABS.map((tab) => {
                                    const tabConfig = getTabConfig(tab);
                                    return (
                                        <TabsTrigger
                                            key={tab}
                                            value={tab}
                                            className="min-h-10 rounded-sm px-1.5 text-[11px] font-semibold text-muted-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-[0_10px_26px_-18px_rgba(37,99,235,0.9)] sm:min-h-11 sm:px-3 sm:text-sm"
                                        >
                                            <span className="mr-1.5 hidden sm:inline-flex">{tabConfig.icon}</span>
                                            {tabConfig.label}
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
                                {currentTab === "xp" ? (
                                    <div className="inline-grid w-full grid-cols-3 rounded-full border border-border/70 bg-background/70 p-1 text-sm shadow-sm dark:bg-white/[0.03] sm:w-auto" role="group" aria-label="经验时间范围">
                                        {(["weekly", "monthly", "alltime"] as const).map((range) => (
                                            <button
                                                key={range}
                                                type="button"
                                                onClick={() => setXpTimeRange(range)}
                                                className={cn(
                                                    "min-h-8 rounded-full px-3 font-semibold text-muted-foreground transition-colors hover:text-foreground sm:min-h-9 sm:px-4",
                                                    xpTimeRange === range && "bg-blue-600 text-white shadow-sm hover:text-white",
                                                )}
                                            >
                                                {XP_TIME_RANGE_LABEL[range]}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="inline-flex min-h-10 items-center self-start rounded-full border border-border/70 bg-background/70 px-3 text-sm font-semibold text-muted-foreground shadow-sm dark:bg-white/[0.03] sm:min-h-11 sm:px-4">
                                        按已通过记录统计
                                    </div>
                                )}
                                <div className="hidden min-h-8 items-center self-start rounded-full bg-blue-50/80 px-3 text-[11px] font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300 sm:inline-flex sm:min-h-11 sm:px-4 sm:text-xs">
                                    榜单数据按记录更新
                                </div>
                            </div>
                        </div>

                        <div className="hidden border-t border-border/60 sm:mt-4 sm:block sm:pt-4">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                                    <span className="text-blue-600 dark:text-blue-300">{config.icon}</span>
                                    {config.label}
                                </h2>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{config.description}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 md:mt-5">
                        {isLoading ? (
                            <PodiumSkeleton />
                        ) : (
                            <div className="grid grid-cols-3 gap-2 md:gap-4 md:items-end xl:gap-5">
                                {podiumUsers.map((item) => (
                                    <PodiumCard
                                        key={item.user?.id ?? `vacant-${item.rank}`}
                                        user={item.user}
                                        rank={item.rank}
                                        currentTab={currentTab}
                                        valueLabel={config.valueLabel}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="surface-panel mt-5 overflow-hidden">
                        <div className="hidden grid-cols-[64px_minmax(0,1fr)_96px_132px] border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground sm:grid xl:grid-cols-[72px_minmax(220px,1fr)_112px_150px_minmax(220px,0.72fr)] xl:px-5">
                            <span className="text-center">排名</span>
                            <span>用户</span>
                            <span className="text-center xl:hidden">状态</span>
                            <span className="hidden text-center xl:block">等级</span>
                            <span className="text-right">{valueColumnLabel}</span>
                            <span className="hidden text-right xl:block">代表表现</span>
                        </div>
                        {isLoading ? (
                            <div className="space-y-2 p-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <LeaderboardItemSkeleton key={i} />
                                ))}
                            </div>
                        ) : listUsers.length > 0 ? (
                            listUsers.map((row, index) => (
                                <LeaderboardRow key={row.id} user={row} rank={index + 4} valueLabel={config.valueLabel} currentTab={currentTab} />
                            ))
                        ) : leaderboardData.length > 0 ? (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">前 3 名之后暂无更多用户</div>
                        ) : (
                            <div className="px-6 py-10 text-center text-sm text-muted-foreground">暂无排行榜数据</div>
                        )}
                    </div>

                    {currentUser && currentUserIndex > 2 ? (
                        <CurrentUserStrip user={currentUser} rank={currentUserIndex + 1} valueLabel={config.valueLabel} />
                    ) : null}

                </Tabs>
            </section>

            <LeaderboardSidePanel
                isSignedIn={Boolean(user?.id)}
                growthTasks={growthTasks}
                growthTasksGraduatedAt={growthTasksGraduatedAt}
                growthTasksLoading={growthTasksLoading}
                growthTasksError={growthTasksError}
                claimingTaskId={claimingTaskId}
                onClaimGrowthTask={handleClaimGrowthTask}
                onReloadGrowthTasks={() => {
                    void loadGrowthTasks();
                }}
            />
        </div>
    );
}
