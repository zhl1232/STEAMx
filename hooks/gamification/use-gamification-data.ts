"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserStats } from "@/lib/gamification/types";
import { useAuth } from "@/context/auth-context";

export function useGamificationData() {
    const { user, profile, refreshProfile } = useAuth();
    const supabase = createClient();
    const queryClient = useQueryClient();

    const enabled = !!user;

    // 1. Use XP from Auth Context (already fetched)
    const xp = profile?.xp || 0;

    // 2. Fetch Unlocked Badges
    const { data: unlockedBadges } = useQuery({
        queryKey: ['gamification', 'badges', user?.id],
        queryFn: async (): Promise<Set<string>> => {
            const { data } = await supabase
                .from('user_badges')
                .select('badge_id')
                .eq('user_id', user!.id);
            return new Set((data?.map((b: { badge_id: string }) => b.badge_id) || []) as string[]);
        },
        enabled,
        staleTime: 1000 * 60 * 30, // 30 minutes (badges don't change often without action)
    });

    // 3. Fetch Full User Stats (Expensive, calculate strictly when needed or for periodic checks)
    const { data: userStats } = useQuery({
        queryKey: ['gamification', 'stats', user?.id],
        queryFn: async (): Promise<UserStats> => {
            // Efficiently fetch all stats using the dedicated RPC
            const { data, error } = await supabase.rpc('get_user_stats_summary', {
                target_user_id: user!.id
            });

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
                repliesCount: stats.repliesCount || 0
            };
        },
        enabled,
        staleTime: 1000 * 60 * 10, // 10 minutes cache for heavy stats
    });

    // Mutations
    const updateXpMutation = useMutation({
        mutationFn: async (newXp: number) => {
            const { error } = await supabase
                .from('profiles')
                .update({ xp: newXp })
                .eq('id', user!.id);
            if (error) throw error;
        },
        onSuccess: () => {
            // We need to refresh the profile in AuthContext since that's where XP lives now
            // Note: In a real app we might pass refreshProfile down or use a global query cache for profile.
            // For now, let's try to invalidate the 'gamification', 'profile' key just in case other components use it,
            // although we just removed the listener.
            // Actually, the cleanest way is if AuthProvider exposed a way to update, or we moved Auth to React Query.
            // Given AuthContext is legacy useEffect style, the UI for XP might not update immediately without a reload 
            // unless we manually refetch. 
            // Strategy: The gamification context CONSUMES xp. If we update DB, we must update the consumed value.
            // Let's rely on the fact that we might need to expose `refreshProfile` to this hook?
            // Or better: Revert to using a Query for XP if real-time update is critical and AuthContext is slow.
            // BUT, user asked to optimize requests. 
            // Let's invalidate 'profile' related queries if any exists, but primarily we depend on AuthContext.
            // Let's assume AuthContext might re-fetch if we tell it to? No strictly provided method here to pass to onSuccess easily without prop drilling.
            // actually `useAuth` provides `refreshProfile`.
            refreshProfile();
        }
    });

    const unlockBadgeMutation = useMutation({
        mutationFn: async (badgeId: string) => {
            const { error } = await supabase
                .from('user_badges')
                .insert({
                    user_id: user!.id,
                    badge_id: badgeId,
                    unlocked_at: new Date().toISOString()
                });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['gamification', 'badges', user?.id] });
        }
    });

    // Check-in Side Effect Wrapper (Separate from reading stats)
    // We already called RPC in query, which MIGHT execute the check-in side effect depending on DB function implementation.
    // Assuming `daily_check_in` RPC handles "if already checked in, do nothing, just return stats".

    return {
        xp,
        unlockedBadges: unlockedBadges || new Set<string>(),
        userStats,
        updateXpMutation,
        unlockBadgeMutation,
        refetchStats: useCallback(() => queryClient.invalidateQueries({ queryKey: ['gamification', 'stats', user?.id] }), [queryClient, user?.id])
    };
}
