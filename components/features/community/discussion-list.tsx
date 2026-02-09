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

export function DiscussionList() {
    const { user, profile } = useAuth();
    const { promptLogin } = useLoginPrompt();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState("");

    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const isLoadingRef = useRef(false);
    const observer = useRef<IntersectionObserver | null>(null);
    const supabase = createClient();

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

            // Use functional update to get the latest page value
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
                    profiles:author_id (display_name)
                `);

            // Text search - search in title and content
            if (searchQuery) {
                query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
            }

            // Tag filter
            if (selectedTag) {
                query = query.contains('tags', [selectedTag]);
            }

            // Sorting
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

            const mappedDiscussions: Discussion[] = data.map((d: any) => ({
                id: d.id,
                title: d.title,
                author: d.profiles?.display_name || 'Unknown',
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
            // 确保无论成功失败都重置loading状态
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
                const allTags = (data as any[]).flatMap(d => d.tags || []);
                const uniqueTags = Array.from(new Set(allTags)).slice(0, 10); // Limit to 10 most common
                setAvailableTags(uniqueTags);
            }
        };
        fetchTags();
    }, [supabase]);

    // Initial load
    useEffect(() => {
        fetchDiscussions(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array = only run on mount

    // Trigger fetch when search/filter changes
    useEffect(() => {
        fetchDiscussions(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, selectedTag, sortBy]);

    const lastDiscussionElementRef = useCallback((node: HTMLDivElement) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                fetchDiscussions(false);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoading, hasMore, fetchDiscussions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim() || !newContent.trim() || !user) return;

        const { error } = await (supabase
            .from('discussions') as any)
            .insert({
                title: newTitle,
                content: newContent,
                author_id: user.id,
                tags: newTags.split(",").map(t => t.trim()).filter(t => t)
            });

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
        // fetchDiscussions will be triggered by useEffect
    };

    return (
        <div className="space-y-6">
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
                        // Optional: Scroll to form
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

            <div className="space-y-4">
                {discussions.map((discussion, index) => {
                    const content = (
                        <div className="border rounded-lg p-6 hover:shadow-md transition-all bg-white/70 dark:bg-gray-800/70 backdrop-blur-md hover:scale-105 cursor-pointer group relative">
                            <Link href={`/community/discussion/${discussion.id}`} className="absolute inset-0" />
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                                        <SearchHighlight text={discussion.title} query={searchQuery} />
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            👤 {discussion.author}
                                        </span>
                                        <span>{discussion.date}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    {discussion.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-full text-xs flex items-center gap-1">
                                            <Tag className="h-3 w-3" /> {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-muted-foreground mb-4 line-clamp-2">
                                <SearchHighlight text={discussion.content} query={searchQuery} />
                            </p>
                            <div className="flex items-center gap-6 text-sm text-muted-foreground border-t pt-4 relative z-10">
                                <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                                    <MessageSquare className="h-4 w-4" />
                                    {discussion.replies.length} 回复
                                </Button>
                                <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent hover:text-red-500">
                                    <Heart className="h-4 w-4" />
                                    {discussion.likes} 赞
                                </Button>
                                {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 hover:bg-transparent hover:text-destructive ml-auto relative z-20"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDelete(discussion.id);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    );

                    if (discussions.length === index + 1) {
                        return <div ref={lastDiscussionElementRef} key={discussion.id}>{content}</div>;
                    } else {
                        return <div key={discussion.id}>{content}</div>;
                    }
                })}

                {isLoading && (
                    <div className="text-center py-4 text-muted-foreground">加载中...</div>
                )}

                {!isLoading && discussions.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-lg font-semibold mb-2">没有找到相关讨论</h3>
                        <p className="text-muted-foreground">
                            {searchQuery || selectedTag ? '换个关键词或标签试试看？' : '还没有讨论，来发起第一个吧！'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
