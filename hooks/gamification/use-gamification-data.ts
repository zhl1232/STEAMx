"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserStats } from "@/lib/gamification/types";
import { useAuth } from '@/lib/context/auth-context';

// 稳定的默认值，避免每次渲染创建新对象
const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, { unlockedAt: string }>();

function isDuplicateWriteError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }

    const candidate = error as {
        code?: string;
        status?: number;
        message?: string;
        details?: string;
        cause?: unknown;
        error?: unknown;
    };

    if (candidate.code === "23505" || candidate.status === 409) {
        return true;
    }

    const message = `${candidate.message ?? ""} ${candidate.details ?? ""}`.toLowerCase();
    if (message.includes("duplicate key") || message.includes("already exists") || message.includes("conflict")) {
        return true;
    }

    return isDuplicateWriteError(candidate.cause) || isDuplicateWriteError(candidate.error);
}

function getErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== "object") {
        return undefined;
    }

    const candidate = error as {
        code?: string;
        cause?: unknown;
        error?: unknown;
    };

    return candidate.code || getErrorCode(candidate.cause) || getErrorCode(candidate.error);
}

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
                // 游乐场徽章由 /api/playground/badges/sync 从 playground_stats 云端战绩补发。
                minesweeperWins: 0,
                minesweeperExpertWins: 0,
                minesweeperBestTime: 999,
                sortingRuns: 0,
                sortingAlgorithmsUsed: 0,
                // 鸟类观察统计
                observationsSubmitted: stats.observationsSubmitted || 0,
                speciesObserved: stats.speciesObserved || 0,
                observationStreak: stats.observationStreak || 0,
                growthTasksGraduated: stats.growthTasksGraduated === true,
            };
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 minutes cache for heavy stats
    });

    // Mutations
    const updateXpMutation = useMutation({
        mutationFn: async (amount: number) => {
            const res = await fetch('/api/xp/increment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to increment XP');
            }
        },
        onSuccess: () => {
            void refreshProfile();
        }
    });

    const unlockBadgeMutation = useMutation({
        mutationFn: async (badgeId: string) => {
            const unlockedAt = new Date().toISOString();
            const readExistingBadge = async () => {
                const { data: existingBadge, error: existingBadgeError } = await supabase
                    .from('user_badges')
                    .select('badge_id, unlocked_at')
                    .eq('user_id', user!.id)
                    .eq('badge_id', badgeId)
                    .maybeSingle();

                if (existingBadgeError) {
                    throw existingBadgeError;
                }

                return {
                    exists: !!existingBadge,
                    inserted: false,
                    unlockedAt: existingBadge?.unlocked_at ?? unlockedAt,
                };
            };

            try {
                const existingBadge = await readExistingBadge();
                if (existingBadge.exists) {
                    return existingBadge;
                }

                const { data, error } = await supabase
                    .from('user_badges')
                    .upsert({
                        user_id: user!.id,
                        badge_id: badgeId,
                        unlocked_at: unlockedAt
                    } as never, {
                        onConflict: 'user_id,badge_id',
                        ignoreDuplicates: true,
                    })
                    .select('badge_id, unlocked_at')
                    .maybeSingle();

                if (error) {
                    if (isDuplicateWriteError(error)) {
                        return readExistingBadge();
                    }

                    throw error;
                }

                if (data?.unlocked_at) {
                    return {
                        inserted: true,
                        unlockedAt: data.unlocked_at,
                    };
                }

                return readExistingBadge();
            } catch (error) {
                if (isDuplicateWriteError(error)) {
                    return readExistingBadge();
                }

                throw error;
            }
        },
        onSuccess: (result, badgeId) => {
            // 不使用 invalidateQueries（会导致重新 fetch → Set 引用变化 → checkBadges 再次执行 → 循环）
            // 改为直接更新缓存，将新 badge 合并进已有数据；即使 DB 已存在该 badge，也同步到本地缓存
            queryClient.setQueryData(
                ['gamification', 'badges', user?.id],
                (old: { set: Set<string>; map: Map<string, { unlockedAt: string }> } | undefined) => {
                    const newSet = new Set(old?.set ?? []);
                    const newMap = new Map(old?.map ?? []);
                    newSet.add(badgeId);
                    newMap.set(badgeId, { unlockedAt: result.unlockedAt });
                    return { set: newSet, map: newMap };
                }
            );
        },
        retry: (failureCount, error) => {
            if (isDuplicateWriteError(error)) {
                return false;
            }

            const errorCode = getErrorCode(error);
            if (errorCode === '23505') {
                return false;
            }

            return failureCount < 2;
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
