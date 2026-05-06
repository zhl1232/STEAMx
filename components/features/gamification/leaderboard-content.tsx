"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Award,
    BookOpenCheck,
    Calendar,
    ChevronRight,
    Flame,
    Hammer,
    LockKeyhole,
    ShieldCheck,
    Star,
    Target,
    ThumbsUp,
    Trophy,
    UserRoundPlus,
} from "lucide-react";

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { LeaderboardItemSkeleton } from "@/components/ui/leaderboard-skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/context/auth-context";
import type { BadgeTier } from "@/lib/gamification/types";
import { logger } from "@/lib/logger";
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

export type LeaderboardType = "xp" | "badges" | "projects";
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

function getTabConfig(tab: LeaderboardType): LeaderboardConfig {
    switch (tab) {
        case "xp":
            return {
                label: "积分榜",
                icon: <Star className="h-4 w-4" />,
                valueLabel: "积分",
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
    }
}

function getPodiumBadges(tab: LeaderboardType, rank: number): Array<{ icon: string; tier: BadgeTier; label: string }> {
    if (tab === "badges") {
        return [
            { icon: "award", tier: rank === 1 ? "gold" : "silver", label: "成就里程碑" },
            { icon: "sparkles", tier: "gold", label: "成长之星" },
            { icon: "shield_star", tier: rank === 3 ? "bronze" : "silver", label: "荣誉守护" },
        ];
    }

    if (tab === "projects") {
        return [
            { icon: "trophy", tier: rank === 1 ? "gold" : "bronze", label: "工程挑战优胜" },
            { icon: "blueprint", tier: "silver", label: "实践达人" },
            { icon: "target", tier: rank === 1 ? "gold" : "bronze", label: "目标达成" },
        ];
    }

    return [
        { icon: "trophy", tier: rank === 1 ? "gold" : "bronze", label: "积分先锋" },
        { icon: "flame", tier: rank === 1 ? "gold" : "silver", label: "持续探索" },
        { icon: "message_circle", tier: rank === 3 ? "bronze" : "silver", label: "社区贡献" },
    ];
}

function PodiumBadgeStrip({ tab, rank }: { tab: LeaderboardType; rank: number }) {
    return (
        <div className="mt-4 flex items-center justify-center gap-3">
            {getPodiumBadges(tab, rank).map((badge) => (
                <div key={`${badge.icon}-${badge.tier}`} className="group relative" title={badge.label}>
                    <BadgeIcon icon={badge.icon} tier={badge.tier} size="md" showGlow />
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
                    "inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-black shadow-lg",
                    RANK_STYLES[rank].badge,
                )}
            >
                {rank}
            </span>
        );
    }

    return (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-white/[0.08] dark:text-slate-300">
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
                "relative flex min-h-[214px] flex-col items-center justify-between overflow-visible rounded-[22px] border px-4 pb-5 pt-9 text-center shadow-[0_26px_56px_-42px_hsl(var(--surface-shadow)/0.58)]",
                style.card,
                isChampion && "md:-translate-y-4 md:min-h-[232px] md:pb-6 md:pt-10",
                !user && "border-dashed bg-gradient-to-br from-white via-slate-50 to-blue-50/70 opacity-95 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-blue-400/10",
            )}
        >
            <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <RankBadge rank={rank} />
            </div>
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/60 blur-2xl dark:bg-white/10" />
            <div className="pointer-events-none absolute inset-x-5 bottom-3 h-8 rounded-[999px] bg-gradient-to-r from-transparent via-white/70 to-transparent blur-xl dark:via-white/10" />

            {user ? (
                <>
                    <AvatarWithFrame
                        src={user.avatar}
                        fallback={user.name[0] ?? "?"}
                        avatarFrameId={user.avatarFrameId}
                        className={cn(
                            "h-16 w-16 border-4 border-white shadow-lg dark:border-slate-900",
                            isChampion && "h-20 w-20",
                        )}
                        avatarClassName={cn("h-16 w-16", isChampion && "h-20 w-20")}
                    />

                    <div className="mt-4 min-w-0">
                        <div className={cn("truncate text-base font-bold text-slate-950 dark:text-slate-50", getNameColorClassName(user.nameColorId ?? null))}>
                            {user.name}
                        </div>
                        <div className="mt-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-400/10 dark:text-blue-300">
                            Lv.{user.level}
                        </div>
                    </div>

                    <div className={cn("mt-4 text-2xl font-black tabular-nums", style.value)}>
                        {user.value.toLocaleString()}
                        <span className="ml-1 text-sm font-semibold">{valueLabel}</span>
                    </div>

                    <PodiumBadgeStrip tab={currentTab} rank={rank} />
                </>
            ) : (
                <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-blue-200 bg-white/80 text-blue-500 shadow-sm dark:border-blue-300/25 dark:bg-white/[0.06] dark:text-blue-300">
                        {rank === 1 ? <Trophy className="h-7 w-7" /> : <UserRoundPlus className="h-7 w-7" />}
                    </div>
                    <div className="mt-4">
                        <div className="text-base font-black text-slate-700 dark:text-slate-200">虚位以待</div>
                        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-inset ring-border/70 dark:bg-white/[0.05]">
                            <LockKeyhole className="h-3.5 w-3.5" />
                            第 {rank} 名席位
                        </div>
                    </div>
                    <p className="mt-4 max-w-[13rem] text-sm leading-6 text-muted-foreground">
                        完成记录、挑战或互动后，就能登上这里。
                    </p>
                    <div className="mt-4 h-12 w-full max-w-[9rem] rounded-t-[18px] border border-dashed border-blue-200/80 bg-blue-50/70 dark:border-blue-300/20 dark:bg-blue-400/10" />
                </>
            )}
        </article>
    );
}

function PodiumSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
            {[1, 2, 3].map((item) => (
                <div key={item} className="h-[190px] animate-pulse rounded-[22px] border border-border/60 bg-muted/50" />
            ))}
        </div>
    );
}

function LeaderboardRow({
    user,
    rank,
    valueLabel,
}: {
    user: LeaderboardUser;
    rank: number;
    valueLabel: string;
}) {
    return (
        <div
            className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border/50 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-blue-50/50 dark:hover:bg-white/[0.04] sm:grid-cols-[64px_minmax(0,1fr)_96px_132px]",
                user.isCurrentUser && "bg-blue-50/90 ring-1 ring-inset ring-blue-200/80 dark:bg-blue-400/10 dark:ring-blue-300/20",
            )}
        >
            <div className="flex items-center justify-center">
                <RankBadge rank={rank} />
            </div>

            <div className="flex min-w-0 items-center gap-3">
                <AvatarWithFrame
                    src={user.avatar}
                    fallback={user.name[0] ?? "?"}
                    avatarFrameId={user.avatarFrameId}
                    className="h-11 w-11 shrink-0 border-2 border-background shadow-sm"
                    avatarClassName="h-11 w-11"
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
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                            Lv.{user.level}
                        </span>
                        <span className="hidden sm:inline">持续探索者</span>
                    </div>
                </div>
            </div>

            <div className="hidden text-center text-xs text-muted-foreground sm:block">
                {rank <= 10 ? "代表成就" : "稳步成长"}
            </div>

            <div className="text-right">
                <div className="text-xl font-black tabular-nums text-blue-600 dark:text-blue-300">
                    {user.value.toLocaleString()}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{valueLabel}</div>
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
        <div className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-[0_18px_44px_-34px_rgba(37,99,235,0.55)] dark:border-blue-300/20 dark:from-blue-400/10 dark:to-cyan-400/10">
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

