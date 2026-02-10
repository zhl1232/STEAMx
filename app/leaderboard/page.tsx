"use client";

import { useGamification } from "@/context/gamification-context";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, Star, Award, Hammer } from "lucide-react";
import { LeaderboardItemSkeleton } from "@/components/ui/leaderboard-skeleton";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVirtualizer } from "@tanstack/react-virtual";

interface LeaderboardUser {
    id: string;
    name: string;
    xp: number;
    level: number;
    value: number; // 通用的数值字段（XP/徽章数/项目数）
    avatar: string | null | undefined;
    isCurrentUser?: boolean;
}

type LeaderboardType = "xp" | "badges" | "projects";

const ROW_HEIGHT = 72;
const LIST_MAX_HEIGHT = 480;

function LeaderboardVirtualList({
    users,
    getRankIcon,
    valueLabel,
}: {
    users: LeaderboardUser[];
    getRankIcon: (index: number) => React.ReactNode;
    valueLabel: string;
}) {
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: users.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 5,
    });

    return (
        <div
            ref={parentRef}
            className="overflow-auto rounded-lg"
            style={{ maxHeight: LIST_MAX_HEIGHT }}
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
                            className="py-1"
                        >
                            <div
                                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${user.isCurrentUser ? "bg-primary/5 border-primary/50" : "bg-card hover:bg-accent/50"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center justify-center w-8">
                                        {getRankIcon(index)}
                                    </div>
                                    <Avatar className="h-10 w-10 border-2 border-background">
                                        <AvatarImage src={user.avatar || undefined} />
                                        <AvatarFallback>{user.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-semibold flex items-center gap-2">
                                            {user.name}
                                            {user.isCurrentUser && <Badge variant="secondary" className="text-xs">你</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            Lv.{user.level}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-primary">{user.value.toLocaleString()}</div>
                                    <div className="text-xs text-muted-foreground">{valueLabel}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function LeaderboardPage() {
    const { user, profile } = useAuth();
    const { xp, level } = useGamification();
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentTab, setCurrentTab] = useState<LeaderboardType>("xp");
    const supabase = createClient();

    // 获取真实排行榜数据
    useEffect(() => {
        const fetchLeaderboard = async () => {
            setIsLoading(true);
            setLeaderboardData([]);

            try {
                let users: LeaderboardUser[] = [];

                if (currentTab === "xp") {
                    // 1. 积分榜 (原有逻辑)
                    const { data: topProfiles, error } = await supabase
                        .from('profiles')
                        .select('id, display_name, avatar_url, xp')
                        .order('xp', { ascending: false })
                        .limit(20);

                    if (error) throw error;

                    interface ProfileRow {
                        id: string;
                        display_name: string | null;
                        avatar_url: string | null;
                        xp: number | null;
                    }

                    users = ((topProfiles as unknown as ProfileRow[]) || []).map(p => ({
                        id: p.id,
                        name: p.display_name || '匿名用户',
                        xp: p.xp || 0,
                        level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                        value: p.xp || 0,
                        avatar: p.avatar_url,
                        isCurrentUser: user?.id === p.id
                    }));

                    // 如果当前用户不在 Top 20，且已登录，添加到列表底部用于展示（可选）
                    // 为了简化，这里遵循原逻辑，尝试把当前用户加入比较
                    if (user && !users.some(u => u.id === user.id)) {
                        users.push({
                            id: user.id,
                            name: profile?.display_name || '我',
                            xp,
                            level,
                            value: xp,
                            avatar: profile?.avatar_url,
                            isCurrentUser: true
                        });
                    }
                    // 再次排序
                    users.sort((a, b) => b.value - a.value);

                } else if (currentTab === "badges") {
                    // 2. 徽章榜 (调用 RPC)
                    const { data, error } = await supabase.rpc('get_badge_leaderboard', { limit_count: 20 } as never);

                    if (error) throw error;

                    interface BadgeLeaderboardItem {
                        id: string;
                        display_name: string | null;
                        xp: number;
                        badge_count: number;
                        avatar_url: string | null;
                    }

                    users = ((data as unknown as BadgeLeaderboardItem[]) || []).map((p) => ({
                        id: p.id,
                        name: p.display_name || '匿名用户',
                        xp: p.xp || 0,
                        level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                        value: Number(p.badge_count || 0),
                        avatar: p.avatar_url,
                        isCurrentUser: user?.id === p.id
                    }));

                    // 当前用户逻辑（如果不在榜单中，需要单独查询徽章数，这里暂时简化，若不在榜则不显示或显示0）
                    // 如果当前用户在榜单中，标记一下
                } else if (currentTab === "projects") {
                    // 3. 实干榜 (调用 RPC)
                    const { data, error } = await supabase.rpc('get_project_leaderboard', { limit_count: 20 } as never);

                    if (error) throw error;

                    interface ProjectLeaderboardItem {
                        id: string;
                        display_name: string | null;
                        xp: number;
                        project_count: number;
                        avatar_url: string | null;
                    }

                    users = ((data as unknown as ProjectLeaderboardItem[]) || []).map((p) => ({
                        id: p.id,
                        name: p.display_name || '匿名用户',
                        xp: p.xp || 0,
                        level: Math.floor(Math.sqrt((p.xp || 0) / 100)) + 1,
                        value: Number(p.project_count || 0),
                        avatar: p.avatar_url,
                        isCurrentUser: user?.id === p.id
                    }));
                }

                setLeaderboardData(users);
            } catch (error) {
                console.error('Error fetching leaderboard:', error);
                setLeaderboardData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user, profile, xp, level, currentTab, supabase]);

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

    const config = getTabConfig(currentTab);

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600">
                    <Trophy className="h-8 w-8" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">社区排行榜</h1>
                    <p className="text-muted-foreground">
                        看看谁是 STEAM 社区最活跃的探索者！
                    </p>
                </div>
            </div>

            <Tabs defaultValue="xp" className="w-full" onValueChange={(v) => setCurrentTab(v as LeaderboardType)}>
                <TabsList className="grid w-full grid-cols-3 mb-8">
                    <TabsTrigger value="xp" className="flex items-center justify-center">
                        <Star className="w-4 h-4 mr-2 text-yellow-500" />
                        积分榜
                    </TabsTrigger>
                    <TabsTrigger value="badges" className="flex items-center justify-center">
                        <Award className="w-4 h-4 mr-2 text-purple-500" />
                        徽章榜
                    </TabsTrigger>
                    <TabsTrigger value="projects" className="flex items-center justify-center">
                        <Hammer className="w-4 h-4 mr-2 text-blue-500" />
                        实干榜
                    </TabsTrigger>
                </TabsList>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            {config.icon}
                            {config.label}
                        </CardTitle>
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
                                <div className="text-center py-8 text-muted-foreground">
                                    暂无排行榜数据
                                </div>
                            ) : (
                                <LeaderboardVirtualList
                                    users={leaderboardData}
                                    getRankIcon={getRankIcon}
                                    valueLabel={config.valueLabel}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
