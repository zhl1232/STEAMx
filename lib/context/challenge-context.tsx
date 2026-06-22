"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from '@/lib/context/auth-context';
import { useGamification } from '@/lib/context/gamification-context';
import type { Challenge } from "@/lib/mappers/types";
import type { ChallengeGroups } from "@/lib/api/pbl-challenges";
import { logger } from "@/lib/logger";

type ChallengeContextType = {
    challenges: ChallengeGroups;
    challengesError: string | null;
    joinChallenge: (challengeId: string | number) => Promise<void>;
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
}: {
    children: React.ReactNode;
    initialChallenges?: ChallengeGroups;
    initialChallengesError?: string | null;
    initialUserId?: string | null;
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
        if (authLoading) return;

        const userId = user?.id ?? null;

        if (lastFetchedUserIdRef.current === undefined || lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId;

            const loadData = async () => {
                await reloadChallenges();
            };
            void loadData();
        }
    }, [authLoading, user?.id, reloadChallenges]);

    const joinChallenge = useCallback(async (challengeId: string | number) => {
        if (!user) return;
        const cid = Number(challengeId);

        const allChallenges = [
            ...challengesRef.current.activeTimed,
            ...challengesRef.current.evergreen,
            ...challengesRef.current.ended,
        ];
        const challenge = allChallenges.find(c => Number(c.id) === cid);
        if (!challenge) return;

        const isJoined = challenge.joined;

        const applyToggle = (arr: Challenge[]) => arr.map(c =>
            Number(c.id) === cid ? { ...c, joined: !isJoined, participants: c.participants + (isJoined ? -1 : 1) } : c
        );

        const snapshot = challengesRef.current;

        setChallenges(prev => ({
            activeTimed: applyToggle(prev.activeTimed),
            evergreen: applyToggle(prev.evergreen),
            ended: applyToggle(prev.ended),
        }));

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
                 addXp(10, "参加挑战", "join_challenge", cid);
            }
        } catch (error) {
            setChallenges(snapshot);
            logger.error(error, { context: "Error toggling challenge participation" });
            throw error;
        }
    }, [user, addXp]);

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
