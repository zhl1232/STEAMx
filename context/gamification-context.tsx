"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AchievementToast } from "@/components/features/gamification/achievement-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";

import { BADGES } from "@/lib/gamification/badges";

interface CheckInResult {
    streak: number;
    total_days: number;
    checked_in_today: boolean;
    is_new_day: boolean;
    xp_granted: number;
    coins_granted: number;
    error?: string;
}
import { UserStats, Badge } from "@/lib/gamification/types";
import { useGamificationData } from "@/hooks/gamification/use-gamification-data";

export type { UserStats, Badge };
export { BADGES };

interface GamificationContextType {
    xp: number;
    coins: number;
    level: number;
    unlockedBadges: Set<string>;
    userBadgeDetails: Map<string, { unlockedAt: string }>;
    addXp: (amount: number, reason?: string, actionType?: string, resourceId?: string | number) => void;
    checkBadges: (stats: UserStats) => void;
    nextLevelXp: number;
    progress: number;
    levelTotalNeeded: number;
    levelProgress: number;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { user, profile, refreshProfile } = useAuth();
    const [supabase] = useState(() => createClient());

    // Use our new hook to manage data fetching
    const {
        xp,
        unlockedBadges,
        userBadgeDetails,
        badgesLoaded,
        userStats,
        updateXpMutation,
        unlockBadgeMutation,
        refetchStats
    } = useGamificationData();

    const coins = profile?.coins ?? 0;

    // 1. Level Calculation
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentLevelBaseXp = 100 * Math.pow(level - 1, 2);
    const nextLevelXp = 100 * Math.pow(level, 2);
    const levelProgress = xp - currentLevelBaseXp;
    const levelTotalNeeded = nextLevelXp - currentLevelBaseXp;
    const progress = (levelProgress / levelTotalNeeded) * 100;

