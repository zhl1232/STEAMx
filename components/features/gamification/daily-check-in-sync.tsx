"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { AchievementToast } from "@/components/features/gamification/achievement-toast";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/context/auth-context";
import { logger } from "@/lib/logger";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
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

export function DailyCheckInSync() {
    const { user, refreshProfile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const supabase = useMemo(() => createClient(), []);
    const checkedUserIdsRef = useRef(new Set<string>());

    useEffect(() => {
        if (!user || checkedUserIdsRef.current.has(user.id)) return;

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

        const performCheckIn = async () => {
            checkedUserIdsRef.current.add(user.id);

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
                                (user.phone ? user.phone.replace(/^\+86/, "") : null);
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

                            if (!retryError && retryData?.is_new_day) {
                                await refreshRewardState();
                                showCheckInToast(retryData);
                            } else if (retryError && retryError.code !== "23505") {
                                logger.error("Check-in error:", { error: retryError });
                            }
                        } catch (retryErr) {
                            logger.error(retryErr, { context: "Check-in failed after profile recovery" });
                        }
                        return;
                    }

                    if (error.code !== "23505") {
                        logger.error("Check-in error:", { error });
                    }
                    return;
                }

                if (!data?.is_new_day) return;

                await refreshRewardState();
                showCheckInToast(data);
            } catch (err) {
                logger.error(err, { context: "Check-in failed" });
            }
        };

        void performCheckIn();
    }, [queryClient, refreshProfile, supabase, toast, user]);

    return null;
}