function LeaderboardSidePanel() {
    const rules = [
        { icon: BookOpenCheck, label: "作品通过审核", value: "+50 ~ 300 积分" },
        { icon: Target, label: "完成官方挑战", value: "+50 ~ 500 积分" },
        { icon: ThumbsUp, label: "获得认可", value: "+1 ~ 20 积分" },
    ];
    const tasks = [
        { label: "发布 1 个观察记录", progress: "1/1", value: "+80 积分", done: true },
        { label: "完成 1 个挑战任务", progress: "0/1", value: "+120 积分", done: false },
        { label: "帮助 3 位新手", progress: "2/3", value: "+60 积分", done: false },
    ];

    return (
        <aside className="hidden space-y-5 lg:block">
            <section className="surface-panel p-5">
                <div className="mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-bold">排行榜规则</h3>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">作品通过审核、完成挑战、收到认可都可获得积分。</p>
                <div className="mt-4 space-y-3">
                    {rules.map((rule) => {
                        const Icon = rule.icon;
                        return (
                            <div key={rule.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm dark:bg-white/[0.03]">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Icon className="h-4 w-4 text-blue-500" />
                                    {rule.label}
                                </span>
                                <span className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-300">{rule.value}</span>
                            </div>
                        );
                    })}
                </div>
                <Link href="/community" className="mt-4 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300">
                    查看完整规则
                    <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
            </section>

            <section className="surface-panel p-5">
                <div className="mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <h3 className="font-bold">本周任务</h3>
                </div>
                <div className="space-y-4">
                    {tasks.map((task) => (
                        <div key={task.label} className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex min-w-0 items-center gap-2 font-medium">
                                    <span className={cn("h-2.5 w-2.5 rounded-full", task.done ? "bg-emerald-500" : "bg-blue-500")} />
                                    <span className="truncate">{task.label}</span>
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">{task.progress}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full rounded-full", task.done ? "w-full bg-emerald-500" : "w-2/3 bg-blue-500")} />
                            </div>
                            <div className="text-right text-xs font-semibold text-orange-500">{task.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="surface-panel overflow-hidden p-5">
                <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <h3 className="font-bold">积分小贴士</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">坚持记录和互相帮助，积分会稳步提升。</p>
                <div className="mt-5 flex h-24 items-end gap-2">
                    {[32, 48, 68, 92].map((height, index) => (
                        <div key={height} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className="w-full rounded-t-xl bg-gradient-to-t from-blue-500 to-cyan-300 shadow-[0_10px_22px_-14px_rgba(37,99,235,0.8)]"
                                style={{ height }}
                            />
                            <span className="text-[10px] text-muted-foreground">W{index + 1}</span>
                        </div>
                    ))}
                </div>
            </section>
        </aside>
    );
}

export interface LeaderboardContentProps {
    compact?: boolean;
    className?: string;
}

export function LeaderboardContent({ compact, className }: LeaderboardContentProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentTab, setCurrentTab] = useState<LeaderboardType>("xp");
    const [xpTimeRange, setXpTimeRange] = useState<XpTimeRange>("weekly");

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

        fetchLeaderboard();
        return () => controller.abort();
    }, [user, currentTab, xpTimeRange]);

    const config = getTabConfig(currentTab);
    const xpTimeRangeLabel: Record<XpTimeRange, string> = { weekly: "本周", monthly: "本月", alltime: "总榜" };
    const podiumUsers = useMemo(() => {
        const top = leaderboardData.slice(0, 3);
        return PODIUM_ORDER.map((rank) => ({ user: top[rank - 1] ?? null, rank }));
    }, [leaderboardData]);
    const listUsers = leaderboardData.slice(3);
    const currentUserIndex = leaderboardData.findIndex((row) => row.isCurrentUser);
    const currentUser = currentUserIndex >= 0 ? leaderboardData[currentUserIndex] : null;

    return (
        <div className={cn("grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]", className)}>
            <section className="min-w-0">
                <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as LeaderboardType)} className="w-full">
                    <div className="surface-panel p-3 sm:p-4">
                        <TabsList className={cn("grid h-auto w-full grid-cols-3 rounded-2xl bg-muted/60 p-1 dark:bg-white/[0.04]", compact && "mb-0")}>
                            {(["xp", "badges", "projects"] as const).map((tab) => {
                                const tabConfig = getTabConfig(tab);
                                return (
                                    <TabsTrigger
                                        key={tab}
                                        value={tab}
                                        className="min-h-11 rounded-xl text-sm font-semibold text-muted-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-[0_10px_26px_-18px_rgba(37,99,235,0.9)]"
                                    >
                                        <span className="mr-1.5 hidden sm:inline-flex">{tabConfig.icon}</span>
                                        {tabConfig.label}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-lg font-bold">
                                    <span className="text-blue-600 dark:text-blue-300">{config.icon}</span>
                                    {config.label}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
                            </div>

                            {currentTab === "xp" ? (
                                <div className="inline-grid grid-cols-3 rounded-full border border-border/70 bg-background/70 p-1 text-sm shadow-sm dark:bg-white/[0.03]" role="group" aria-label="积分时间范围">
                                    {(["weekly", "monthly", "alltime"] as const).map((range) => (
                                        <button
                                            key={range}
                                            type="button"
                                            onClick={() => setXpTimeRange(range)}
                                            className={cn(
                                                "min-h-9 rounded-full px-4 font-semibold text-muted-foreground transition-colors hover:text-foreground",
                                                xpTimeRange === range && "bg-blue-600 text-white shadow-sm hover:text-white",
                                            )}
                                        >
                                            {xpTimeRangeLabel[range]}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="mt-5">
                        {isLoading ? (
                            <PodiumSkeleton />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-3 md:items-end">
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
                        <div className="hidden grid-cols-[64px_minmax(0,1fr)_96px_132px] border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground sm:grid">
                            <span className="text-center">排名</span>
                            <span>用户</span>
                            <span className="text-center">状态</span>
                            <span className="text-right">{config.label}</span>
                        </div>
                        {isLoading ? (
                            <div className="space-y-2 p-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <LeaderboardItemSkeleton key={i} />
                                ))}
                            </div>
                        ) : listUsers.length > 0 ? (
                            listUsers.map((row, index) => (
                                <LeaderboardRow key={row.id} user={row} rank={index + 4} valueLabel={config.valueLabel} />
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

                    <section className="surface-panel mt-5 flex items-center justify-between gap-4 p-4 lg:hidden">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                                <Trophy className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-bold">完成观察记录可获得积分</h3>
                                <p className="mt-1 text-sm text-muted-foreground">发布高质量记录、获得互动都会提升排名。</p>
                            </div>
                        </div>
                        <Link href="/nature/submit" className="hidden shrink-0 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm sm:inline-flex">
                            去观察
                        </Link>
                    </section>
                </Tabs>
            </section>

            <LeaderboardSidePanel />
        </div>
    );
}
