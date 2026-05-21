import { useState, useEffect, useRef, useCallback, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/filter-chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, Flame, Heart, MessageSquare, Tag, Trash2, X } from "lucide-react";
import { useAuth } from '@/lib/context/auth-context';
import { SearchHighlight } from "@/components/ui/search-highlight";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNameColorClassName } from "@/lib/shop/items";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import type { DiscussionListItem } from "@/lib/api/community-discussions";

/** 讨论卡片组件 */
type SortOption = "newest" | "hottest" | "most_replies" | "latest_reply";

const sortFilters: Array<{ label: string; value: SortOption }> = [
    { label: "推荐", value: "hottest" },
    { label: "最新", value: "newest" },
    { label: "精华", value: "most_replies" },
];

const defaultFilterTags = ["科学", "技术", "工程", "艺术", "数学", "自然观察"];

const discussionThumbnails = [
    { src: "/projects/generated/project-0010.webp", alt: "水火箭项目封面" },
    { src: "/birds/images/tarsiger-cyanurus.jpg", alt: "校园鸟类观察封面" },
    { src: "/projects/generated/project-0337.webp", alt: "几何艺术装置封面" },
    { src: "/projects/generated/project-0143.webp", alt: "LED 电路实验封面" },
    { src: "/projects/generated/project-0227.webp", alt: "纸桥工程挑战封面" },
] as const;

const tagToneClassNames = [
    "bg-[hsl(var(--brand-amber)/0.14)] text-[hsl(var(--brand-amber))]",
    "bg-[hsl(var(--brand-blue)/0.12)] text-[hsl(var(--brand-blue))]",
    "bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]",
    "bg-muted text-muted-foreground",
];

function getDiscussionThumbnail(discussion: DiscussionListItem) {
    const signature = `${discussion.title} ${discussion.tags.join(" ")}`.toLowerCase();

    if (/鸟|自然|观察|校园|bird/.test(signature)) return discussionThumbnails[1];
    if (/几何|艺术|美|art/.test(signature)) return discussionThumbnails[2];
    if (/电路|led|电子|技术|circuit/.test(signature)) return discussionThumbnails[3];
    if (/桥|工程|承重|纸/.test(signature)) return discussionThumbnails[4];
    if (/火箭|rocket|水/.test(signature)) return discussionThumbnails[0];

    const rawId = String(discussion.id);
    const hash = rawId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return discussionThumbnails[hash % discussionThumbnails.length];
}

function getTagToneClassName(tag: string, index: number) {
    if (/工程|物理|火箭/.test(tag)) return tagToneClassNames[0];
    if (/科学|技术|电子|电路|水火箭/.test(tag)) return tagToneClassNames[1];
    if (/自然|生物|校园|观察/.test(tag)) return tagToneClassNames[2];
    return tagToneClassNames[index % tagToneClassNames.length];
}

