"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from '@/lib/context/auth-context';
import { useGamification } from '@/lib/context/gamification-context';
import type { Challenge } from "@/lib/mappers/types";
import type { ChallengeGroups } from "@/lib/api/pbl-challenges";
import { logger } from "@/lib/logger";

export type JoinChallengeOptions = {
    currentlyJoined?: boolean;
};

type ChallengeContextType = {
    challenges: ChallengeGroups;
    challengesError: string | null;
    joinChallenge: (challengeId: string | number, options?: JoinChallengeOptions) => Promise<void>;
    reloadChallenges: () => Promise<void>;
    isLoading: boolean;
};

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);
const emptyChallengeGroups: ChallengeGroups = { activeTimed: [], evergreen: [], ended: [] };

export function ChallengeProvider({
    children,
    initialChallenges = emptyChallengeGroups,
    initialChallengesError = null,
    initialUserId,
    autoLoad = true,
}: {
    children: React.ReactNode;
    initialChallenges?: ChallengeGroups;
    initialChallengesError?: string | null;
    initialUserId?: string | null;
    autoLoad?: boolean;
}) {
    const [challenges, setChallenges] = useState<ChallengeGroups>(initialChallenges);
    const [challengesError, setChallengesError] = useState<string | null>(initialChallengesError);
    const [isLoading, setIsLoading] = useState(false);

    const { user, loading: authLoading } = useAuth();
    const { addXp } = useGamification();

    const challengesRef = useRef<ChallengeGroups>(challenges);
    const lastFetchedUserIdRef = useRef<string | null | undefined>(initialUserId);

    useEffect(() => { challengesRef.current = challenges; }, [challenges]);

    const fetchChallenges = useCallback(async () => {
        setChallengesError(null);

        const response = await fetch('/api/challenges');
        if (!response.ok) {
            const detail = await response.text();
            logger.error('Error fetching challenges:', { detail });
            setChallengesError('挑战加载失败，请稍后重试');
            return;
        }

        const payload = await response.json();
        setChallenges({
            activeTimed: (payload?.activeTimed as Challenge[]) || [],
            evergreen: (payload?.evergreen as Challenge[]) || [],
            ended: (payload?.ended as Challenge[]) || [],
        });
    }, []);

    const reloadChallenges = useCallback(async () => {
        setIsLoading(true);
        try {
            await fetchChallenges();
        } finally {
            setIsLoading(false);
        }
    }, [fetchChallenges]);

    useEffect(() => {
        if (!autoLoad) return;
        if (authLoading) return;

        const userId = user?.id ?? null;

        if (lastFetchedUserIdRef.current === undefined || lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId;

            const loadData = async () => {
                await reloadChallenges();
            };
            loadData();
        }
    }, [autoLoad, authLoading, user?.id, reloadChallenges]);

    const joinChallenge = useCallback(async (challengeId: string | number, options?: JoinChallengeOptions) => {
        const cid = Number(challengeId);
        if (!Number.isInteger(cid) || cid <= 0) {
            throw new Error("Invalid challenge id");
        }

        const allChallenges = [
            ...challengesRef.current.activeTimed,
            ...challengesRef.current.evergreen,
            ...challengesRef.current.ended,
        ];
        const listed = allChallenges.find(c => Number(c.id) === cid);
        const isJoined = options?.currentlyJoined ?? listed?.joined ?? false;

        const applyToggle = (arr: Challenge[]) => arr.map(c =>
            Number(c.id) === cid ? { ...c, joined: !isJoined, participants: c.participants + (isJoined ? -1 : 1) } : c
        );

        const snapshot = challengesRef.current;
        if (listed) {
            setChallenges(prev => ({
                activeTimed: applyToggle(prev.activeTimed),
                evergreen: applyToggle(prev.evergreen),
                ended: applyToggle(prev.ended),
            }));
        }

        try {
            const response = await fetch(`/api/challenges/${cid}/participation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: isJoined ? "leave" : "join" }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            const payload = await response.json();
            const changed = Boolean(payload?.changed);

            if (!isJoined && changed) {
                await addXp(10, "参加挑战", "join_challenge", cid);
            }
        } catch (error) {
            if (listed) {
                setChallenges(snapshot);
            }
            logger.error(error, { context: "Error toggling challenge participation" });
            throw error;
        }
    }, [addXp]);

    const contextValue = useMemo(() => ({
        challenges,
        challengesError,
        joinChallenge,
        reloadChallenges,
        isLoading
    }), [
        challenges,
        challengesError,
        joinChallenge,
        reloadChallenges,
        isLoading
    ]);

    return (
        <ChallengeContext.Provider value={contextValue}>
            {children}
        </ChallengeContext.Provider>
    );
}

export function useChallenge() {
    const context = useContext(ChallengeContext);
    if (context === undefined) {
        throw new Error("useChallenge must be used within a ChallengeProvider");
    }
    return context;
}
