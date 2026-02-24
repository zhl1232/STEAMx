"use client";

import { useGamification } from "@/context/gamification-context";
import { useAuth } from "@/context/auth-context";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Medal, Crown, Star, Award, Hammer, Calendar } from "lucide-react";
import { LeaderboardItemSkeleton } from "@/components/ui/leaderboard-skeleton";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getWeekStartISO, getMonthStartISO } from "@/lib/date-utils";
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

/** 单行高度：轻量行 py-3 + 内容约 56px */
const ROW_HEIGHT = 80;

function LeaderboardVirtualList({
    users,
    getRankIcon,
    valueLabel,
    maxHeight = 480,
}: {
    users: LeaderboardUser[];
    getRankIcon: (index: number) => React.ReactNode;
    valueLabel: string;
    maxHeight?: number;
}) {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: users.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });

    const totalSize = virtualizer.getTotalSize();
    const contentFits = totalSize <= maxHeight;

    return (
        <div
            ref={parentRef}
            className={`rounded-xl ${contentFits ? "overflow-visible" : "overflow-auto"}`}
            style={{ maxHeight: contentFits ? undefined : maxHeight }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const user = users[virtualRow.index];
                    const index = virtualRow.index;
                    return (
                        <div
                            key={user.id}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="py-1.5"
                        >
                            <div
                                className={`flex items-center justify-between gap-3 py-3 px-4 border-b border-border/30 rounded-lg transition-colors ${
                                    user.isCurrentUser
                                        ? "bg-primary/5"
                                        : "hover:bg-muted/40"
                                }`}
                            >
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                    <div className="flex items-center justify-center w-8 shrink-0">
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
                                        <div className="font-semibold flex items-center gap-2 flex-wrap">
                                            <span className={cn("truncate", getNameColorClassName(user.nameColorId ?? null))}>{user.name}</span>
                                            {user.isCurrentUser && (
                                                <span className="shrink-0 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-medium text-white">
                                                    你
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-0.5">
                                            Lv.{user.level}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-lg sm:text-xl font-bold text-primary tabular-nums">
                                        {user.value.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                                        {valueLabel}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export interface LeaderboardContentProps {
    /** 紧凑模式：不显示大标题，列表高度适配嵌入（如移动端 Tab 下） */
    compact?: boolean;
    /** 列表最大高度（紧凑模式下可传更小或更大） */
    listMaxHeight?: number;
    className?: string;
}

export function LeaderboardContent({ compact, listMaxHeight = 480, className }: LeaderboardContentProps) {
    const { user, profile } = useAuth();
    const { xp, level } = useGamification();
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentTab, setCurrentTab] = useState<LeaderboardType>("xp");
    const [xpTimeRange, setXpTimeRange] = useState<XpTimeRange>("alltime");
    const supabase = createClient();

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            setLeaderboardData([]);

            // 辅助：批量补全 avatarFrameId
            const fillAvatarFrameIds = async (users: LeaderboardUser[]) => {
                const ids = users.filter(u => !u.avatarFrameId).map(u => u.id);
                if (ids.length === 0) return users;
                const { data } = await supabase
                    .from('profiles')
                    .select('id, equipped_avatar_frame_id')
                    .in('id', ids);
                if (!data) return users;
                const map = new Map((data as { id: string; equipped_avatar_frame_id: string | null }[]).map(p => [p.id, p.equipped_avatar_frame_id]));
                return users.map(u => ({ ...u, avatarFrameId: u.avatarFrameId || map.get(u.id) || undefined }));
            };

            try {
                let users: LeaderboardUser[] = [];

                if (currentTab === "xp") {
                    if (xpTimeRange === "weekly") {
                        const { data, error } = await supabase.rpc("get_leaderboard_xp_weekly", { limit_count: 20 } as never);
                        if (error) throw error;
                        const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number }[]) || [];
                        users = rows.map((p) => ({
                            id: p.id,
                            name: p.display_name || "匿名用户",
                            xp: Number(p.xp) || 0,
                            level: Math.floor(Math.sqrt(Number(p.xp || 0) / 100)) + 1,
                            value: Number(p.xp) || 0,
                            avatar: p.avatar_url,
                            isCurrentUser: user?.id === p.id
                        }));
                    } else if (xpTimeRange === "monthly") {
                        const { data, error } = await supabase.rpc("get_leaderboard_xp_monthly", { limit_count: 20 } as never);
                        if (error) throw error;
                        const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number }[]) || [];
                        users = rows.map((p) => ({
                            id: p.id,
                            name: p.display_name || "匿名用户",
                            xp: Number(p.xp) || 0,
                            level: Math.floor(Math.sqrt(Number(p.xp || 0) / 100)) + 1,
                            value: Number(p.xp) || 0,
                            avatar: p.avatar_url,
                            isCurrentUser: user?.id === p.id
                        }));
                    } else {
                        const { data: topProfiles, error } = await supabase
                            .from("profiles")
                            .select("id, display_name, avatar_url, xp, equipped_avatar_frame_id")
                            .order("xp", { ascending: false })
                            .limit(20);
                        if (error) throw error;
                        const rows = (topProfiles as { id: string; display_name: string | null; avatar_url: string | null; xp: number | null; equipped_avatar_frame_id?: string | null }[]) || [];
                        users = rows.map((p) => ({
                            id: p.id,
                            name: p.display_name || "匿名用户",
                            xp: p.xp || 0,
                            level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                            value: p.xp || 0,
                            avatar: p.avatar_url,
                            avatarFrameId: p.equipped_avatar_frame_id ?? undefined,
                            isCurrentUser: user?.id === p.id
                        }));
                    }

                    if (user && !users.some((u) => u.id === user.id)) {
                        let myValue = xp;
                        if (xpTimeRange === "weekly" || xpTimeRange === "monthly") {
                            const since = xpTimeRange === "weekly" ? getWeekStartISO() : getMonthStartISO();
                            const { data: myLogs } = await supabase
                                .from("xp_logs")
                                .select("xp_amount")
                                .eq("user_id", user.id)
                                .gte("created_at", since);
                            myValue = (myLogs as { xp_amount: number }[] || []).reduce((s, r) => s + (r.xp_amount || 0), 0);
                        }
                        users.push({
                            id: user.id,
                            name: profile?.display_name || "我",
                            xp: myValue,
                            level: Math.floor(Math.sqrt(myValue / 100)) + 1,
                            value: myValue,
                            avatar: profile?.avatar_url,
                            avatarFrameId: (profile as { equipped_avatar_frame_id?: string | null } | null)?.equipped_avatar_frame_id ?? undefined,
                            isCurrentUser: true
                        });
                        users.sort((a, b) => b.value - a.value);
                    }

                } else if (currentTab === "badges") {
                    const { data, error } = await supabase.rpc("get_badge_leaderboard", { limit_count: 20 } as never);
                    if (error) throw error;
                    const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number; badge_count: number }[]) || [];
                    users = rows.map((p) => ({
                        id: p.id,
                        name: p.display_name || "匿名用户",
                        xp: p.xp || 0,
                        level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                        value: Number(p.badge_count || 0),
                        avatar: p.avatar_url,
                        isCurrentUser: user?.id === p.id
                    }));
                } else if (currentTab === "projects") {
                    const { data, error } = await supabase.rpc("get_project_leaderboard", { limit_count: 20 } as never);
                    if (error) throw error;
                    const rows = (data as { id: string; display_name: string | null; avatar_url: string | null; xp: number; project_count: number }[]) || [];
                    users = rows.map((p) => ({
                        id: p.id,
                        name: p.display_name || "匿名用户",
                        xp: p.xp || 0,
                        level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                        value: Number(p.project_count || 0),
                        avatar: p.avatar_url,
                        isCurrentUser: user?.id === p.id
                    }));
                }

                setLeaderboardData(await fillAvatarFrameIds(users));
            } catch (error) {
                console.error("Error fetching leaderboard:", error);
                setLeaderboardData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user, profile, xp, level, currentTab, xpTimeRange, supabase]);

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
                <TabsList className={compact ? "grid w-full grid-cols-3 mb-4 h-10" : "grid w-full grid-cols-3 mb-8"}>
                    <TabsTrigger value="xp" className="flex items-center justify-center text-xs sm:text-sm">
                        <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-yellow-500" />
                        积分榜
                    </TabsTrigger>
                    <TabsTrigger value="badges" className="flex items-center justify-center text-xs sm:text-sm">
                        <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-purple-500" />
                        徽章榜
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="flex items-center justify-center text-xs sm:text-sm">
                        <Hammer className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-blue-500" />
                        实干榜
                    </TabsTrigger>
                </TabsList>

                <Card className="rounded-xl border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className={compact ? "pb-2" : undefined}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <CardTitle className="flex items-center text-base sm:text-lg font-semibold">
                                {config.icon}
                                {config.label}
                            </CardTitle>
                            {currentTab === "xp" && (
                                <div className="inline-flex rounded-lg bg-muted/60 p-0.5" role="group" aria-label="积分时间范围">
                                    {(["weekly", "monthly", "alltime"] as const).map((range) => (
                                        <button
                                            key={range}
                                            type="button"
                                            onClick={() => setXpTimeRange(range)}
                                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                                                xpTimeRange === range
                                                    ? "bg-background text-foreground shadow-sm"
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
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {isLoading ? (
                                <>
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <LeaderboardItemSkeleton key={i} />
                                    ))}
                                </>
                            ) : leaderboardData.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    暂无排行榜数据
                                </div>
                            ) : (
                                <LeaderboardVirtualList
                                    users={leaderboardData}
                                    getRankIcon={getRankIcon}
                                    valueLabel={config.valueLabel}
                                    maxHeight={listMaxHeight}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
