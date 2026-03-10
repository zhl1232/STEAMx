import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";

export interface ModeratorEligibility {
    isEligible: boolean;
    score: number;
    requirements: {
        level: { met: boolean; current: number; required: number };
        publishedProjects: { met: boolean; current: number; required: number };
        completedProjects: { met: boolean; current: number; required: number };
        commentsCount: { met: boolean; current: number; required: number };
        badges: { met: boolean; current: number; required: number };
        accountAge: { met: boolean; current: number; required: number };
        violations: { met: boolean };
    };
}

export function useModeratorEligibility() {
    const { user, profile } = useAuth();
    const [eligibility, setEligibility] = useState<ModeratorEligibility | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function checkEligibility() {
            if (!user || !profile) {
                setEligibility(null);
                setIsLoading(false);
                return;
            }

            // 如果已经是审核员或管理员，不能申请
            if (profile.role !== 'user') {
                setEligibility(null);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const response = await fetch("/api/moderator/eligibility");
                if (response.status === 401) {
                    setEligibility(null);
                    return;
                }
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                const payload = await response.json();
                setEligibility((payload?.eligibility as ModeratorEligibility) || null);
            } catch (error) {
                console.error('Error checking eligibility:', error);
                setEligibility(null);
            } finally {
                setIsLoading(false);
            }
        }

        checkEligibility();
    }, [user, profile]);

    return { eligibility, isLoading };
}
