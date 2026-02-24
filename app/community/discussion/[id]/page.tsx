"use client";

import * as React from "react";

import { useCommunity } from "@/context/community-context";
import { Discussion, Comment as ProjectComment, Profile } from "@/lib/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Heart, Tag, ArrowLeft, Calendar, Trash2, Loader2 } from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";

// 完全隔离的行内回复表单 —— React.memo + 原生 textarea + 零受控状态
// 父组件的任何重渲染都不会影响此组件内部的 DOM 和输入状态
interface InlineReplyFormProps {
    replyId: number;
    replyAuthor: string;
    replyUserId?: string;
    userAvatar?: string;
    userAvatarFrameId?: string;
    onSubmit: (e: React.FormEvent, content: string, parentId: number, replyToUserId?: string, replyToUsername?: string) => void;
    onCancel: () => void;
}

const InlineReplyForm = React.memo(({ replyId, replyAuthor, replyUserId, userAvatar, userAvatarFrameId, onSubmit, onCancel }: InlineReplyFormProps) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // === 诊断日志 ===
    useEffect(() => {
        console.warn('[InlineReplyForm] MOUNTED for reply', replyId);
        return () => console.warn('[InlineReplyForm] UNMOUNTED for reply', replyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="mt-4">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    const content = textareaRef.current?.value || "";
                    if (!content.trim()) return;
                    onSubmit(e, content, replyId, replyUserId, replyAuthor);
                    if (textareaRef.current) {
                        textareaRef.current.value = "";
                    }
                }}
                className="flex gap-3 items-start"
            >
                <AvatarWithFrame
                    src={userAvatar}
                    fallback="M"
                    avatarFrameId={userAvatarFrameId}
                    className="h-8 w-8 shrink-0"
                />
                <div className="flex-1 space-y-2">
                    <textarea
                        ref={textareaRef}
                        placeholder={`回复 @${replyAuthor}...`}
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-8">
                            取消
                        </Button>
                        <Button type="submit" size="sm" className="h-8">
                            发布
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
});
InlineReplyForm.displayName = "InlineReplyForm";

// Reply Item Component to match ProjectComments style
interface ReplyItemProps {
    reply: ProjectComment;
    isNested?: boolean;
    user: SupabaseUser | null;
    profile: Profile | null;
    replyingTo: number | null;
    setReplyingTo: (id: number | null) => void;
    onSubmitReply: (e: React.FormEvent, content: string, parentId: number, replyToUserId?: string, replyToUsername?: string) => void;
    onCancelReply: () => void;
    onDeleteReply: (id: number) => void;
    getNestedReplies: (parentId: number) => ProjectComment[];
}