function mergeFilterTags(availableTags: string[]) {
    return Array.from(new Set([...defaultFilterTags, ...availableTags.filter(Boolean)]));
}

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
    const thumbnail = getDiscussionThumbnail(discussion);

    return (
        <article className="surface-card group relative overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--surface-border-strong))]">
            <Link
                href={`/community/discussion/${discussion.id}`}
                className="absolute inset-0 z-10 rounded-[18px]"
                aria-label={`进入讨论：${discussion.title}`}
            />

            <div className="pointer-events-none relative z-0 grid grid-cols-[minmax(112px,32%)_minmax(0,1fr)] gap-3 p-3 min-[420px]:grid-cols-[minmax(138px,31%)_minmax(0,1fr)] md:grid-cols-[220px_minmax(0,1fr)] md:gap-5 md:p-4">
                <div className="relative min-h-[112px] overflow-hidden rounded-[14px] bg-muted md:min-h-[132px]">
                    <OptimizedImage
                        src={thumbnail.src}
                        alt={thumbnail.alt}
                        fill
                        variant="thumbnail"
                        className="object-cover transition duration-500 group-hover:scale-105"
                    />
                </div>

                <div className="flex min-w-0 flex-col justify-center md:py-1">
                    <h3 className="line-clamp-2 text-[17px] font-semibold leading-6 tracking-normal text-foreground transition-colors group-hover:text-primary md:text-[20px] md:leading-7">
                        <SearchHighlight text={discussion.title} query={searchQuery} />
                    </h3>

                    <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground md:text-[15px]">
                        <SearchHighlight text={discussion.content} query={searchQuery} />
                    </p>

                    {(previewTags.length > 0 || overflowTagCount > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 md:mt-3 md:gap-2">
                            {previewTags.map((tag, index) => (
                                <span
                                    key={tag}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] font-semibold leading-none",
                                        getTagToneClassName(tag, index)
                                    )}
                                >
                                    <Tag className="hidden h-3 w-3 shrink-0 md:block" />
                                    {tag}
                                </span>
                            ))}
                            {overflowTagCount > 0 && (
                                <span className="inline-flex items-center rounded-[6px] bg-muted px-2 py-1 text-[11px] font-semibold leading-none text-muted-foreground">
                                    +{overflowTagCount}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground md:mt-3 md:gap-x-5">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                            <AvatarWithFrame
                                src={discussion.authorAvatar}
                                fallback={discussion.author[0]}
                                avatarFrameId={discussion.authorAvatarFrameId}
                                className="size-5 shrink-0"
                            />
                            <span className={cn("truncate", getNameColorClassName(discussion.authorNameColorId ?? null))}>
                                {discussion.author}
                            </span>
                        </span>
                        <span className="whitespace-nowrap">{discussion.date}</span>
                        <span className="ml-auto inline-flex items-center gap-1.5 whitespace-nowrap md:ml-0">
                            <MessageSquare className="h-4 w-4" />
                            {discussion.repliesCount} 回复
                        </span>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <Heart className="h-4 w-4" />
                            {discussion.likes} 赞
                        </span>
                        {canDelete && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="pointer-events-auto relative z-20 ml-auto h-auto p-0 hover:bg-transparent hover:text-destructive"
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

function DiscussionFilters({
    availableTags,
    selectedTag,
    sortBy,
    onSelectTag,
    onSelectSort,
}: {
    availableTags: string[];
    selectedTag: string | null;
    sortBy: SortOption;
    onSelectTag: (tag: string | null) => void;
    onSelectSort: (sort: SortOption) => void;
}) {
    const mergedTags = mergeFilterTags(availableTags);
    const visibleTags = mergedTags.slice(0, 5);
    const overflowTags = mergedTags.slice(5);

    return (
        <div className="space-y-3">
            <div className="no-scrollbar overflow-x-auto pb-1">
                <div className="flex w-max min-w-full items-center gap-2 py-px">
                    {sortFilters.map((filter) => (
                        <FilterChip
                            key={filter.value}
                            onClick={() => onSelectSort(filter.value)}
                            active={sortBy === filter.value}
                            solid={sortBy === filter.value}
                            size="md"
                            shape="pill"
                        >
                            {filter.label}
                        </FilterChip>
                    ))}

                    {visibleTags.map((tag) => (
                        <FilterChip
                            key={tag}
                            onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                            active={selectedTag === tag}
                            size="md"
                            shape="pill"
                        >
                            {tag}
                        </FilterChip>
                    ))}

                    {overflowTags.length > 0 ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "filter-chip-base h-10 items-center justify-center gap-1 rounded-full px-4 text-sm md:h-9",
                                        selectedTag && overflowTags.includes(selectedTag)
                                            ? "filter-chip-active"
                                            : "filter-chip-idle"
                                    )}
                                >
                                    {selectedTag && overflowTags.includes(selectedTag) ? selectedTag : "全部标签"}
                                    <ChevronDown className="h-4 w-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                                <DropdownMenuItem onClick={() => onSelectTag(null)}>全部标签</DropdownMenuItem>
                                {overflowTags.map((tag) => (
                                    <DropdownMenuItem key={tag} onClick={() => onSelectTag(tag)}>
                                        {tag}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                </div>
            </div>

            {selectedTag ? (
                <button
                    type="button"
                    onClick={() => onSelectTag(null)}
                    className="filter-chip-base filter-chip-active h-8 w-fit rounded-full px-3 text-xs"
                    aria-label={`清除筛选：${selectedTag}`}
                >
                    已筛选「{selectedTag}」
                    <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
            ) : null}
        </div>
    );
}

export function DiscussionList({
    tabsSlot,
    initialDiscussions = [],
    initialHasMore = true,
    initialAvailableTags = [],
    initialDataLoaded = false,
    initialTagsLoaded = false,
}: {
    tabsSlot?: ReactNode;
    initialDiscussions?: DiscussionListItem[];
    initialHasMore?: boolean;
    initialAvailableTags?: string[];
    initialDataLoaded?: boolean;
    initialTagsLoaded?: boolean;
} = {}) {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState("");

    const [discussions, setDiscussions] = useState<DiscussionListItem[]>(initialDiscussions);
    const pageRef = useRef(initialDataLoaded ? 1 : 0);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const isLoadingRef = useRef(false);
    const rootRef = useRef<HTMLElement>(null);

    // Search and filter states
    const searchQuery = "";
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortOption>("hottest");
    const [availableTags, setAvailableTags] = useState<string[]>(initialAvailableTags);
    const shouldSkipInitialFetchRef = useRef(initialDataLoaded);

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
    }, [selectedTag, sortBy, toast]);

    // Fetch all discussions tags for filter
    useEffect(() => {
        if (initialTagsLoaded) return;

        const fetchTags = async () => {
            const response = await fetch("/api/discussions/tags");
            if (!response.ok) return;
            const payload = await response.json();
            setAvailableTags((payload?.tags as string[]) || []);
        };
        fetchTags();
    }, [initialTagsLoaded]);

    // Trigger fetch when search/filter changes
    useEffect(() => {
        if (shouldSkipInitialFetchRef.current) {
            shouldSkipInitialFetchRef.current = false;
            return;
        }

        fetchDiscussions(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTag, sortBy]);

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

    const handleSubmit = async (e: FormEvent) => {
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

    const canModerate = profile?.role === 'admin' || profile?.role === 'moderator';
    const toggleCreateDiscussion = () => {
        if (!user) {
            window.location.href = "/login";
            return;
        }

        const shouldOpen = !isCreating;
        setIsCreating(shouldOpen);

        if (shouldOpen) {
            requestAnimationFrame(() => {
                rootRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            });
        }
    };

    useEffect(() => {
        const handleTrigger = () => {
            if (!isCreating) {
                toggleCreateDiscussion();
            }
        };
        window.addEventListener('trigger-create-discussion', handleTrigger);
        return () => window.removeEventListener('trigger-create-discussion', handleTrigger);
    }, [isCreating, toggleCreateDiscussion]);

    return (
        <>
            <section ref={rootRef} className="surface-panel overflow-hidden">
                <div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-border/60 px-4 md:px-6">
                    {tabsSlot ?? (
                        <div>
                            <h2 className="text-xl font-semibold tracking-normal text-foreground">讨论区</h2>
                        </div>
                    )}
                    {user ? (
                        <Button
                            onClick={toggleCreateDiscussion}
                            className="hidden h-10 shrink-0 rounded-full px-4 text-sm font-semibold md:inline-flex md:h-11 md:px-5"
                        >
                            {isCreating ? "取消发布" : "发起讨论"}
                        </Button>
                    ) : null}
                </div>

                <div className="space-y-5 p-4 md:p-6 md:pt-5">
                    <DiscussionFilters
                        availableTags={availableTags}
                        selectedTag={selectedTag}
                        sortBy={sortBy}
                        onSelectTag={setSelectedTag}
                        onSelectSort={setSortBy}
                    />

                    {isCreating && (
                    <form onSubmit={handleSubmit} className="surface-subtle space-y-4 p-4 sm:p-5">
                        <div>
                            <p className="section-kicker">新讨论</p>
                            <h3 className="mt-2 text-lg font-semibold text-foreground">把你的问题描述清楚</h3>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                标题尽量具体，内容里写清背景、现状和你希望得到的帮助。
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">标题</label>
                            <Input
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="请输入标题..."
                                className="h-11 rounded-2xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">内容</label>
                            <Textarea
                                value={newContent}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewContent(e.target.value)}
                                placeholder="详细描述你的问题或想法..."
                                className="min-h-[132px] rounded-2xl"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">标签（用逗号分隔）</label>
                            <Input
                                value={newTags}
                                onChange={(e) => setNewTags(e.target.value)}
                                placeholder="例如: 科学, 实验, 求助"
                                className="h-11 rounded-2xl"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="dark:text-[#f6f9ff] dark:hover:bg-white/[0.12] dark:hover:text-white"
                                onClick={() => setIsCreating(false)}
                            >
                                取消
                            </Button>
                            <Button type="submit">发布</Button>
                        </div>
                    </form>
                    )}

                    <div>
                    {loadError ? (
                        <div className="surface-subtle px-6 py-12 text-center">
                            <p className="section-kicker">加载异常</p>
                            <h3 className="mt-3 text-lg font-semibold">讨论列表加载失败</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{loadError}</p>
                            <Button className="mt-4" onClick={() => void fetchDiscussions(true)}>
                                重试
                            </Button>
                        </div>
                    ) : discussions.length > 0 ? (
                        <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center gap-2 pt-1">
                                <Flame className="h-5 w-5 fill-[hsl(var(--brand-amber))] text-[hsl(var(--brand-amber))]" />
                                <h2 className="text-[18px] font-semibold text-foreground">热门讨论</h2>
                            </div>
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
                                <div className="surface-subtle px-4 py-4 text-center text-sm text-muted-foreground">
                                    正在加载更多讨论...
                                </div>
                            )}
                            {!hasMore && discussions.length > 0 && (
                                <div className="px-2 py-3 text-center text-sm font-medium text-muted-foreground">
                                    已显示全部讨论
                                </div>
                            )}
                        </div>
                    ) : !isLoading ? (
                        <div className="surface-subtle px-6 py-12 text-center">
                            <p className="section-kicker">当前为空</p>
                            <h3 className="mt-3 text-lg font-semibold">没有找到相关讨论</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {selectedTag ? '换个关键词或标签试试看？' : '还没有讨论，来发起第一个吧！'}
                            </p>
                        </div>
                    ) : (
                        <div className="surface-subtle px-4 py-4 text-center text-sm text-muted-foreground">
                            正在加载讨论...
                        </div>
                    )}
                    </div>
                </div>
            </section>
        </>
    );
}
