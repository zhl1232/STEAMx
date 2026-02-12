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
    const { addXp, checkBadges } = useGamification();
    const { createNotification } = useNotifications();

    // Refs for stable callbacks
    const challengesRef = useRef(challenges);
    const userRef = useRef(user);
    const lastFetchedUserIdRef = useRef<string | null | undefined>(undefined);

    useEffect(() => { challengesRef.current = challenges; }, [challenges]);
    useEffect(() => { userRef.current = user; }, [user]);

    const fetchChallenges = useCallback(async () => {
        const { data, error } = await supabase
            .from('challenges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching challenges:', error);
            return;
        }

        // Check joined status if user is logged in（用 ref 读取当前 user，避免 fetchChallenges 因 user 变化而重建导致重复请求）
        const currentUser = userRef.current;
        let joinedChallengeIds = new Set<number>();
        if (currentUser) {
            const { data: participants } = await supabase
                .from('challenge_participants')
                .select('challenge_id')
                .eq('user_id', currentUser.id);

            if (participants) {
                participants.forEach((p: { challenge_id: number }) => joinedChallengeIds.add(p.challenge_id));
            }
        }

        interface ChallengeRow { id: number; title: string; description: string | null; image_url: string | null; participants_count: number; end_date: string | null; tags: string[] | null }
        const mappedChallenges: Challenge[] = (data || []).map((c: ChallengeRow) => ({
            id: c.id,
            title: c.title,
            description: c.description || '',
            image: c.image_url || '',
            participants: c.participants_count,
            daysLeft: c.end_date ? Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0,
            endDate: c.end_date ?? undefined, // 添加原始日期用于倒计时组件
            joined: joinedChallengeIds.has(c.id),
            tags: c.tags || []
        }));

        setChallenges(mappedChallenges);
    }, [supabase]);

    // 仅在 auth 就绪后拉取一次，避免因 user 从 null 变为已登录导致 effect 重复跑
    useEffect(() => {
        if (authLoading) return;
        const initData = async () => {
            setIsLoading(true);
            await fetchChallenges();
            setIsLoading(false);
        };
        initData();
    }, [authLoading, fetchChallenges]);

    // 用户登录/登出后重拉一次以更新「已参加」状态，且仅在非首次（避免与上面重复）
    useEffect(() => {
        if (authLoading) return;
        const userId = user?.id ?? null;
        if (lastFetchedUserIdRef.current === undefined) {
            lastFetchedUserIdRef.current = userId;
            return;
        }
        if (lastFetchedUserIdRef.current === userId) return;
        lastFetchedUserIdRef.current = userId;
        fetchChallenges();
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

        const created = newDiscussion as { id: number };
        // 奖励 XP
        addXp(5, "发起讨论", "create_discussion", created.id);

        // 检查讨论相关徽章
        const { count: discussionCount } = await supabase
            .from('discussions')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id);

        const { count: replyCount } = await supabase
            .from('discussion_replies')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id);

        checkBadges({
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
            discussionsCreated: (discussionCount || 0) + 1,
            repliesCount: replyCount || 0
        });
    }, [supabase, user, addXp, checkBadges]);

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
                profiles:author_id (display_name, avatar_url)
            `)
            .single();

        if (error || !newReply) {
            console.error('Error adding reply:', error);
            return null;
        }

        const replyRow = newReply as { id: number };
        // Create notification if replying to someone
        if (reply.reply_to_user_id) {
            await createNotification({
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

        // Award XP for replying
        await addXp(1, "回复讨论", "reply_discussion", replyRow.id);

        // 每周小目标：评论/回复满 5 次 → 额外 +5 XP（当周仅一次）
        const weekStart = getWeekStartISO();
        const weekKey = getWeekKey();
        const { data: weekComments } = await supabase
            .from("xp_logs")
            .select("id")
            .eq("user_id", user.id)
            .in("action_type", ["comment_project", "reply_discussion"])
            .gte("created_at", weekStart);
        const { data: alreadyAwarded } = await supabase
            .from("xp_logs")
            .select("id")
            .eq("user_id", user.id)
            .eq("action_type", "weekly_goal_comments_5")
            .eq("resource_id", weekKey)
            .maybeSingle();
        if ((weekComments?.length ?? 0) >= 5 && !alreadyAwarded) {
            addXp(5, "每周目标：参与讨论5次", "weekly_goal_comments_5", weekKey);
        }

        // 检查回复相关徽章
        const { count: replyCount } = await supabase
            .from('discussion_replies')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id);

        const { count: discussionCount } = await supabase
            .from('discussions')
            .select('*', { count: 'exact', head: true })
            .eq('author_id', user.id);

        checkBadges({
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
            discussionsCreated: discussionCount || 0,
            repliesCount: (replyCount || 0) + 1
        });

        // 使用统一的映射函数
        return mapComment(newReply as unknown as DbComment);
    }, [supabase, user, profile, createNotification, addXp, checkBadges]);

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

            // 奖励 XP
            addXp(10, "参加挑战赛", "join_challenge", cid);

            // 检查挑战赛相关徽章
            const { count: challengeCount } = await supabase
                .from('challenge_participants')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            checkBadges({
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
                challengesJoined: (challengeCount || 0) + 1,
                level: 1,
                loginDays: 0,
                consecutiveDays: 0,
                discussionsCreated: 0,
                repliesCount: 0
            });
        }
    }, [supabase, user, addXp, checkBadges]);

    const deleteReply = useCallback(async (replyId: string | number) => {
        if (!user) return;
        const rid = replyId;

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
            console.error('Error deleting reply:', await response.text());
        }
    }, [user]);

    const deleteDiscussion = useCallback(async (discussionId: string | number) => {
        if (!user) return;
        const did = discussionId;

        // Optimistic update
        setDiscussions(prev => prev.filter(d => d.id !== did));

        const response = await fetch(`/api/discussions/${did}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.error('Error deleting discussion:', await response.text());
        }
    }, [user]);

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
