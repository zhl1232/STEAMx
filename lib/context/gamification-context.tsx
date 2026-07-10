"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { AchievementToast } from "@/components/features/gamification/achievement-toast";
import { showBadgeUnlockOverlay } from "@/components/features/gamification/badge-unlock-overlay";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from '@/lib/context/auth-context';
import { logger } from "@/lib/logger";

import { BADGES } from "@/lib/gamification/badges";

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
    userStats?: UserStats;
    addXp: (amount: number, reason?: string, actionType?: string, resourceId?: string | number) => void;
    checkBadges: (stats: UserStats) => void;
    refetchStats: () => void;
    nextLevelXp: number;
    progress: number;
    levelTotalNeeded: number;
    levelProgress: number;
}

const GamificationContext = createContext<GamificationContextType | undefined>(undefined);

function isMissingBadgeDefinitionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
        return false
    }

    const candidate = error as {
        code?: string
        message?: string
        details?: string
        hint?: string
        cause?: unknown
        error?: unknown
    }

    const combined = `${candidate.message ?? ''} ${candidate.details ?? ''} ${candidate.hint ?? ''}`.toLowerCase()
    if (candidate.code === '23503' && combined.includes('user_badges_badge_id_fkey')) {
        return true
    }

    return (
        combined.includes('user_badges_badge_id_fkey') ||
        isMissingBadgeDefinitionError(candidate.cause) ||
        isMissingBadgeDefinitionError(candidate.error)
    )
}

export function GamificationProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const { user, profile } = useAuth();
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

            if (xpToAward === 0) return;
            amount = xpToAward;

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
                logger.error('Error logging XP:', { error: logError });
                return;
            }
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
    // Track badge definitions that are missing from DB to avoid spamming retries in one session
    const unavailableBadgesRef = useRef(new Set<string>());

    useEffect(() => {
        unlockedBadgesRef.current = unlockedBadges;
    }, [unlockedBadges]);

    const checkBadges = useCallback((stats: UserStats) => {
        if (!user) return;

        // Use the ref value to avoid recreating this function when badges change
        const processing = processingBadgesRef.current;
        const unavailable = unavailableBadgesRef.current;

        BADGES.forEach((badge) => {
            const currentUnlocked = unlockedBadgesRef.current;
            if (!currentUnlocked.has(badge.id) && !processing.has(badge.id) && !unavailable.has(badge.id)) {
                try {
                    if (badge.condition(stats)) {
                        // Mark as processing immediately
                        processing.add(badge.id);

                        // Optimistically mark as unlocked locally immediately
                        // to prevent multiple fire/infinite loops while mutation is pending
                        const updated = new Set(unlockedBadgesRef.current);
                        updated.add(badge.id);
                        unlockedBadgesRef.current = updated;

                        // Trigger Mutation
                        unlockBadgeMutation.mutate(badge.id, {
                            onSuccess: (result) => {
                                processing.delete(badge.id); // Clear processing flag
                                if (!result.inserted) {
                                    return;
                                }

                                showBadgeUnlockOverlay(badge);
                            },
                            onError: (error: unknown) => {
                                processing.delete(badge.id); // Clear processing flag
                                if (isMissingBadgeDefinitionError(error)) {
                                    unavailable.add(badge.id)
                                    logger.warn(`Badge definition missing in database: ${badge.id}`, {
                                        context: `Skipping unlock for badge ${badge.id}`,
                                    })
                                } else {
                                    logger.error(error, { context: `Failed to unlock badge ${badge.id}` });
                                }
                                const rolledBack = new Set(unlockedBadgesRef.current);
                                rolledBack.delete(badge.id);
                                unlockedBadgesRef.current = rolledBack;
                            }
                        });
                    }
                } catch (err) {
                    logger.error(err, { context: `Error checking badge ${badge.id}` });
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

    const contextValue = useMemo(() => ({
        xp,
        coins,
        level,
        unlockedBadges,
        userBadgeDetails,
        userStats,
        addXp,
        checkBadges,
        refetchStats,
        nextLevelXp,
        progress,
        levelTotalNeeded,
        levelProgress
    }), [xp, coins, level, unlockedBadges, userBadgeDetails, userStats, addXp, checkBadges, refetchStats, nextLevelXp, progress, levelTotalNeeded, levelProgress]);

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
