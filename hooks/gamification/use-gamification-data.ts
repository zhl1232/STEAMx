"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserStats } from "@/lib/gamification/types";
import { useAuth } from "@/context/auth-context";

// 稳定的默认值，避免每次渲染创建新对象
const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, { unlockedAt: string }>();

export function useGamificationData() {
    const { user, profile, refreshProfile } = useAuth();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const enabled = !!user;

    // 1. Use XP from Auth Context (already fetched)
    const xp = profile?.xp || 0;

    // 2. Fetch Unlocked Badges with Timestamp
    const { data: badgeData, isFetched: badgesLoaded } = useQuery({
        queryKey: ['gamification', 'badges', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('user_badges')
                .select('badge_id, unlocked_at')
                .eq('user_id', user!.id);

            const badgesMap = new Map<string, { unlockedAt: string }>();
            const badgesSet = new Set<string>();

            data?.forEach((b: { badge_id: string; unlocked_at: string }) => {
                badgesSet.add(b.badge_id);
                badgesMap.set(b.badge_id, { unlockedAt: b.unlocked_at });
            });

            return { set: badgesSet, map: badgesMap };
        },
        enabled,
        staleTime: 1000 * 60 * 30, // 30 minutes
    });

    // 使用 ref 缓存上一次的 Set/Map 实例，只有内容变化时才更新引用，避免下游 effect 不必要地重新触发
    const prevBadgesRef = useRef<{ set: Set<string>; map: Map<string, { unlockedAt: string }> }>({ set: EMPTY_SET, map: EMPTY_MAP });

    const { unlockedBadges, userBadgeDetails } = useMemo(() => {
        if (!badgeData) return { unlockedBadges: prevBadgesRef.current.set, userBadgeDetails: prevBadgesRef.current.map };

        const prev = prevBadgesRef.current;
        const newSet = badgeData.set;
        const newMap = badgeData.map;

        // 内容相同则复用旧引用
        const sameSet = prev.set.size === newSet.size && [...newSet].every(id => prev.set.has(id));
        const sameMap = prev.map.size === newMap.size && [...newMap.keys()].every(id => prev.map.has(id));

        const stableSet = sameSet ? prev.set : newSet;
        const stableMap = sameMap ? prev.map : newMap;

        prevBadgesRef.current = { set: stableSet, map: stableMap };
        return { unlockedBadges: stableSet, userBadgeDetails: stableMap };
    }, [badgeData]);

    // 3. Fetch Full User Stats (Expensive, calculate strictly when needed or for periodic checks)
    const { data: userStats } = useQuery({
        queryKey: ['gamification', 'stats', user?.id],
        queryFn: async (): Promise<UserStats> => {
            // Efficiently fetch all stats using the dedicated RPC
            const { data, error } = await supabase.rpc('get_user_stats_summary', {
                target_user_id: user!.id
            } as never);

            if (error) throw error;

            // Map the RPC result to our UserStats interface
            const stats = data as Partial<UserStats>;

            // Calculate current level based on XP from profile (already fetched in step 1) or pass it in
            const currentLevel = Math.floor(Math.sqrt((xp || 0) / 100)) + 1;

            return {
                projectsPublished: stats.projectsPublished || 0,
                projectsLiked: stats.projectsLiked || 0,
                projectsCompleted: stats.projectsCompleted || 0,
                commentsCount: stats.commentsCount || 0,
                scienceCompleted: stats.scienceCompleted || 0,
                techCompleted: stats.techCompleted || 0,
                engineeringCompleted: stats.engineeringCompleted || 0,
                artCompleted: stats.artCompleted || 0,
                mathCompleted: stats.mathCompleted || 0,
                likesGiven: stats.likesGiven || 0,
                likesReceived: stats.likesReceived || 0,
                collectionsCount: stats.collectionsCount || 0,
                challengesJoined: stats.challengesJoined || 0,
                level: currentLevel,
                loginDays: stats.loginDays || 0,
                consecutiveDays: stats.consecutiveDays || 0,
                discussionsCreated: stats.discussionsCreated || 0,
                repliesCount: stats.repliesCount || 0,
                // 扫雷属于纯前端 localStorage 状态，服务端统计不存在，一律给默认值
                minesweeperWins: 0,
                minesweeperExpertWins: 0,
                minesweeperBestTime: 999,
            };
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 minutes cache for heavy stats
    });

    // Mutations
    const updateXpMutation = useMutation({
        mutationFn: async (amount: number) => {
            const { error } = await supabase.rpc('increment_client_xp', {
                amount: amount
            } as never);
            if (error) throw error;
        },
        onSuccess: () => {
            refreshProfile();
        }
    });

    const unlockBadgeMutation = useMutation({
        mutationFn: async (badgeId: string) => {
            // 使用 upsert + ignoreDuplicates 避免 badge 已存在时返回 409
            const { error } = await supabase
                .from('user_badges')
                .upsert({
                    user_id: user!.id,
                    badge_id: badgeId,
                    unlocked_at: new Date().toISOString()
                } as never, {
                    onConflict: 'user_id,badge_id',
                    ignoreDuplicates: true
                });
            if (error) throw error;
        },
        onSuccess: (_data, badgeId) => {
            // 不使用 invalidateQueries（会导致重新 fetch → Set 引用变化 → checkBadges 再次执行 → 循环）
            // 改为直接更新缓存，将新 badge 合并进已有数据
            queryClient.setQueryData(
                ['gamification', 'badges', user?.id],
                (old: { set: Set<string>; map: Map<string, { unlockedAt: string }> } | undefined) => {
                    if (!old) return old;
                    const newSet = new Set(old.set);
                    const newMap = new Map(old.map);
                    newSet.add(badgeId);
                    newMap.set(badgeId, { unlockedAt: new Date().toISOString() });
                    return { set: newSet, map: newMap };
                }
            );
        }
    });

    return {
        xp,
        unlockedBadges,
        userBadgeDetails,
        badgesLoaded,
        userStats,
        updateXpMutation,
        unlockBadgeMutation,
        refetchStats: useCallback(() => queryClient.invalidateQueries({ queryKey: ['gamification', 'stats', user?.id] }), [queryClient, user?.id])
    };
}
