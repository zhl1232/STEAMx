import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Discussion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Heart, Tag, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/date-utils";
import { DiscussionSearch, SortOption } from "./discussion-search";
import { SearchHighlight } from "@/components/ui/search-highlight";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";

/** 讨论卡片组件 */
function DiscussionCard({
    discussion,
    searchQuery,
    canDelete,
    onDelete,
}: {
    discussion: Discussion;
    searchQuery: string;
    canDelete: boolean;
    onDelete: (id: string | number) => void;
}) {
    return (
        <div className="border border-border/60 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow transition-all bg-card cursor-pointer group relative">
            <Link href={`/community/discussion/${discussion.id}`} className="absolute inset-0 z-10 rounded-xl" aria-label={`进入讨论：${discussion.title}`} />
            <div className="relative z-0 pointer-events-none">
                <h3 className="text-base sm:text-xl font-semibold mb-1.5 sm:mb-2 group-hover:text-primary transition-colors pr-2 leading-snug">
                    <SearchHighlight text={discussion.title} query={searchQuery} />
                </h3>
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
                    <span className="flex items-center gap-1 sm:gap-1.5">
                        <AvatarWithFrame
                            src={discussion.authorAvatar}
                            fallback={discussion.author[0]}
                            avatarFrameId={discussion.authorAvatarFrameId}
                            className="size-5 sm:size-6"
                        />
                        {discussion.author}
                    </span>
                    <span>{discussion.date}</span>
                </div>
                {discussion.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
                        {discussion.tags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-medium text-pink-800 dark:bg-pink-900/35 dark:text-pink-200"
                            >
                                <Tag className="h-3 w-3 shrink-0" />
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <p className="text-muted-foreground line-clamp-2 text-sm sm:text-base mb-3 sm:mb-4">
                    <SearchHighlight text={discussion.content} query={searchQuery} />
                </p>
                <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground border-t pt-3 sm:pt-4 pointer-events-auto relative z-20">
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent text-xs sm:text-sm">
                        <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {discussion.replies.length} 回复
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent hover:text-red-500 text-xs sm:text-sm">
                        <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        {discussion.likes} 赞
                    </Button>
                    {canDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 hover:bg-transparent hover:text-destructive ml-auto"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDelete(discussion.id);
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function DiscussionList() {
    const { user, profile } = useAuth();
    const { promptLogin: _promptLogin } = useLoginPrompt();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState("");

    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [_page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const [supabase] = useState(() => createClient());

    // Search and filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("newest");
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    // Sync isLoading state with ref
    useEffect(() => {
        isLoadingRef.current = isLoading;
    }, [isLoading]);

    const fetchDiscussions = useCallback(async (reset = false) => {
        if (isLoadingRef.current && !reset) return;

        try {
            setIsLoading(true);

            const PAGE_SIZE = 10;
            let currentPage = 0;

            setPage(prev => {
                currentPage = reset ? 0 : prev;
                return currentPage;
            });

            const from = currentPage * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            let query = supabase
                .from('discussions')
                .select(`
                    *,
                    profiles:author_id (display_name, avatar_url, equipped_avatar_frame_id)
                `);

            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
            }

            if (selectedTag) {
                query = query.contains('tags', [selectedTag]);
            }

            switch (sortBy) {
                case 'hottest':
                    query = query.order('likes_count', { ascending: false });
                    break;
                case 'most_replies':
                    query = query.order('replies_count', { ascending: false });
                    break;
                case 'latest_reply':
                    query = query.order('last_reply_at', { ascending: false, nullsFirst: false });
                    break;
                case 'newest':
                default:
                    query = query.order('created_at', { ascending: false });
                    break;
            }

            query = query.range(from, to);

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching discussions:', error);
                return;
            }

            if (!data) {
                console.warn('No data returned from discussions query');
                return;
            }

            interface DiscussionRow { id: number; title: string; content: string; created_at: string; likes_count: number; tags: string[] | null; replies_count?: number; profiles?: { display_name: string | null; avatar_url?: string | null; equipped_avatar_frame_id?: string | null } }
            const mappedDiscussions: Discussion[] = data.map((d: DiscussionRow) => ({
                id: d.id,
                title: d.title,
                author: d.profiles?.display_name || 'Unknown',
                authorAvatar: d.profiles?.avatar_url || undefined,
                authorAvatarFrameId: d.profiles?.equipped_avatar_frame_id ?? undefined,
                content: d.content,
                date: formatRelativeTime(d.created_at),
                likes: d.likes_count,
                tags: d.tags || [],
                replies: Array(d.replies_count || 0).fill({}),
            }));

            if (reset) {
                setDiscussions(mappedDiscussions);
                setPage(1);
            } else {
                setDiscussions(prev => [...prev, ...mappedDiscussions]);
                setPage(prev => prev + 1);
            }

            setHasMore(data.length === PAGE_SIZE);
        } catch (err) {
            console.error('Exception in fetchDiscussions:', err);
        } finally {
            setIsLoading(false);
        }
    }, [supabase, searchQuery, selectedTag, sortBy]);

    // Fetch all discussions tags for filter
    useEffect(() => {
        const fetchTags = async () => {
            const { data } = await supabase
                .from('discussions')
                .select('tags');

            if (data) {
                const allTags = (data as { tags: string[] | null }[]).flatMap(d => d.tags || []);
                const uniqueTags = Array.from(new Set(allTags)).slice(0, 10);
                setAvailableTags(uniqueTags);
            }
        };
        fetchTags();
    }, [supabase]);

    // Trigger fetch when search/filter changes
    useEffect(() => {
        fetchDiscussions(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, selectedTag, sortBy]);

    // Scroll sentinel for infinite loading
    const sentinelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingRef.current) {
                    fetchDiscussions(false);
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, fetchDiscussions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newContent.trim() || !user) return;

        const { error } = await supabase
            .from('discussions')
            .insert({
                title: newTitle,
                content: newContent,
                author_id: user.id,
                tags: newTags.split(",").map(t => t.trim()).filter(t => t)
            } as never);

        if (!error) {
            setNewTitle("");
            setNewContent("");
            setNewTags("");
            setIsCreating(false);
            fetchDiscussions(true);
        }
    };

    const handleDelete = async (id: string | number) => {
        const { error } = await supabase
            .from('discussions')
            .delete()
            .eq('id', id);

        if (!error) {
            setDiscussions(prev => prev.filter(d => d.id !== id));
        }
    };

    const handleSearch = (query: string, tag: string | null, sort: SortOption) => {
        setSearchQuery(query);
        setSelectedTag(tag);
        setSortBy(sort);
    };

    const canDelete = profile?.role === 'admin' || profile?.role === 'moderator';

    return (
        <div className="space-y-4 sm:space-y-6 pb-24 md:pb-0">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold hidden md:block">讨论区</h2>
                {user && (
                    <Button onClick={() => setIsCreating(!isCreating)} className="hidden md:flex">
                        {isCreating ? "取消" : "发起讨论"}
                    </Button>
                )}
            </div>

            {/* Mobile FAB for Creating Discussion */}
            {user && !isCreating && (
                <Button
                    onClick={() => {
                        setIsCreating(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    size="icon"
                    className="md:hidden fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg z-50 bg-primary text-primary-foreground hover:scale-105 transition-transform"
                >
                    <MessageSquare className="h-6 w-6" />
                    <span className="sr-only">发起讨论</span>
                </Button>
            )}

            {/* Search Component */}
            <DiscussionSearch
                onSearch={handleSearch}
                availableTags={availableTags}
            />

            {isCreating && (
                <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-4 bg-muted/30">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">标题</label>
                        <Input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="请输入标题..."
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">内容</label>
                        <Textarea
                            value={newContent}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                            placeholder="详细描述你的问题或想法..."
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">标签 (用逗号分隔)</label>
                        <Input
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            placeholder="例如: 科学, 实验, 求助"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>取消</Button>
                        <Button type="submit">发布</Button>
                    </div>
                </form>
            )}

            <div>
                {discussions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                        {discussions.map((discussion) => (
                            <DiscussionCard
                                key={discussion.id}
                                discussion={discussion}
                                searchQuery={searchQuery}
                                canDelete={!!canDelete}
                                onDelete={handleDelete}
                            />
                        ))}
                        {/* Scroll sentinel for infinite loading */}
                        <div ref={sentinelRef} className="h-1" />
                        {isLoading && (
                            <div className="text-center py-4 text-muted-foreground text-sm">加载中...</div>
                        )}
                        {!hasMore && discussions.length > 0 && (
                            <div className="text-center py-4 text-muted-foreground text-xs">没有更多了</div>
                        )}
                    </div>
                ) : !isLoading ? (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-lg font-semibold mb-2">没有找到相关讨论</h3>
                        <p className="text-muted-foreground">
                            {searchQuery || selectedTag ? '换个关键词或标签试试看？' : '还没有讨论，来发起第一个吧！'}
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-4 text-muted-foreground">加载中...</div>
                )}
            </div>
        </div>
    );
}