const ReplyItem = ({
    reply,
    isNested = false,
    user,
    profile,
    replyingTo,
    setReplyingTo,
    onSubmitReply,
    onCancelReply,
    onDeleteReply,
    getNestedReplies
}: ReplyItemProps) => {
    const nestedReplies = getNestedReplies(Number(reply.id));
    const isReplying = replyingTo === Number(reply.id);
    const [isExpanded, setIsExpanded] = useState(false);
    const DISPLAY_LIMIT = 2;

    const displayedReplies = isExpanded ? nestedReplies : nestedReplies.slice(0, DISPLAY_LIMIT);
    const hiddenCount = nestedReplies.length - displayedReplies.length;

    return (
        <div className={cn("group flex gap-3 sm:gap-4 px-3", isNested ? "mt-3 sm:mt-4" : "py-4 sm:py-6 border-b border-border/60 last:border-0")} id={`reply-${reply.id}`}>
            <AvatarWithFrame
                src={reply.avatar}
                fallback={reply.author[0]?.toUpperCase()}
                avatarFrameId={reply.avatarFrameId}
                className={cn("shrink-0 border", isNested ? "h-7 w-7 sm:h-8 sm:w-8" : "h-9 w-9 sm:h-10 sm:w-10")}
            />

            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                    <span className={cn("font-semibold cursor-pointer hover:text-primary transition-colors shrink-0",
                        isNested ? "text-sm" : "text-sm sm:text-base",
                        getNameColorClassName(reply.nameColorId ?? null)
                    )}>
                        {reply.author}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{reply.date}</span>
                </div>

                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                    {reply.reply_to_username && (
                        <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-1.5 align-middle">
                            回复 @{reply.reply_to_username}
                        </span>
                    )}
                    {reply.content}
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-muted-foreground">

                    <button
                        className="flex items-center gap-1 shrink-0 hover:text-primary transition-colors"
                        onClick={() => { /* Like logic */ }}
                    >
                        <Heart className="h-3.5 w-3.5" />
                        <span>赞</span>
                    </button>

                    <button
                        className={cn("flex items-center gap-1 shrink-0 hover:text-primary transition-colors", isReplying && "text-primary")}
                        onClick={() => setReplyingTo(Number(reply.id))}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>回复</span>
                    </button>

                    {(user?.id === reply.userId || profile?.role === 'admin' || profile?.role === 'moderator') && (
                        <button
                            className="flex items-center gap-1 shrink-0 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                                e.preventDefault();
                                onDeleteReply(Number(reply.id));
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>删除</span>
                        </button>
                    )}
                </div>

                {isReplying && (
                    <InlineReplyForm
                        replyId={Number(reply.id)}
                        replyAuthor={reply.author}
                        replyUserId={reply.userId}
                        userAvatar={profile?.avatar_url || user?.user_metadata?.avatar_url || undefined}
                        userAvatarFrameId={profile?.equipped_avatar_frame_id || undefined}
                        onSubmit={onSubmitReply}
                        onCancel={onCancelReply}
                    />
                )}

                {nestedReplies.length > 0 && (
                    <div className="mt-3 sm:mt-4 bg-muted/30 rounded-lg p-2.5 sm:p-3 space-y-3 sm:space-y-4">
                        {displayedReplies.map(nestedReply => (
                            <ReplyItem
                                key={nestedReply.id}
                                reply={nestedReply}
                                isNested={true}
                                user={user}
                                profile={profile}
                                replyingTo={replyingTo}
                                setReplyingTo={setReplyingTo}
                                onSubmitReply={onSubmitReply}
                                onCancelReply={onCancelReply}
                                onDeleteReply={onDeleteReply}
                                getNestedReplies={getNestedReplies}
                            />
                        ))}

                        {!isExpanded && hiddenCount > 0 && (
                            <button
                                onClick={() => setIsExpanded(true)}
                                className="text-xs text-primary hover:underline font-medium"
                            >
                                查看全部 {nestedReplies.length} 条回复
                            </button>
                        )}

                        {isExpanded && nestedReplies.length > DISPLAY_LIMIT && (
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="text-xs text-muted-foreground hover:underline font-medium"
                            >
                                收起回复
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// 独立的底部回复框组件，拥有自己的局部状态，避免整页重渲染
interface BottomReplyBoxProps {
    user: SupabaseUser | null;
    profile: Profile | null;
    replyingTo: number | null;
    onSubmit: (e: React.FormEvent, content: string) => void;
}

const BottomReplyBox = React.memo(({ user, profile, replyingTo, onSubmit }: BottomReplyBoxProps) => {
    const [content, setContent] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const isComposingRef = React.useRef(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || replyingTo !== null) return;
        onSubmit(e, content);
        setContent("");
    };

    const isExpanded = isFocused || content.length > 0;

    return (
        <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3 sm:py-4 border-t md:border-t-0 px-4 md:px-0 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:shadow-none md:mt-8">
            <div className="flex gap-3 sm:gap-4 max-w-4xl mx-auto w-full">
                <AvatarWithFrame
                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                    fallback={profile?.display_name?.[0]?.toUpperCase() || "U"}
                    avatarFrameId={profile?.equipped_avatar_frame_id}
                    className="h-9 w-9 sm:h-10 sm:w-10 border shadow-sm shrink-0"
                />
                <form onSubmit={handleSubmit} className="flex-1 relative">
                    <div className={cn(
                        "rounded-xl border bg-background overflow-hidden transition-shadow duration-200 focus-within:ring-2 focus-within:ring-primary/20",
                        isExpanded ? "shadow-md" : "shadow-sm hover:shadow-md"
                    )}>
                        <Textarea
                            ref={textareaRef}
                            placeholder={replyingTo !== null ? "正在回复他人，请在上方回复框中输入..." : "分享你的观点..."}
                            value={replyingTo === null ? content : ""}
                            onChange={handleChange}
                            onCompositionStart={() => { isComposingRef.current = true; }}
                            onCompositionEnd={(e) => {
                                isComposingRef.current = false;
                                // 确保组合结束后触发一次更新（部分浏览器 compositionEnd 后不触发 onChange）
                                setContent((e.target as HTMLTextAreaElement).value);
                            }}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => { if (!content) setIsFocused(false); }}
                            disabled={replyingTo !== null}
                            className="min-h-[44px] border-none resize-none focus-visible:ring-0 p-3 text-sm bg-transparent"
                        />
                        {isExpanded && (
                            <div className="flex justify-between items-center px-3 pb-2">
                                <div className="text-xs text-muted-foreground" />
                                <Button
                                    type="submit"
                                    disabled={!content.trim() || replyingTo !== null}
                                    className="h-7 px-4 rounded-full text-xs"
                                >
                                    发布
                                </Button>
                            </div>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
});
BottomReplyBox.displayName = "BottomReplyBox";

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = React.use(params);
    const { addReply, deleteReply } = useCommunity();
    const { user, profile } = useAuth();
    const { promptLogin } = useLoginPrompt();

    const router = useRouter();
    const [replyingTo, setReplyingTo] = useState<number | null>(null);
    const [id, setId] = useState<string | number | null>(null);

    // Local state
    const [discussion, setDiscussion] = useState<Discussion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [supabase] = useState(() => createClient());

    // Pagination state for replies
    const REPLY_PAGE_SIZE = 10;
    const [replyPage, setReplyPage] = useState(0);
    const [hasMoreReplies, setHasMoreReplies] = useState(false);
    const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
    const [totalReplies, setTotalReplies] = useState(0);

    // Handle params unwrapping
    useEffect(() => {
        if (unwrappedParams.id) {
            setId(unwrappedParams.id);
        }
    }, [unwrappedParams.id]);

    type ReplyRow = { id: number; author_id: string; content: string; created_at: string; parent_id: number | null; reply_to_user_id: string | null; reply_to_username: string | null; profiles?: { display_name: string | null; avatar_url: string | null; equipped_avatar_frame_id?: string | null; equipped_name_color_id?: string | null } };

    const mapReplyRow = (r: ReplyRow): ProjectComment => ({
        id: r.id,
        author: r.profiles?.display_name || 'Unknown',
        userId: r.author_id,
        avatar: r.profiles?.avatar_url ?? undefined,
        avatarFrameId: r.profiles?.equipped_avatar_frame_id ?? undefined,
        content: r.content,
        date: formatRelativeTime(r.created_at),
        parent_id: r.parent_id,
        reply_to_user_id: r.reply_to_user_id,
        reply_to_username: r.reply_to_username,
        nameColorId: r.profiles?.equipped_name_color_id ?? undefined
    });

    // Fetch discussion (without replies) + first page of replies
    useEffect(() => {
        const fetchDiscussion = async () => {
            if (!id) return;

            try {
                setIsLoading(true);

                // Fetch discussion data without replies
                const { data: rawData, error } = await (supabase
                    .from('discussions')
                    .select(`
                        *,
                        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                    `)
                    .eq('id', id)
                    .single());

                if (error || !rawData) {
                    console.error('Error fetching discussion:', error);
                    setNotFound(true);
                    return;
                }

                type DiscussionRow = {
                    id: number;
                    title: string;
                    content: string;
                    created_at: string;
                    likes_count: number;
                    tags: string[] | null;
                    replies_count?: number;
                    profiles?: { display_name: string | null; avatar_url: string | null; equipped_avatar_frame_id?: string | null; equipped_name_color_id?: string | null };
                };
                const data = rawData as unknown as DiscussionRow;

                // Fetch first page of root replies + count
                const { data: rootReplies, count: rootCount } = await supabase
                    .from('discussion_replies')
                    .select(`
                        *,
                        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                    `, { count: 'exact' })
                    .eq('discussion_id', data.id)
                    .is('parent_id', null)
                    .order('created_at', { ascending: false })
                    .range(0, REPLY_PAGE_SIZE - 1);

                let mappedReplies: ProjectComment[] = (rootReplies as ReplyRow[] || []).map(mapReplyRow);

                // Fetch nested replies for these roots
                if (rootReplies && rootReplies.length > 0) {
                    const rootIds = (rootReplies as { id: number }[]).map(r => r.id);
                    const { data: nestedReplies } = await supabase
                        .from('discussion_replies')
                        .select(`
                            *,
                            profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                        `)
                        .in('parent_id', rootIds)
                        .order('created_at', { ascending: true });

                    if (nestedReplies) {
                        mappedReplies = [...mappedReplies, ...(nestedReplies as ReplyRow[]).map(mapReplyRow)];
                    }
                }

                const total = rootCount || 0;
                setTotalReplies(total);
                setHasMoreReplies(total > REPLY_PAGE_SIZE);
                setReplyPage(1);

                const mappedDiscussion: Discussion = {
                    id: data.id,
                    title: data.title,
                    author: data.profiles?.display_name || 'Unknown',
                    authorAvatar: data.profiles?.avatar_url || undefined,
                    authorAvatarFrameId: data.profiles?.equipped_avatar_frame_id || undefined,
                    authorNameColorId: data.profiles?.equipped_name_color_id || undefined,
                    content: data.content,
                    date: formatRelativeTime(data.created_at),
                    likes: data.likes_count,
                    tags: data.tags || [],
                    replies: mappedReplies,
                };

                setDiscussion(mappedDiscussion);
            } catch (err) {
                console.error('Exception in fetchDiscussion:', err);
                setNotFound(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDiscussion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Load more replies
    const handleLoadMoreReplies = async () => {
        if (!discussion || isLoadingMoreReplies || !hasMoreReplies) return;
        setIsLoadingMoreReplies(true);

        try {
            const from = replyPage * REPLY_PAGE_SIZE;
            const to = from + REPLY_PAGE_SIZE - 1;

            const { data: rootReplies } = await supabase
                .from('discussion_replies')
                .select(`
                    *,
                    profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                `)
                .eq('discussion_id', discussion.id)
                .is('parent_id', null)
                .order('created_at', { ascending: false })
                .range(from, to);

            let newReplies: ProjectComment[] = (rootReplies as ReplyRow[] || []).map(mapReplyRow);

            // Fetch nested for new roots
            if (rootReplies && rootReplies.length > 0) {
                const rootIds = (rootReplies as { id: number }[]).map(r => r.id);
                const { data: nestedReplies } = await supabase
                    .from('discussion_replies')
                    .select(`
                        *,
                        profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id, equipped_name_color_id)
                    `)
                    .in('parent_id', rootIds)
                    .order('created_at', { ascending: true });

                if (nestedReplies) {
                    newReplies = [...newReplies, ...(nestedReplies as ReplyRow[]).map(mapReplyRow)];
                }
            }

            setDiscussion(prev => {
                if (!prev) return null;
                return { ...prev, replies: [...prev.replies, ...newReplies] };
            });
            setReplyPage(prev => prev + 1);
            setHasMoreReplies(totalReplies > to + 1);
        } catch (error) {
            console.error('Error loading more replies:', error);
        } finally {
            setIsLoadingMoreReplies(false);
        }
    };

    // Scroll to hash anchor on load
    useEffect(() => {
        if (!isLoading && id && typeof window !== 'undefined' && window.location.hash) {
            const hash = window.location.hash.substring(1);
            requestAnimationFrame(() => {
                const element = document.getElementById(hash);
                if (element) {
                    const headerOffset = 100;
                    const elementPosition = element.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.scrollY - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth"
                    });

                    element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                    setTimeout(() => {
                        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                    }, 2000);
                }
            });
        }
    }, [isLoading, id]);

    if (!id) return null;

    if (isLoading) {
        return (
            <div className="container mx-auto py-6 sm:py-12 px-4 sm:px-6 max-w-4xl">
                <div className="space-y-6 sm:space-y-8">
                    <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                    <div className="bg-card border rounded-xl p-4 sm:p-8 shadow-sm">
                        <div className="h-6 w-48 bg-muted animate-pulse rounded mb-4" />
                        <div className="h-10 w-3/4 bg-muted animate-pulse rounded mb-4" />
                        <div className="h-6 w-full bg-muted animate-pulse rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (notFound || !discussion) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <h1 className="text-2xl font-bold mb-4">讨论不存在</h1>
                <Button onClick={() => router.back()}>返回列表</Button>
            </div>
        );
    }

    const handleSubmitReply = async (e: React.FormEvent, content: string, parentId?: number, replyToUserId?: string, replyToUsername?: string) => {
        e.preventDefault();
        if (!content.trim()) return;

        const submitReply = async () => {
            const addedReply = await addReply(discussion.id, {
                id: 0,
                author: "Me",
                content: content,
                date: "",
                reply_to_user_id: replyToUserId,
                reply_to_username: replyToUsername,
            }, parentId);

            if (addedReply) {
                setDiscussion((prev) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        replies: [addedReply, ...prev.replies]
                    };
                });
                // 行内回复的 content 清理在 ReplyItem 内部完成
                setReplyingTo(null);
            }
        };

        if (!user) {
            promptLogin(() => {
                submitReply();
            }, {
                title: '登录以发表回复',
                description: '登录后即可参与讨论，分享你的观点'
            });
            return;
        }

        submitReply();
    };

    const handleCancelReply = () => {
        setReplyingTo(null);
    };

    const handleDeleteReply = async (replyId: number) => {
        await deleteReply(replyId);
        setDiscussion((prev) => {
            if (!prev) return null;
            return {
                ...prev,
                replies: prev.replies.filter((r) => r.id !== replyId)
            };
        });
    };

    // 分离顶级回复和嵌套回复
    const topLevelReplies = discussion.replies.filter(r => !r.parent_id);
    const getNestedReplies = (parentId: number | string) => {
        return discussion.replies.filter(r => r.parent_id === parentId);
    };


    return (
        <div className="container mx-auto py-6 sm:py-12 px-4 sm:px-6 max-w-4xl pb-28 md:pb-8">
            <Button variant="ghost" onClick={() => router.back()} className="mb-4 sm:mb-6 pl-0 hover:pl-2 transition-all text-sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回讨论列表
            </Button>

            <div className="bg-card border rounded-xl p-4 sm:p-8 shadow-sm mb-6 sm:mb-8">
                {discussion.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        {discussion.tags.map(tag => (
                            <span key={tag} className="px-2 sm:px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium flex items-center gap-1">
                                <Tag className="h-3 w-3" /> {tag}
                            </span>
                        ))}
                    </div>
                )}

                <h1 className="text-xl sm:text-3xl font-bold mb-3 sm:mb-4">{discussion.title}</h1>

                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-8 border-b pb-4 sm:pb-6">
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <AvatarWithFrame
                            src={discussion.authorAvatar}
                            fallback={discussion.author[0]?.toUpperCase()}
                            avatarFrameId={discussion.authorAvatarFrameId}
                            className="h-6 w-6 sm:h-8 sm:w-8 rounded-full shrink-0"
                        />
                        <span className={cn("font-medium", getNameColorClassName(discussion.authorNameColorId ?? null))}>
                            {discussion.author}
                        </span>
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2">
                        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {discussion.date}
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2 text-red-500">
                        <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-current" />
                        {discussion.likes}
                    </span>
                </div>

                <div className="prose dark:prose-invert max-w-none">
                    <p className="text-sm sm:text-lg leading-relaxed whitespace-pre-wrap">{discussion.content}</p>
                </div>
            </div>

            <div className="space-y-4 sm:space-y-8">
                <h3 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
                    回复 ({totalReplies})
                </h3>

                {/* 顶级回复列表 */}
                {topLevelReplies.length > 0 ? (
                    <div className="bg-card rounded-lg">
                        {topLevelReplies.map(reply => (
                            <ReplyItem
                                key={reply.id}
                                reply={reply}
                                user={user}
                                profile={profile}
                                replyingTo={replyingTo}
                                setReplyingTo={setReplyingTo}
                                onSubmitReply={handleSubmitReply}
                                onCancelReply={handleCancelReply}
                                onDeleteReply={handleDeleteReply}
                                getNestedReplies={getNestedReplies}
                            />
                        ))}

                        {/* 加载更多按钮 */}
                        {hasMoreReplies && (
                            <div className="text-center py-4">
                                <Button
                                    variant="outline"
                                    onClick={handleLoadMoreReplies}
                                    disabled={isLoadingMoreReplies}
                                    className="w-full sm:w-auto"
                                >
                                    {isLoadingMoreReplies ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            加载中...
                                        </>
                                    ) : (
                                        "加载更多回复"
                                    )}
                                </Button>
                            </div>
                        )}

                        {!hasMoreReplies && topLevelReplies.length > 0 && (
                            <div className="text-center py-3 text-muted-foreground text-xs">没有更多了</div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        <MessageSquare className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-sm">暂无回复，快来抢沙发吧！</p>
                    </div>
                )}
            </div>

            {/* 底部回复框（独立组件，避免输入时全页重渲染） */}
            <BottomReplyBox
                user={user}
                profile={profile}
                replyingTo={replyingTo}
                onSubmit={handleSubmitReply}
            />
        </div>
    );
}
