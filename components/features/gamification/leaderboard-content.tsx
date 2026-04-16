"use client";

import { useAuth } from '@/lib/context/auth-context';
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Medal, Crown, Star, Award, Hammer, Calendar } from "lucide-react";
import { LeaderboardItemSkeleton } from "@/components/ui/leaderboard-skeleton";
import { useState, useEffect } from "react";
import { getNameColorClassName } from "@/lib/shop/items";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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

function LeaderboardList({
    users,
    getRankIcon,
    valueLabel,
}: {
    users: LeaderboardUser[];
    getRankIcon: (index: number) => React.ReactNode;
    valueLabel: string;
}) {
    return (
        <div className="rounded-xl">
            <div className="space-y-2">
                {users.map((user, index) => (
                    <div key={user.id} className="py-1.5">
                        <div
                            className={cn(
                                "flex items-start justify-between gap-3 rounded-xl border border-border/45 px-4 py-3 transition-colors",
                                user.isCurrentUser ? "bg-primary/6 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]" : "hover:bg-muted/35",
                            )}
                        >
                            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                                <div className="flex w-8 shrink-0 items-center justify-center pt-1">
                                    {getRankIcon(index)}
                                </div>
                                <AvatarWithFrame
                                    src={user.avatar}
                                    fallback={user.name[0]}
                                    avatarFrameId={user.avatarFrameId}
                                    className="h-10 w-10 shrink-0 border-2 border-background shadow-sm ring-1 ring-border/50"
                                    avatarClassName="h-10 w-10"
                                />
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                                        <span className={cn("break-words", getNameColorClassName(user.nameColorId ?? null))}>{user.name}</span>
                                        {user.isCurrentUser ? (
                                            <span className="shrink-0 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-medium text-white">
                                                你
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-0.5 text-sm text-muted-foreground">Lv.{user.level}</div>
                                </div>
                            </div>
                            <div className="shrink-0 pt-0.5 text-right">
                                <div className="text-lg font-bold tabular-nums text-primary sm:text-xl">
                                    {user.value.toLocaleString()}
                                </div>
                                <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                                    {valueLabel}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export interface LeaderboardContentProps {
    /** 紧凑模式：不显示大标题，列表高度适配嵌入（如移动端 Tab 下） */
    compact?: boolean;
    className?: string;
}

export function LeaderboardContent({
    compact,
    className,
}: LeaderboardContentProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentTab, setCurrentTab] = useState<LeaderboardType>("xp");
    const [xpTimeRange, setXpTimeRange] = useState<XpTimeRange>("alltime");

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
                setLeaderboardData(users.map((row) => ({
                    ...row,
                    isCurrentUser: row.isCurrentUser ?? (user?.id === row.id),
                })));
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

    const getRankIcon = (index: number) => {
        switch (index) {
            case 0: return <Crown className="h-6 w-6 text-yellow-500" />;
            case 1: return <Medal className="h-6 w-6 text-gray-400" />;
            case 2: return <Medal className="h-6 w-6 text-amber-600" />;
            default: return <span className="text-lg font-bold text-muted-foreground w-6 text-center">{index + 1}</span>;
        }
    };

    const getTabConfig = (tab: LeaderboardType) => {
        switch (tab) {
            case "xp": return { label: "积分榜", icon: <Star className="w-4 h-4 mr-2" />, valueLabel: "XP" };
            case "badges": return { label: "徽章榜", icon: <Award className="w-4 h-4 mr-2" />, valueLabel: "枚徽章" };
            case "projects": return { label: "实干榜", icon: <Hammer className="w-4 h-4 mr-2" />, valueLabel: "个项目" };
        }
    };

    const xpTimeRangeLabel: Record<XpTimeRange, string> = { weekly: "本周", monthly: "本月", alltime: "总榜" };
    const config = getTabConfig(currentTab);

    return (
        <div className={className}>
            <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as LeaderboardType)} className="w-full">
                <TabsList className={cn("segmented-control grid h-auto w-full grid-cols-3 rounded-full bg-transparent p-1", compact ? "mb-4" : "mb-8")}>
                    <TabsTrigger value="xp" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm flex items-center justify-center text-xs sm:text-sm">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-yellow-500" />
                        积分榜
                    </TabsTrigger>
                    <TabsTrigger value="badges" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm flex items-center justify-center text-xs sm:text-sm">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-purple-500" />
                        徽章榜
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm flex items-center justify-center text-xs sm:text-sm">
                        <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-blue-500" />
                        实干榜
                    </TabsTrigger>
                </TabsList>

                <section className="surface-subtle overflow-hidden p-5 sm:p-6">
                    <div className={cn("flex flex-wrap items-center justify-between gap-3", compact ? "mb-4" : "mb-6")}>
                        <h3 className="flex items-center text-base font-semibold sm:text-lg">
                                {config.icon}
                                {config.label}
                        </h3>
                        {currentTab === "xp" && (
                            <div className="segmented-control" role="group" aria-label="积分时间范围">
                                    {(["weekly", "monthly", "alltime"] as const).map((range) => (
                                        <button
                                            key={range}
                                            type="button"
                                            onClick={() => setXpTimeRange(range)}
                                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                                                xpTimeRange === range
                                                    ? "bg-foreground text-background shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {range === "weekly" && <Calendar className="h-3.5 w-3.5" />}
                                            {xpTimeRangeLabel[range]}
                                        </button>
                                    ))}
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        {isLoading ? (
                            <>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <LeaderboardItemSkeleton key={i} />
                                ))}
                            </>
                        ) : leaderboardData.length === 0 ? (
                            <div className="surface-subtle px-6 py-8 text-center text-sm text-muted-foreground">
                                暂无排行榜数据
                            </div>
                        ) : (
                            <LeaderboardList
                                users={leaderboardData}
                                getRankIcon={getRankIcon}
                                valueLabel={config.valueLabel}
                            />
                        )}
                    </div>
                </section>
            </Tabs>
        </div>
    );
}