    // 2. Add XP Logic (Business Logic)
    const addXp = useCallback(async (amount: number, reason?: string, actionType?: string, resourceId?: string | number) => {
        if (!user) return;

        const DAILY_XP_LIMITS: Record<string, number> = {
            'reply_discussion': 50,
            'comment_project': 50
        };

        // Anti-farming & Daily Limit Logic
        if (actionType && resourceId) {
            const rId = String(resourceId);

            // Check existence
            const { data: existing } = await supabase
                .from('xp_logs')
                .select('id')
                .eq('user_id', user.id)
                .eq('action_type', actionType)
                .eq('resource_id', rId)
                .maybeSingle();

            if (existing) {
                return;
            }

            // Check Daily Limit
            let xpToAward = amount;
            if (DAILY_XP_LIMITS[actionType]) {
                const today = new Date().toISOString().split('T')[0];
                const { data: todayLogs } = await supabase
                    .from('xp_logs')
                    .select('xp_amount')
                    .eq('user_id', user.id)
                    .eq('action_type', actionType)
                    .gte('created_at', today);

                const todayTotal = (todayLogs as { xp_amount: number }[] || []).reduce((acc, log) => acc + log.xp_amount, 0);

                if (todayTotal >= DAILY_XP_LIMITS[actionType]) {
                    xpToAward = 0;
                } else if (todayTotal + amount > DAILY_XP_LIMITS[actionType]) {
                    xpToAward = Math.max(0, DAILY_XP_LIMITS[actionType] - todayTotal);
                }
            }

            // Insert Log
            const { error: logError } = await supabase
                .from('xp_logs')
                .insert({
                    user_id: user.id,
                    action_type: actionType,
                    resource_id: rId,
                    xp_amount: xpToAward
                } as never);

            if (logError) {
                console.error('Error logging XP:', logError);
                return;
            }

            if (xpToAward === 0) return;
            amount = xpToAward;
        }

        const newXp = xp + amount;

        // Optimistic check for level up
        const oldLevel = Math.floor(Math.sqrt(xp / 100)) + 1;
        const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

        if (newLevel > oldLevel) {
            toast({
                description: (
                    <AchievementToast
                        title="升级啦！"
                        description={`恭喜你达到了等级 ${newLevel}！`}
                        icon="🎉"
                    />
                ),
                duration: 5000,
            });

            // Trigger confetti
            import('canvas-confetti').then((confetti) => {
                confetti.default({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 }
                });
            });
        }

        // Commit via mutation (now expects the increment amount, not absolute newXp)
        updateXpMutation.mutate(amount);

        // If action implies a stat change (not just passive XP), refresh stats to trigger badge checks
        if (actionType && !['daily_login', 'visit'].includes(actionType)) {
            refetchStats();
        }
    }, [user, xp, supabase, toast, updateXpMutation, refetchStats]);

    // 3. Check Badges Logic
    // Use Ref to break dependency cycle and prevent infinite loops when badges are unlocked
    const unlockedBadgesRef = useRef(unlockedBadges);
    // Track badges currently being processed to prevent duplicate requests/loops
    const processingBadgesRef = useRef(new Set<string>());

    useEffect(() => {
        unlockedBadgesRef.current = unlockedBadges;
    }, [unlockedBadges]);

    const checkBadges = useCallback((stats: UserStats) => {
        if (!user) return;

        // Use the ref value to avoid recreating this function when badges change
        const currentUnlocked = unlockedBadgesRef.current;
        const processing = processingBadgesRef.current;

        BADGES.forEach((badge) => {
            if (!currentUnlocked.has(badge.id) && !processing.has(badge.id)) {
                try {
                    if (badge.condition(stats)) {
                        // Mark as processing immediately
                        processing.add(badge.id);

                        // CRITICAL FIX: Optimistically mark as unlocked locally immediately 
                        // to prevent multiple fire/infinite loops while mutation is pending
                        currentUnlocked.add(badge.id);
                        unlockedBadgesRef.current = new Set(currentUnlocked);

                        // Trigger Mutation
                        unlockBadgeMutation.mutate(badge.id, {
                            onSuccess: () => {
                                processing.delete(badge.id); // Clear processing flag
                                toast({
                                    description: (
                                        <AchievementToast
                                            title="解锁新徽章！"
                                            description={`恭喜你获得了 "${badge.name}" 徽章`} // Fixed wording
                                            icon={badge.icon}
                                            tier={badge.tier}
                                        />
                                    ),
                                    duration: 5000,
                                });
                                // Trigger confetti
                                import('canvas-confetti').then((confetti) => {
                                    confetti.default({
                                        particleCount: 100,
                                        spread: 70,
                                        origin: { y: 0.6 }
                                    });
                                });
                            },
                            onError: (error: unknown) => {
                                processing.delete(badge.id); // Clear processing flag
                                // upsert + ignoreDuplicates 不会报 409，此处仅处理真正的网络错误
                                console.error(`Failed to unlock badge ${badge.id}`, error);
                                currentUnlocked.delete(badge.id);
                                unlockedBadgesRef.current = new Set(currentUnlocked);
                            }
                        });
                    }
                } catch (err) {
                    console.error(`Error checking badge ${badge.id}`, err);
                    processing.delete(badge.id);
                }
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- user intentionally excluded to avoid unnecessary callback churn
    }, [user?.id, unlockBadgeMutation, toast]);

    // 4. Auto-Run Checks on Stats Update
    // 仅在 badges 已从 DB 加载后才执行 checkBadges，避免在空 Set 上误判
    useEffect(() => {
        if (userStats && badgesLoaded) {
            checkBadges(userStats);
        }
    }, [userStats, badgesLoaded, checkBadges]);

    // 5. Daily Check-in Side Effect
    const hasCheckedIn = useRef(false);

    useEffect(() => {
        if (!user || hasCheckedIn.current) return;

        const performCheckIn = async () => {
            hasCheckedIn.current = true; // Mark as checked in immediately

            try {
                // Call RPC to record check-in (DB returns jsonb: streak, total_days, checked_in_today, is_new_day)
                const { data, error } = await supabase.rpc('daily_check_in') as { data: CheckInResult | null; error: { code: string; message: string } | null };

                if (error) {
                    // 23505 是 PostgreSQL 的 unique_violation 错误码
                    // 23503 是外键缺失（profile 不存在）
                    if (error.code === '23503' && user) {
                        try {
                            const displayName = user.user_metadata?.full_name || user.user_metadata?.name || (user.phone ? user.phone.replace(/^\+86/, '') : null)
                            const avatarUrl = user.user_metadata?.avatar_url || '/avatars/default-1.svg'
                            await supabase
                                .from('profiles')
                                .upsert(
                                    { id: user.id, display_name: displayName, avatar_url: avatarUrl },
                                    { onConflict: 'id', ignoreDuplicates: true }
                                )

                            const { data: retryData, error: retryError } = await supabase.rpc('daily_check_in') as { data: CheckInResult | null; error: { code: string; message: string } | null };
                            if (!retryError && retryData?.is_new_day) {
                                refetchStats();
                                await refreshProfile();
                                queryClient.invalidateQueries({ queryKey: ['coin_logs'] });

                                const streak = retryData.streak ?? 1;
                                const xpGranted = retryData.xp_granted ?? 0;
                                const coinsGranted = retryData.coins_granted ?? 0;
                                toast({
                                    description: (
                                        <AchievementToast
                                            title="每日登录奖励"
                                            description={`+${xpGranted} XP · +${coinsGranted} 硬币${streak > 1 ? ` · 连续 ${streak} 天 🔥` : ''}`}
                                            icon="📅"
                                        />
                                    ),
                                    duration: 4000,
                                });
                            } else if (retryError && retryError.code !== '23505') {
                                console.error('Check-in error:', retryError);
                            }
                        } catch (retryErr) {
                            console.error('Check-in failed after profile recovery:', retryErr);
                        }
                        return;
                    }
                    if (error.code !== '23505') {
                        console.error('Check-in error:', error);
                    }
                    return;
                }

                // 今天已打卡（is_new_day = false），无需刷新，直接返回
                if (!data?.is_new_day) return;

                // 新一天打卡：XP 与硬币已由服务端在同一事务内发放，刷新本地状态
                refetchStats();
                await refreshProfile();
                queryClient.invalidateQueries({ queryKey: ['coin_logs'] });

                // 显示打卡成功 Toast
                const streak = data.streak ?? 1;
                const xpGranted = data.xp_granted ?? 0;
                const coinsGranted = data.coins_granted ?? 0;
                toast({
                    description: (
                        <AchievementToast
                            title="每日登录奖励"
                            description={`+${xpGranted} XP · +${coinsGranted} 硬币${streak > 1 ? ` · 连续 ${streak} 天 🔥` : ''}`}
                            icon="📅"
                        />
                    ),
                    duration: 4000,
                });
            } catch (err) {
                console.error('Check-in failed:', err);
            }
        };

        performCheckIn();
        // We only want to run this once per session/mount effectively, or when user changes
    }, [user, supabase, refetchStats, refreshProfile, queryClient, toast]);

    const contextValue = useMemo(() => ({
        xp,
        coins,
        level,
        unlockedBadges,
        userBadgeDetails,
        addXp,
        checkBadges,
        nextLevelXp,
        progress,
        levelTotalNeeded,
        levelProgress
    }), [xp, coins, level, unlockedBadges, userBadgeDetails, addXp, checkBadges, nextLevelXp, progress, levelTotalNeeded, levelProgress]);

    return (
        <GamificationContext.Provider value={contextValue}>
            {children}
        </GamificationContext.Provider>
    );
}

export function useGamification() {
    const context = useContext(GamificationContext);
    if (context === undefined) {
        throw new Error("useGamification must be used within a GamificationProvider");
    }
    return context;
}
