"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { callRpc } from "@/lib/supabase/rpc";
import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { useNotifications } from "@/context/notification-context";
import { mapComment, type DbComment } from "@/lib/mappers/project";
import { Comment, Discussion, Challenge } from "@/lib/types";
import { getWeekKey, getWeekStartISO } from "@/lib/date-utils";



type CommunityContextType = {
    discussions: Discussion[];
    challenges: Challenge[];
    addDiscussion: (discussion: Discussion) => void;
    addReply: (discussionId: string | number, reply: Comment, parentId?: number) => Promise<Comment | null>;
    joinChallenge: (challengeId: string | number) => void;
    deleteReply: (replyId: string | number) => Promise<void>;
    deleteDiscussion: (discussionId: string | number) => Promise<void>;
    isLoading: boolean;
};

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export function CommunityProvider({ children }: { children: React.ReactNode }) {
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [supabase] = useState(() => createClient());
    const { user, profile, loading: authLoading } = useAuth();
    const { addXp } = useGamification();
    const { createNotification } = useNotifications();

    // Refs for stable callbacks
    const challengesRef = useRef(challenges);
    const lastFetchedUserIdRef = useRef<string | null | undefined>(undefined);

    useEffect(() => { challengesRef.current = challenges; }, [challenges]);

    const fetchChallenges = useCallback(async () => {
        const response = await fetch('/api/challenges')
        if (!response.ok) {
            console.error('Error fetching challenges:', await response.text())
            return
        }
        const payload = await response.json()
        setChallenges((payload?.challenges as Challenge[]) || [])
    }, []);

    // 统一处理数据加载：初始化或用户变化时加载
    useEffect(() => {
        if (authLoading) return;

        const userId = user?.id ?? null;
        
        // 如果是首次加载（ref为undefined）或用户发生变化，则拉取数据
        if (lastFetchedUserIdRef.current === undefined || lastFetchedUserIdRef.current !== userId) {
            lastFetchedUserIdRef.current = userId;
            
            const loadData = async () => {
                setIsLoading(true);
                await fetchChallenges();
                setIsLoading(false);
            };
            loadData();
        }
    }, [authLoading, user?.id, fetchChallenges]);

    const addDiscussion = useCallback(async (discussion: Discussion) => {
        if (!user) return;

        const { data: newDiscussion, error } = await supabase
            .from('discussions')
            .insert({
                title: discussion.title,
                content: discussion.content,
                author_id: user.id,
                tags: discussion.tags
            } as never)
            .select()
            .single();

        if (error || !newDiscussion) {
            console.error('Error adding discussion:', error);
            return;
        }

        // 副作用异步执行（addXp 内的 refetchStats 会自动触发 checkBadges）
        const created = newDiscussion as { id: number };
        addXp(5, "发起讨论", "create_discussion", created.id);
    }, [supabase, user, addXp]);

    const addReply = useCallback(async (discussionId: string | number, reply: Comment, parentId?: number) => {
        if (!user) return null;

        const { data: newReply, error } = await supabase
            .from('discussion_replies')
            .insert({
                discussion_id: discussionId,
                author_id: user.id,
                content: reply.content,
                parent_id: parentId || null,
                reply_to_user_id: reply.reply_to_user_id || null,
                reply_to_username: reply.reply_to_username || null
            } as never)
            .select(`
                *,
                profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id, role)
            `)
            .single();

        if (error || !newReply) {
            console.error('Error adding reply:', error);
            return null;
        }

        // 副作用异步执行，不阻塞 UI（addXp 内的 refetchStats 会自动触发 checkBadges）
        const replyRow = newReply as { id: number };
        (async () => {
            try {
                // 通知
                if (reply.reply_to_user_id) {
                    createNotification({
                        user_id: reply.reply_to_user_id,
                        type: 'mention',
                        content: `${profile?.display_name || '某人'} 在讨论中@了你`,
                        related_type: 'discussion_reply',
                        related_id: replyRow.id,
                        discussion_id: Number(discussionId),
                        from_user_id: user.id,
                        from_username: profile?.display_name || user.email?.split('@')[0] || '未知用户',
                        from_avatar: profile?.avatar_url || user.user_metadata?.avatar_url
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
                console.error("Reply side effects error:", err);
            }
        })();

        return mapComment(newReply as unknown as DbComment);
    }, [supabase, user, profile, createNotification, addXp]);

    const joinChallenge = useCallback(async (challengeId: string | number) => {
        if (!user) return;
        const cid = Number(challengeId);

        // Find current challenge to check status
        const challenge = challengesRef.current.find(c => c.id === cid);
        if (!challenge) return;

        const isJoined = challenge.joined;

        // Optimistic update
        setChallenges(prev => prev.map(c => {
            if (c.id === cid) {
                return { ...c, joined: !isJoined, participants: c.participants + (isJoined ? -1 : 1) };
            }
            return c;
        }));

        if (isJoined) {
            // Leave
            await supabase.from('challenge_participants').delete().eq('user_id', user.id).eq('challenge_id', cid);
            await callRpc(supabase, 'decrement_challenge_participants', { challenge_id: cid });
        } else {
            // Join
            await supabase.from('challenge_participants').insert({ user_id: user.id, challenge_id: cid } as never);
            await callRpc(supabase, 'increment_challenge_participants', { challenge_id: cid });

            // XP（内部会 refetchStats → 自动 checkBadges）
            addXp(10, "参加挑战赛", "join_challenge", cid);
        }
    }, [supabase, user, addXp]);

    const deleteReply = useCallback(async (replyId: string | number) => {
        if (!user) return;
        const rid = replyId;
        const previousDiscussions = discussions;

        // Optimistic update
        setDiscussions(prev => prev.map(d => {
            if (d.replies?.some(r => r.id === rid)) {
                return {
                    ...d,
                    replies: d.replies.filter(r => r.id !== rid)
                };
            }
            return d;
        }));

        const response = await fetch(`/api/replies/${rid}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            setDiscussions(previousDiscussions);
            console.error('Error deleting reply:', await response.text());
        }
    }, [user, discussions]);

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
            console.error('Error deleting discussion:', await response.text());
        }
    }, [user, discussions]);

    const contextValue = useMemo(() => ({
        discussions,
        challenges,
        addDiscussion,
        addReply,
        joinChallenge,
        deleteReply,
        deleteDiscussion,
        isLoading
    }), [
        discussions,
        challenges,
        addDiscussion,
        addReply,
        joinChallenge,
        deleteReply,
        deleteDiscussion,
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
