"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from '@/lib/context/auth-context';
import { useGamification } from '@/lib/context/gamification-context';
import { useNotifications } from '@/lib/context/notification-context';
import { mapComment, type DbComment } from "@/lib/mappers/project";
import { Comment, Discussion } from "@/lib/mappers/types";
import type { Challenge } from "@/lib/mappers/types";
import type { ChallengeGroups } from "@/lib/api/community-challenges";
import { getWeekKey, getWeekStartISO } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { isClean } from "@/lib/content-filter";
import { useToast } from "@/hooks/use-toast";



type CommunityContextType = {
    discussions: Discussion[];
    challenges: ChallengeGroups;
    challengesError: string | null;
    addDiscussion: (discussion: Discussion) => Promise<void>;
    addReply: (discussionId: string | number, reply: Comment, parentId?: number) => Promise<Comment | null>;
    joinChallenge: (challengeId: string | number) => Promise<void>;
    deleteReply: (replyId: string | number) => Promise<void>;
    deleteDiscussion: (discussionId: string | number) => Promise<void>;
    reloadChallenges: () => Promise<void>;
    isLoading: boolean;
};

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);
const emptyChallengeGroups: ChallengeGroups = { activeTimed: [], evergreen: [], ended: [] };

export function CommunityProvider({
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
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [challenges, setChallenges] = useState<ChallengeGroups>(initialChallenges);
    const [challengesError, setChallengesError] = useState<string | null>(initialChallengesError);
    const [isLoading, setIsLoading] = useState(false);

    const [supabase] = useState(() => createClient());
    const { user, profile, loading: authLoading } = useAuth();
    const { addXp } = useGamification();
    const { createNotification } = useNotifications();
    const { toast } = useToast();

    // Refs for stable callbacks
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

    // 统一处理数据加载：初始化或用户变化时加载
    useEffect(() => {
        if (authLoading) return;

        const userId = user?.id ?? null;
        
        // 如果是首次加载（ref为undefined）或用户发生变化，则拉取数据
        if (lastFetchedUserIdRef.current === undefined || lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId;
            
            const loadData = async () => {
                await reloadChallenges();
            };
            loadData();
        }
    }, [authLoading, user?.id, reloadChallenges]);

    const addDiscussion = useCallback(async (discussion: Discussion) => {
        if (!user) return;

        if (!isClean(discussion.title) || !isClean(discussion.content)) {
            toast({
                title: "内容审核未通过",
                description: "讨论中包含不当内容，请修改后重试",
                variant: "destructive",
            });
            return;
        }

        const response = await fetch("/api/discussions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: discussion.title,
                content: discussion.content,
                tags: discussion.tags || [],
            }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            logger.error('Error adding discussion:', { error: body?.error || 'request_failed' });
            throw new Error(body?.error || 'Failed to create discussion');
        }

        // 副作用异步执行（addXp 内的 refetchStats 会自动触发 checkBadges）
        const payload = await response.json();
        const created = payload?.discussion as { id: number } | undefined;
        if (created?.id) {
            await addXp(5, "发起讨论", "create_discussion", created.id);
        }
    }, [user, addXp, toast]);

    const addReply = useCallback(async (discussionId: string | number, reply: Comment, parentId?: number) => {
        if (!user) return null;

        const res = await fetch("/api/replies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                discussion_id: discussionId,
                content: reply.content,
                parent_id: parentId || null,
                image_url: reply.image_url || null,
            }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            logger.error("Error adding reply:", { error: body?.error });
            return null;
        }

        const { reply: newReply } = await res.json();
        if (!newReply) return null;

        // 副作用异步执行，不阻塞 UI（addXp 内的 refetchStats 会自动触发 checkBadges）
        const replyRow = newReply as { id: number };
        (async () => {
            try {
                // 通知
                const createdReply = newReply as DbComment;
                if (createdReply.reply_to_user_id) {
                    createNotification({
                        user_id: createdReply.reply_to_user_id,
                        type: 'mention',
                        content: `${profile?.display_name || '某人'} 在讨论中@了你`,
                        related_type: 'discussion_reply',
                        related_id: replyRow.id,
                        discussion_id: Number(discussionId),
                        from_user_id: user.id,
                        from_username: profile?.display_name || user.email?.split('@')[0] || '未知用户',
                        from_avatar: profile?.avatar_url || getDefaultAvatarPath(user.id)
                    });
                }

                // XP（内部会 refetchStats → 自动 checkBadges）
                await addXp(1, "回复讨论", "reply_discussion", replyRow.id);

                // 每周小目标（并行查询）
                const weekStart = getWeekStartISO();
                const weekKey = getWeekKey();
                const [{ data: weekComments }, { data: alreadyAwarded }] = await Promise.all([
                    supabase.from("xp_logs").select("id").eq("user_id", user.id)
                        .in("action_type", ["comment_project", "reply_discussion"]).gte("created_at", weekStart),
                    supabase.from("xp_logs").select("id").eq("user_id", user.id)
                        .eq("action_type", "weekly_goal_comments_5").eq("resource_id", weekKey).maybeSingle()
                ]);
                if ((weekComments?.length ?? 0) >= 5 && !alreadyAwarded) {
                    addXp(5, "每周目标：参与讨论5次", "weekly_goal_comments_5", weekKey);
                }
            } catch (err) {
                logger.error(err, { context: "Reply side effects error" });
            }
        })();

        return mapComment(newReply as unknown as DbComment);
    }, [supabase, user, profile, createNotification, addXp]);

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

        // Save snapshot for rollback
        const snapshot = challengesRef.current;

        // Optimistic update
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
                await addXp(10, "参加挑战", "join_challenge", cid);
            }
        } catch (error) {
            // Restore snapshot instead of re-applying the toggle (which would apply the same direction twice)
            setChallenges(snapshot);
            logger.error(error, { context: "Error toggling challenge participation" });
            throw error;
        }
    }, [user, addXp]);

    const deleteReply = useCallback(async (replyId: string | number) => {
        if (!user) return;
        const rid = replyId;

        const response = await fetch(`/api/replies/${rid}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const detail = await response.text();
            logger.error('Error deleting reply:', { detail });
            throw new Error(detail || 'Failed to delete reply');
        }

        setDiscussions(prev => prev.map(d => {
            if (d.replies?.some(r => r.id === rid)) {
                return {
                    ...d,
                    replies: d.replies.filter(r => r.id !== rid)
                };
            }
            return d;
        }));
    }, [user]);

    const deleteDiscussion = useCallback(async (discussionId: string | number) => {
        if (!user) return;
        const did = discussionId;
        const previousDiscussions = discussions;

        // Optimistic update
        setDiscussions(prev => prev.filter(d => d.id !== did));

        const response = await fetch(`/api/discussions/${did}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            setDiscussions(previousDiscussions);
            logger.error('Error deleting discussion:', { detail: await response.text() });
        }
    }, [user, discussions]);

    const contextValue = useMemo(() => ({
        discussions,
        challenges,
        challengesError,
        addDiscussion,
        addReply,
        joinChallenge,
        deleteReply,
        deleteDiscussion,
        reloadChallenges,
        isLoading
    }), [
        discussions,
        challenges,
        challengesError,
        addDiscussion,
        addReply,
        joinChallenge,
        deleteReply,
        deleteDiscussion,
        reloadChallenges,
        isLoading
    ]);

    return (
        <CommunityContext.Provider value={contextValue}>
            {children}
        </CommunityContext.Provider>
    );
}

export function useCommunity() {
    const context = useContext(CommunityContext);
    if (context === undefined) {
        throw new Error("useCommunity must be used within a CommunityProvider");
    }
    return context;
}
