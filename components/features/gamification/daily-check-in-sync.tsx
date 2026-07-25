"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { AchievementToast } from "@/components/features/gamification/achievement-toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { useGamification } from "@/lib/context/gamification-context";
import type { UserStats } from "@/lib/gamification/types";
import { logger } from "@/lib/logger";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { createDefaultDisplayName } from "@/lib/auth/default-display-name";
import { createClient } from "@/lib/supabase/client";

interface CheckInResult {
    streak?: number;
    total_days?: number;
    checked_in_today?: boolean;
    is_new_day?: boolean;
    xp_granted?: number;
    coins_granted?: number;
}

interface RpcError {
    code: string;
    message: string;
}

const CHECK_IN_RETRY_BASE_DELAY_MS = 1_500;
const CHECK_IN_MAX_RETRY_ATTEMPTS = 3;

function buildLoginBadgeStats(result: CheckInResult, currentStats?: UserStats): UserStats | null {
    if (typeof result.streak !== "number") return null;

    const fallbackStats: UserStats = {
        projectsPublished: 0,
        projectsLiked: 0,
        projectsCompleted: 0,
        commentsCount: 0,
        scienceCompleted: 0,
        techCompleted: 0,
        engineeringCompleted: 0,
        artCompleted: 0,
        mathCompleted: 0,
        likesGiven: 0,
        likesReceived: 0,
        collectionsCount: 0,
        challengesJoined: 0,
        level: 1,
        loginDays: 0,
        consecutiveDays: 0,
        discussionsCreated: 0,
        repliesCount: 0,
        minesweeperWins: 0,
        minesweeperExpertWins: 0,
        minesweeperBestTime: 999,
        observationsSubmitted: 0,
        speciesObserved: 0,
        observationStreak: 0,
        growthTasksGraduated: false,
    };

    const baseStats = currentStats ?? fallbackStats;

    return {
        ...baseStats,
        consecutiveDays: Math.max(baseStats.consecutiveDays, result.streak),
        loginDays: Math.max(baseStats.loginDays, result.total_days ?? baseStats.loginDays),
    };
}

export function DailyCheckInSync() {
    const { user, refreshProfile } = useAuth();
    const { checkBadges, userStats } = useGamification();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const supabase = useMemo(() => createClient(), []);
    const checkedUserIdsRef = useRef(new Set<string>());
    const inFlightUserIdsRef = useRef(new Set<string>());
    const retryAttemptsRef = useRef(new Map<string, number>());
    const retryTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const [retryTick, setRetryTick] = useState(0);

    useEffect(() => {
        const retryTimers = retryTimersRef.current;
        return () => {
            retryTimers.forEach((timer) => clearTimeout(timer));
            retryTimers.clear();
        };
    }, []);

    useEffect(() => {
        if (!user || checkedUserIdsRef.current.has(user.id) || inFlightUserIdsRef.current.has(user.id)) return;

        const userId = user.id;

        const clearRetryTimer = () => {
            const timer = retryTimersRef.current.get(userId);
            if (timer) {
                clearTimeout(timer);
                retryTimersRef.current.delete(userId);
            }
        };

        const markCheckInHandled = () => {
            checkedUserIdsRef.current.add(userId);
            retryAttemptsRef.current.delete(userId);
            clearRetryTimer();
        };

        const scheduleRetry = () => {
            if (checkedUserIdsRef.current.has(userId) || retryTimersRef.current.has(userId)) return;

            const currentAttempts = retryAttemptsRef.current.get(userId) ?? 0;
            if (currentAttempts >= CHECK_IN_MAX_RETRY_ATTEMPTS) return;

            const nextAttempts = currentAttempts + 1;
            retryAttemptsRef.current.set(userId, nextAttempts);

            const timer = setTimeout(() => {
                retryTimersRef.current.delete(userId);
                setRetryTick((tick) => tick + 1);
            }, CHECK_IN_RETRY_BASE_DELAY_MS * nextAttempts);

            retryTimersRef.current.set(userId, timer);
        };

        const showCheckInToast = (result: CheckInResult) => {
            const streak = result.streak ?? 1;
            const xpGranted = result.xp_granted ?? 0;
            const coinsGranted = result.coins_granted ?? 0;

            toast({
                description: (
                    <AchievementToast
                        title="每日登录奖励"
                        description={`+${xpGranted} XP · +${coinsGranted} 硬币${streak > 1 ? ` · 连续 ${streak} 天 🔥` : ""}`}
                        icon="📅"
                    />
                ),
                duration: 4000,
            });
        };

        const refreshRewardState = async () => {
            await refreshProfile();
            void queryClient.invalidateQueries({ queryKey: ["coin_logs"] });
            void queryClient.invalidateQueries({ queryKey: ["gamification", "stats", user.id] });
        };

        const checkLoginStreakBadges = (result: CheckInResult) => {
            const stats = buildLoginBadgeStats(result, userStats);
            if (!stats) return;

            checkBadges(stats);
        };

        const performCheckIn = async () => {
            inFlightUserIdsRef.current.add(userId);

            try {
                const { data, error } = await supabase.rpc("daily_check_in") as {
                    data: CheckInResult | null;
                    error: RpcError | null;
                };

                if (error) {
                    if (error.code === "23503") {
                        try {
                            const displayName =
                                user.user_metadata?.full_name ||
                                user.user_metadata?.name ||
                                createDefaultDisplayName();
                            const avatarUrl = getDefaultAvatarPath(user.id);

                            await supabase
                                .from("profiles")
                                .upsert(
                                    { id: user.id, display_name: displayName, avatar_url: avatarUrl },
                                    { onConflict: "id", ignoreDuplicates: true },
                                );

                            const { data: retryData, error: retryError } = await supabase.rpc("daily_check_in") as {
                                data: CheckInResult | null;
                                error: RpcError | null;
                            };

                            if (!retryError) {
                                markCheckInHandled();

                                if (retryData?.is_new_day) {
                                    await refreshRewardState();
                                    checkLoginStreakBadges(retryData);
                                    showCheckInToast(retryData);
                                }
                            } else if (retryError.code === "23505") {
                                markCheckInHandled();
                            } else {
                                logger.error("Check-in error:", { error: retryError });
                                scheduleRetry();
                            }
                        } catch (retryErr) {
                            logger.error(retryErr, { context: "Check-in failed after profile recovery" });
                            scheduleRetry();
                        }
                        return;
                    }

                    if (error.code === "23505") {
                        markCheckInHandled();
                    } else {
                        logger.error("Check-in error:", { error });
                        scheduleRetry();
                    }
                    return;
                }

                markCheckInHandled();

                if (!data?.is_new_day) return;

                await refreshRewardState();
                checkLoginStreakBadges(data);
                showCheckInToast(data);
            } catch (err) {
                logger.error(err, { context: "Check-in failed" });
                scheduleRetry();
            } finally {
                inFlightUserIdsRef.current.delete(userId);
            }
        };

        void performCheckIn();
    }, [checkBadges, queryClient, refreshProfile, retryTick, supabase, toast, user, userStats]);

    return null;
}
