import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Discussion } from "@/lib/mappers/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Heart, Tag, Trash2 } from "lucide-react";
import { useAuth } from '@/lib/context/auth-context';
import { DiscussionSearch, SortOption } from "./discussion-search";
import { SearchHighlight } from "@/components/ui/search-highlight";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { getNameColorClassName } from "@/lib/shop/items";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";

/** 讨论卡片组件 */
type DiscussionListItem = Omit<Discussion, "replies"> & { repliesCount: number };

function DiscussionCard({
    discussion,
    searchQuery,
    canDelete,
    onDelete,
}: {
    discussion: DiscussionListItem;
    searchQuery: string;
    canDelete: boolean;
    onDelete: (id: string | number) => void;
}) {
    const previewTags = discussion.tags.slice(0, 2);
    const overflowTagCount = Math.max(discussion.tags.length - previewTags.length, 0);

    return (
        <article className="group relative overflow-hidden rounded-[24px] border border-border/70 bg-card/88 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.24)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_55px_-28px_rgba(15,23,42,0.32)]">
            <Link
                href={`/community/discussion/${discussion.id}`}
                className="absolute inset-0 z-10 rounded-[24px]"
                aria-label={`进入讨论：${discussion.title}`}
            />

            <div className="relative z-0 flex flex-col gap-4 bg-gradient-to-br from-background via-background to-muted/20 p-5 sm:p-6 pointer-events-none">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <AvatarWithFrame
                        src={discussion.authorAvatar}
                        fallback={discussion.author[0]}
                        avatarFrameId={discussion.authorAvatarFrameId}
                        className="size-9 shrink-0"
                    />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="section-kicker text-[10px] tracking-[0.24em]">社区讨论</span>
                            <span className={cn("truncate", getNameColorClassName(discussion.authorNameColorId ?? null))}>
                                {discussion.author}
                            </span>
                            <span>·</span>
                            <span>{discussion.date}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="pr-2 text-lg font-semibold leading-snug transition-colors group-hover:text-primary sm:text-xl">
                        <SearchHighlight text={discussion.title} query={searchQuery} />
                    </h3>

                    <p className="line-clamp-3 text-sm leading-7 text-muted-foreground sm:text-[15px]">
                        <SearchHighlight text={discussion.content} query={searchQuery} />
                    </p>
                </div>

                {(previewTags.length > 0 || overflowTagCount > 0) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {previewTags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-medium text-primary"
                            >
                                <Tag className="h-3 w-3 shrink-0" />
                                {tag}
                            </span>
                        ))}
                        {overflowTagCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                +{overflowTagCount} 个话题
                            </span>
                        )}
                    </div>
                )}

                <div className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
                    <div className="relative z-20 flex items-center gap-5 pointer-events-auto">
                        <span className="inline-flex items-center gap-2 text-sm">
                            <MessageSquare className="h-4 w-4" />
                            {discussion.repliesCount} 回复
                        </span>
                        <span className="inline-flex items-center gap-2 text-sm">
                            <Heart className="h-4 w-4" />
                            {discussion.likes} 赞
                        </span>
                        {canDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto h-auto p-0 hover:bg-transparent hover:text-destructive"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDelete(discussion.id);
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

export function DiscussionList() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState("");

    const [discussions, setDiscussions] = useState<DiscussionListItem[]>([]);
    const pageRef = useRef(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const isLoadingRef = useRef(false);

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
            setLoadError(null);

            const PAGE_SIZE = 10;
            const currentPage = reset ? 0 : pageRef.current;
            const params = new URLSearchParams({
                page: String(currentPage),
                pageSize: String(PAGE_SIZE),
                sort: sortBy,
            });
            if (searchQuery) params.set("q", searchQuery);
            if (selectedTag) params.set("tag", selectedTag);

            const response = await fetch(`/api/discussions?${params.toString()}`);
            if (!response.ok) {
                throw new Error(await response.text());
            }

            const payload = await response.json();
            const mappedDiscussions: DiscussionListItem[] = (payload?.discussions as DiscussionListItem[]) || [];

            if (reset) {
                setDiscussions(mappedDiscussions);
                pageRef.current = 1;
            } else {
                setDiscussions((prev) => [...prev, ...mappedDiscussions]);
                pageRef.current += 1;
            }

            setHasMore(Boolean(payload?.hasMore));
        } catch (err) {
            logger.error('Exception in fetchDiscussions', { error: err });
            const message = '无法加载讨论列表，请稍后重试';
            setLoadError(message);
            toast({ title: '加载失败', description: message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery, selectedTag, sortBy, toast]);

    // Fetch all discussions tags for filter
    useEffect(() => {
        const fetchTags = async () => {
            const response = await fetch("/api/discussions/tags");
            if (!response.ok) return;
            const payload = await response.json();
            setAvailableTags((payload?.tags as string[]) || []);
        };
        fetchTags();
    }, []);

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

        try {
            const response = await fetch("/api/discussions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle,
                    content: newContent,
                    tags: newTags.split(",").map(t => t.trim()).filter(t => t),
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(typeof payload?.error === "string" ? payload.error : "发布讨论失败");
            }

            setNewTitle("");
            setNewContent("");
            setNewTags("");
            setIsCreating(false);
            await fetchDiscussions(true);
        } catch (error) {
            toast({
                title: "发布失败",
                description: error instanceof Error ? error.message : "发布讨论失败，请稍后重试",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string | number) => {
        try {
            const response = await fetch(`/api/discussions/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(typeof payload?.error === "string" ? payload.error : "删除讨论失败");
            }

            setDiscussions(prev => prev.filter(d => d.id !== id));
        } catch (error) {
            toast({
                title: "删除失败",
                description: error instanceof Error ? error.message : "删除讨论失败，请稍后重试",
                variant: "destructive",
            });
        }
    };

    const handleSearch = (query: string, tag: string | null, sort: SortOption) => {
        setSearchQuery(query);
        setSelectedTag(tag);
        setSortBy(sort);
    };

    const canModerate = profile?.role === 'admin' || profile?.role === 'moderator';

    return (
        <div className="space-y-4 pb-24 md:space-y-6 md:pb-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="section-kicker hidden md:block">交流与沉淀</p>
                    <h2 className="text-xl font-semibold tracking-tight md:mt-2 md:text-2xl">讨论区</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        用问题、经验和做法组织讨论，保持内容比装饰更靠前。
                    </p>
                </div>
                {user ? (
                    <Button
                        onClick={() => {
                            setIsCreating(!isCreating);
                            if (!isCreating) {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                        }}
                        className="w-full rounded-full md:w-auto"
                    >
                        {isCreating ? "取消发布" : "发起讨论"}
                    </Button>
                ) : null}
            </div>

            {/* Search Component */}
            <DiscussionSearch
                onSearch={handleSearch}
                availableTags={availableTags}
            />

            {isCreating && (
                <form onSubmit={handleSubmit} className="surface-panel space-y-4 rounded-[24px] p-5 sm:p-6">
                    <div>
                        <p className="section-kicker">新讨论</p>
                        <h3 className="mt-2 text-lg font-semibold">把你的问题描述清楚</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            标题尽量具体，内容里写清背景、现状和你希望得到的帮助。
                        </p>
                    </div>
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
                        <label className="text-sm font-medium">标签（用逗号分隔）</label>
                        <Input
                            value={newTags}
                            onChange={(e) => setNewTags(e.target.value)}
                            placeholder="例如: 科学, 实验, 求助"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>取消</Button>
                        <Button type="submit">发布</Button>
                    </div>
                </form>
            )}

            <div>
                {loadError ? (
                    <div className="surface-panel rounded-[24px] px-6 py-12 text-center">
                        <p className="section-kicker">加载异常</p>
                        <h3 className="mt-3 text-lg font-semibold">讨论列表加载失败</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{loadError}</p>
                        <Button className="mt-4" onClick={() => void fetchDiscussions(true)}>
                            重试
                        </Button>
                    </div>
                ) : discussions.length > 0 ? (
                    <div className="space-y-3 sm:space-y-4">
                        {discussions.map((discussion) => (
                            <DiscussionCard
                                key={discussion.id}
                                discussion={discussion}
                                searchQuery={searchQuery}
                                canDelete={Boolean(canModerate || user?.id === discussion.authorId)}
                                onDelete={handleDelete}
                            />
                        ))}
                        {/* Scroll sentinel for infinite loading */}
                        <div ref={sentinelRef} className="h-1" />
                        {isLoading && (
                            <div className="surface-subtle rounded-2xl px-4 py-4 text-center text-sm text-muted-foreground">
                                正在加载更多讨论...
                            </div>
                        )}
                        {!hasMore && discussions.length > 0 && (
                            <div className="px-2 py-4 text-center text-xs text-muted-foreground">已经到底了</div>
                        )}
                    </div>
                ) : !isLoading ? (
                    <div className="surface-panel rounded-[24px] px-6 py-12 text-center">
                        <p className="section-kicker">当前为空</p>
                        <h3 className="mt-3 text-lg font-semibold">没有找到相关讨论</h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {searchQuery || selectedTag ? '换个关键词或标签试试看？' : '还没有讨论，来发起第一个吧！'}
                        </p>
                    </div>
                ) : (
                    <div className="surface-subtle rounded-2xl px-4 py-4 text-center text-sm text-muted-foreground">
                        正在加载讨论...
                    </div>
                )}
            </div>
        </div>
    );
}
