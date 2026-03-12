"use client";

import * as React from "react";
import { useCommunity } from "@/context/community-context";
import type { Discussion, Comment } from "@/lib/mappers/types";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Heart,
  Tag,
  ArrowLeft,
  Calendar,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ReplyCard } from "@/components/features/community/reply-card";
import { BottomReplyBox } from "@/components/features/community/bottom-reply-box";
import { getRepliesUnderRoot } from "@/lib/community/reply-utils";

const getRootReplyOrder = (items: Comment[]): string[] => {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item.parent_id != null) continue;
    const key = String(item.id);
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  return order;
};

const mergeRootReplyOrder = (current: string[], incoming: Comment[]): string[] => {
  if (incoming.length === 0) return current;
  const next = [...current];
  const seen = new Set(current);
  for (const id of getRootReplyOrder(incoming)) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
};

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { addReply, deleteReply } = useCommunity();
  const { user, profile } = useAuth();
  const { promptLogin } = useLoginPrompt();

  const router = useRouter();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [detailRootIdStack, setDetailRootIdStack] = useState<number[]>([]);
  const sheetReplyRef = React.useRef<HTMLTextAreaElement>(null);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const isLoadingMoreRepliesRef = React.useRef(false);
  const [id, setId] = useState<string | number | null>(null);

  // Local state
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Pagination state for replies
  const REPLY_PAGE_SIZE = 10;
  const [replyPage, setReplyPage] = useState(0);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
  const [totalReplies, setTotalReplies] = useState(0);
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [rootReplyOrder, setRootReplyOrder] = useState<string[]>([]);

  // Handle params unwrapping
  useEffect(() => {
    if (unwrappedParams.id) {
      setId(unwrappedParams.id);
    }
  }, [unwrappedParams.id]);

  useEffect(() => {
    setLikedReplies(new Set());
  }, [id]);

  // Fetch discussion (without replies) + first page of replies
  useEffect(() => {
    const controller = new AbortController();
    const fetchDiscussion = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        setNotFound(false);

        const response = await fetch(`/api/discussions/${id}?page=0&pageSize=${REPLY_PAGE_SIZE}`, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          setNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const payload = await response.json();
        const discussionData = payload?.discussion as Discussion | null;
        if (!discussionData) {
          setNotFound(true);
          return;
        }

        setDiscussion(discussionData);
        setRootReplyOrder(getRootReplyOrder(discussionData.replies || []));
        const likedIds = (payload?.likedReplyIds as Array<string | number>) || [];
        setLikedReplies(new Set(likedIds.map((rid) => String(rid))));
        const total = payload?.totalReplies ?? 0;
        setTotalReplies(total);
        setHasMoreReplies(Boolean(payload?.hasMore));
        setReplyPage(1);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        console.error("Exception in fetchDiscussion:", err);
        setNotFound(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchDiscussion();
    return () => controller.abort();
  }, [id]);

  // Load more replies
  const handleLoadMoreReplies = useCallback(async () => {
    if (!discussion || isLoadingMoreRepliesRef.current || !hasMoreReplies) return;
    isLoadingMoreRepliesRef.current = true;
    setIsLoadingMoreReplies(true);

    try {
      const response = await fetch(
        `/api/discussions/${discussion.id}?page=${replyPage}&pageSize=${REPLY_PAGE_SIZE}`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      const newReplies = (payload?.discussion?.replies as Comment[]) || [];
      const likedIds = (payload?.likedReplyIds as Array<string | number>) || [];

      setRootReplyOrder((prev) => mergeRootReplyOrder(prev, newReplies));
      setDiscussion((prev: Discussion | null) => {
        if (!prev) return null;
        return { ...prev, replies: [...prev.replies, ...newReplies] };
      });
      if (likedIds.length > 0) {
        setLikedReplies((prev) => {
          const next = new Set(prev);
          for (const id of likedIds) {
            next.add(String(id));
          }
          return next;
        });
      }
      setReplyPage((prev: number) => prev + 1);
      setHasMoreReplies(Boolean(payload?.hasMore));
      setTotalReplies((prev) => payload?.totalReplies ?? prev);
    } catch (error) {
      console.error("Error loading more replies:", error);
    } finally {
      isLoadingMoreRepliesRef.current = false;
      setIsLoadingMoreReplies(false);
    }
  }, [discussion, hasMoreReplies, replyPage, REPLY_PAGE_SIZE]);

  useEffect(() => {
    if (!hasMoreReplies) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMoreReplies();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [handleLoadMoreReplies, hasMoreReplies]);

  const handleToggleReplyLike = useCallback(
    async (replyId: number | string) => {
      if (!user) {
        promptLogin(
          () => {},
          {
            title: "登录以点赞回复",
            description: "登录后即可点赞喜欢的回复",
          },
        );
        return;
      }

      try {
        const response = await fetch(`/api/replies/${replyId}/like`, { method: "POST" });
        if (!response.ok) throw new Error(await response.text());
        const payload = await response.json();
        const liked = Boolean(payload?.liked);
        const action = payload?.action as "liked" | "unliked" | undefined;
        const delta = action === "liked" ? 1 : action === "unliked" ? -1 : liked ? 1 : -1;
        const key = String(replyId);

        setDiscussion((prev: Discussion | null) => {
          if (!prev) return prev;
          return {
            ...prev,
            replies: prev.replies.map((r) => {
              if (String(r.id) !== key) return r;
              const nextCount = Math.max(0, (r.likes_count ?? 0) + delta);
              return { ...r, likes_count: nextCount };
            }),
          };
        });

        setLikedReplies((prev) => {
          const next = new Set(prev);
          if (liked) next.add(key);
          else next.delete(key);
          return next;
        });
      } catch (error) {
        console.error("Error toggling reply like:", error);
      }
    },
    [user, promptLogin],
  );

  const rootReplyOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    rootReplyOrder.forEach((id, index) => map.set(id, index));
    return map;
  }, [rootReplyOrder]);

  // Scroll to hash anchor on load
  useEffect(() => {
    if (!isLoading && id && typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.substring(1);
      requestAnimationFrame(() => {
        const element = document.getElementById(hash);
        if (element) {
          const headerOffset = 100;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });

          element.classList.add("ring-2", "ring-primary", "ring-offset-2");
          setTimeout(() => {
            element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
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

  const handleSubmitReply = async (
    e: React.FormEvent,
    content: string,
    parentId?: number,
    replyToUserId?: string,
    replyToUsername?: string,
  ) => {
    e.preventDefault();
    if (!content.trim()) return;

    const submitReply = async () => {
      const addedReply = await addReply(
        discussion.id,
        {
          id: 0,
          author: "Me",
          content: content,
          date: "",
          reply_to_user_id: replyToUserId,
          reply_to_username: replyToUsername,
        },
        parentId,
      );

      if (addedReply) {
        setDiscussion((prev: Discussion | null) => {
          if (!prev) return null;
          return {
            ...prev,
            replies: [addedReply, ...prev.replies],
          };
        });
        if (!addedReply.parent_id) {
          const key = String(addedReply.id);
          setRootReplyOrder((prev) => [key, ...prev.filter((id) => id !== key)]);
        }
        // 行内回复的 content 清理在 ReplyItem 内部完成
        setReplyingTo(null);
      }
    };

    if (!user) {
      promptLogin(
        () => {
          submitReply();
        },
        {
          title: "登录以发表回复",
          description: "登录后即可参与讨论，分享你的观点",
        },
      );
      return;
    }

    submitReply();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleDeleteReply = async (replyId: number) => {
    await deleteReply(replyId);
    const key = String(replyId);
    setDiscussion((prev: Discussion | null) => {
      if (!prev) return null;
      const removed = prev.replies.find((r) => String(r.id) === key);
      if (removed && !removed.parent_id) {
        setRootReplyOrder((order) => order.filter((id) => id !== key));
      }
      return {
        ...prev,
        replies: prev.replies.filter((r) => String(r.id) !== key),
      };
    });
  };

  const topLevelReplies = useMemo(() => {
    if (!discussion) return [];
    const roots = discussion.replies.filter((r) => !r.parent_id);
    if (roots.length <= 1) return roots;
    return [...roots].sort((a, b) => {
      const aKey = String(a.id);
      const bKey = String(b.id);
      const aIndex = rootReplyOrderIndex.get(aKey);
      const bIndex = rootReplyOrderIndex.get(bKey);
      if (aIndex != null && bIndex != null) return aIndex - bIndex;
      if (aIndex != null) return -1;
      if (bIndex != null) return 1;
      const t1 = a.created_at ?? "";
      const t2 = b.created_at ?? "";
      if (t2 !== t1) return t2.localeCompare(t1);
      return Number(b.id) - Number(a.id);
    });
  }, [discussion, rootReplyOrderIndex]);

  return (
    <div className="container mx-auto py-6 sm:py-12 px-4 sm:px-6 max-w-4xl pb-28 md:pb-8">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-4 sm:mb-6 pl-0 hover:pl-2 transition-all text-sm"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回讨论列表
      </Button>

      <div className="bg-card border rounded-xl p-4 sm:p-8 shadow-sm mb-6 sm:mb-8">
        {discussion.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            {discussion.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 sm:px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium flex items-center gap-1"
              >
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
            <span
              className={cn(
                "font-medium",
                getNameColorClassName(discussion.authorNameColorId ?? null),
              )}
            >
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
          <p className="text-sm sm:text-lg leading-relaxed whitespace-pre-wrap">
            {discussion.content}
          </p>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-8">
        <h3 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          回复 ({totalReplies})
        </h3>

        {/* 顶级回复列表（平铺，无嵌套；共 N 条回复 入口打开详情 Sheet） */}
        {topLevelReplies.length > 0 ? (
          <div className="bg-card rounded-lg">
            {topLevelReplies.map((reply) => {
              const replyCount = getRepliesUnderRoot(discussion.replies, reply.id).length;
              return (
                <div key={reply.id} className="border-b border-border/60 last:border-0">
                  <ReplyCard
                    reply={reply}
                    showReplyForm={true}
                    readOnly={false}
                    noBorder
                    user={user}
                    profile={profile}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    onSubmitReply={handleSubmitReply}
                    onCancelReply={handleCancelReply}
                    onDeleteReply={handleDeleteReply}
                    isLiked={likedReplies.has(String(reply.id))}
                    onToggleLike={handleToggleReplyLike}
                  />
                  {replyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailRootIdStack([Number(reply.id)]);
                        setReplyingTo(null);
                      }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors py-2.5 pl-3 pr-3 pb-3 rounded-md hover:bg-muted/40 active:bg-muted/60"
                    >
                      共 {replyCount} 条回复
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* 自动加载更多 */}
            {hasMoreReplies && (
              <div
                ref={loadMoreRef}
                className="flex justify-center py-4 text-sm text-muted-foreground"
              >
                {isLoadingMoreReplies ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载中...
                  </span>
                ) : (
                  "上滑加载更多"
                )}
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

      {/* 回复详情 Sheet：栈式钻取 + 查看对话 + 返回 */}
      <Sheet
        open={detailRootIdStack.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRootIdStack([]);
            setReplyingTo(null);
          }
        }}
      >
        <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0 flex flex-row items-center gap-2">
            {detailRootIdStack.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 -ml-2"
                onClick={() => setDetailRootIdStack((prev) => prev.slice(0, -1))}
              >
                <ChevronLeft className="h-5 w-5" />
                <span className="sr-only">返回</span>
              </Button>
            )}
            <SheetTitle className="flex-1">回复详情</SheetTitle>
          </SheetHeader>
          {detailRootIdStack.length > 0 &&
            (() => {
              const currentRootId = detailRootIdStack[detailRootIdStack.length - 1];
              const rootReply = discussion.replies.find(
                (r) => Number(r.id) === Number(currentRootId),
              );
              const detailReplies = getRepliesUnderRoot(discussion.replies, currentRootId);
              if (!rootReply) return null;
              return (
                <>
                  <div className="flex-1 overflow-auto px-4">
                    <ReplyCard
                      reply={rootReply}
                      showReplyForm={false}
                      readOnly={true}
                      user={user}
                      profile={profile}
                      replyingTo={replyingTo}
                      setReplyingTo={setReplyingTo}
                      onSubmitReply={handleSubmitReply}
                      onCancelReply={handleCancelReply}
                      onDeleteReply={handleDeleteReply}
                    />
                    <p className="text-sm text-muted-foreground py-2">
                      相关回复共 {detailReplies.length} 条
                    </p>
                    {detailReplies.map((r) => {
                      const childCount = getRepliesUnderRoot(discussion.replies, r.id).length;
                      return (
                        <div key={r.id} className="border-b border-border/60 last:border-0">
                          <ReplyCard
                            reply={r}
                            showReplyForm={true}
                            readOnly={false}
                            noBorder
                            user={user}
                            profile={profile}
                            replyingTo={replyingTo}
                            setReplyingTo={setReplyingTo}
                            onSubmitReply={handleSubmitReply}
                            onCancelReply={handleCancelReply}
                            onDeleteReply={handleDeleteReply}
                            isLiked={likedReplies.has(String(r.id))}
                            onToggleLike={handleToggleReplyLike}
                          />
                          {childCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDetailRootIdStack((prev) => [...prev, Number(r.id)])
                              }
                              className="text-sm text-primary hover:underline py-2 px-0"
                            >
                              查看对话
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="shrink-0 border-t p-4 bg-background">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const content = sheetReplyRef.current?.value?.trim();
                        if (!content) return;
                        handleSubmitReply(
                          e,
                          content,
                          Number(currentRootId),
                          rootReply.userId,
                          rootReply.author,
                        );
                        if (sheetReplyRef.current) sheetReplyRef.current.value = "";
                      }}
                      className="flex gap-2 items-end"
                    >
                      <textarea
                        ref={sheetReplyRef}
                        placeholder={`回复 @${rootReply.author}...`}
                        className="min-h-[60px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      />
                      <Button type="submit" size="sm" className="shrink-0 h-9">
                        发布
                      </Button>
                    </form>
                  </div>
                </>
              );
            })()}
        </SheetContent>
      </Sheet>

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
