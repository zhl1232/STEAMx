"use client";

import * as React from "react";
import { useCommunity } from "@/context/community-context";
import type { Discussion, Comment, ReplyTarget } from "@/lib/mappers/types";
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
  Pencil,
} from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { getNameColorClassName } from "@/lib/shop/items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommentCard } from "@/components/features/shared/comment-card";
import { BottomReplyBox } from "@/components/features/shared/bottom-reply-box";
import { ReportDialog } from "@/components/ui/report-dialog";
import { getRepliesUnderRoot } from "@/lib/community/reply-utils";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

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

const mergeRepliesById = (current: Comment[], incoming: Comment[]): Comment[] => {
  const merged = new Map<string, Comment>();
  for (const reply of [...current, ...incoming]) {
    merged.set(String(reply.id), reply);
  }
  return Array.from(merged.values());
};

const getReplyThreadIds = (items: Comment[], rootId: string | number): Set<string> => {
  const byParent = new Map<string, string[]>();
  for (const item of items) {
    if (item.parent_id == null) continue;
    const parentKey = String(item.parent_id);
    const ownKey = String(item.id);
    const siblings = byParent.get(parentKey);
    if (siblings) siblings.push(ownKey);
    else byParent.set(parentKey, [ownKey]);
  }

  const rootKey = String(rootId);
  const toVisit = [rootKey];
  const visited = new Set<string>();

  while (toVisit.length > 0) {
    const current = toVisit.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const children = byParent.get(current) || [];
    for (const child of children) {
      toVisit.push(child);
    }
  }

  return visited;
};

export default function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { addReply, deleteReply } = useCommunity();
  const { user, profile } = useAuth();
  const { level } = useGamification();
  const { promptLogin } = useLoginPrompt();

  const canUploadImage = level >= 2;

  const router = useRouter();
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [sheetReplyTarget, setSheetReplyTarget] = useState<ReplyTarget | null>(null);
  const [detailRootIdStack, setDetailRootIdStack] = useState<number[]>([]);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const isLoadingMoreRepliesRef = React.useRef(false);
  const [id, setId] = useState<string | number | null>(null);

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const REPLY_PAGE_SIZE = 10;
  const [replyPage, setReplyPage] = useState(0);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [isLoadingMoreReplies, setIsLoadingMoreReplies] = useState(false);
  const [totalReplies, setTotalReplies] = useState(0);
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [discussionLiked, setDiscussionLiked] = useState(false);
  const [rootReplyOrder, setRootReplyOrder] = useState<string[]>([]);

  useEffect(() => {
    if (unwrappedParams.id) {
      setId(unwrappedParams.id);
    }
  }, [unwrappedParams.id]);

  useEffect(() => {
    setLikedReplies(new Set());
  }, [id]);

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
        setDiscussionLiked(Boolean(payload?.discussionLiked));
        const total = payload?.totalReplies ?? 0;
        setTotalReplies(total);
        setHasMoreReplies(Boolean(payload?.hasMore));
        setReplyPage(1);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        logger.error("Exception in fetchDiscussion", { error: err });
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
        return { ...prev, replies: mergeRepliesById(prev.replies, newReplies) };
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
      logger.error("Error loading more replies", { error });
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

  const handleToggleDiscussionLike = useCallback(async () => {
    if (!discussion) return;
    if (!user) {
      promptLogin(() => {}, {
        title: "登录以点赞讨论",
        description: "登录后即可点赞喜欢的讨论",
      });
      return;
    }

    try {
      const response = await fetch(`/api/discussions/${discussion.id}/like`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const payload = await response.json();
      const liked = Boolean(payload?.liked);
      const action = payload?.action as "liked" | "unliked" | undefined;
      const delta = action === "liked" ? 1 : action === "unliked" ? -1 : liked ? 1 : -1;

      setDiscussionLiked(liked);
      setDiscussion((prev: Discussion | null) => {
        if (!prev) return prev;
        return { ...prev, likes: Math.max(0, prev.likes + delta) };
      });
    } catch (error) {
      logger.error("Error toggling discussion like", { error });
    }
  }, [discussion, user, promptLogin]);

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
        logger.error("Error toggling reply like", { error });
      }
    },
    [user, promptLogin],
  );

  const handleEditReply = useCallback(
    async (replyId: number | string, content: string) => {
      const res = await fetch(`/api/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDiscussion((prev: Discussion | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          replies: prev.replies.map((r) =>
            String(r.id) === String(replyId)
              ? { ...r, content, updated_at: new Date().toISOString() }
              : r,
          ),
        };
      });
    },
    [],
  );

  const [isEditingDiscussion, setIsEditingDiscussion] = useState(false);
  const [editDiscussionTitle, setEditDiscussionTitle] = useState("");
  const [editDiscussionContent, setEditDiscussionContent] = useState("");
  const [isSavingDiscussion, setIsSavingDiscussion] = useState(false);

  const handleStartEditDiscussion = useCallback(() => {
    if (!discussion) return;
    setEditDiscussionTitle(discussion.title);
    setEditDiscussionContent(discussion.content);
    setIsEditingDiscussion(true);
  }, [discussion]);

  const handleSaveDiscussion = useCallback(async () => {
    if (!discussion || !editDiscussionTitle.trim() || !editDiscussionContent.trim()) return;
    setIsSavingDiscussion(true);
    try {
      const res = await fetch(`/api/discussions/${discussion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editDiscussionTitle.trim(), content: editDiscussionContent.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setDiscussion((prev: Discussion | null) => {
        if (!prev) return prev;
        return { ...prev, title: editDiscussionTitle.trim(), content: editDiscussionContent.trim() };
      });
      setIsEditingDiscussion(false);
    } catch (err) {
      logger.error("Error editing discussion", { error: err });
    } finally {
      setIsSavingDiscussion(false);
    }
  }, [discussion, editDiscussionTitle, editDiscussionContent]);

  const rootReplyOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    rootReplyOrder.forEach((id, index) => map.set(id, index));
    return map;
  }, [rootReplyOrder]);

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

  const PREVIEW_REPLY_MAX = 3;
  const PREVIEW_LIKES_SHOW_2 = 3;
  const PREVIEW_LIKES_SHOW_3 = 8;

  const childrenByParent = useMemo(() => {
    if (!discussion) return new Map<number, Comment[]>();
    const map = new Map<number, Comment[]>();
    for (const r of discussion.replies) {
      if (r.parent_id == null) continue;
      const pid = Number(r.parent_id);
      if (Number.isNaN(pid)) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(r);
    }
    return map;
  }, [discussion]);

  const getDirectReplies = useCallback(
    (rootId: number | string): Comment[] => {
      const rid = Number(rootId);
      if (Number.isNaN(rid)) return [];
      const children = childrenByParent.get(rid) || [];
      return [...children].sort((a, b) => {
        const t1 = a.created_at ?? "";
        const t2 = b.created_at ?? "";
        return t1.localeCompare(t2);
      });
    },
    [childrenByParent],
  );

  const getPreviewCount = useCallback(
    (replies: Comment[]) => {
      if (replies.length === 0) return 0;
      const totalLikes = replies.reduce((sum, r) => sum + (r.likes_count ?? 0), 0);
      if (totalLikes <= 0) return 0;
      if (totalLikes >= PREVIEW_LIKES_SHOW_3) return Math.min(PREVIEW_REPLY_MAX, replies.length);
      if (totalLikes >= PREVIEW_LIKES_SHOW_2) return Math.min(2, replies.length);
      return 1;
    },
    [],
  );

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
        <Button onClick={() => router.back()}>返回上一页</Button>
      </div>
    );
  }

  const handleSubmitReply = async (
    e: React.FormEvent,
    content: string,
    parentId?: number,
    replyToUserId?: string,
    replyToUsername?: string,
    imageUrl?: string,
  ) => {
    e.preventDefault();
    if (!content.trim() && !imageUrl) return;

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
          image_url: imageUrl || null,
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
        setReplyTarget(null);
        setSheetReplyTarget(null);
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

  const handleDeleteReply = async (replyId: number) => {
    if (!discussion) return;
    const idsToRemove = getReplyThreadIds(discussion.replies, replyId);
    await deleteReply(replyId);
    setDiscussion((prev: Discussion | null) => {
      if (!prev) return null;
      return {
        ...prev,
        replies: prev.replies.filter((reply) => !idsToRemove.has(String(reply.id))),
      };
    });
    setRootReplyOrder((order) => order.filter((id) => !idsToRemove.has(id)));
    setLikedReplies((prev) => {
      const next = new Set(prev);
      for (const id of idsToRemove) {
        next.delete(id);
      }
      return next;
    });
    setTotalReplies((prev) => Math.max(0, prev - idsToRemove.size));
    setDetailRootIdStack((prev) => prev.filter((id) => !idsToRemove.has(String(id))));
    if (replyTarget && idsToRemove.has(String(replyTarget.id))) {
      setReplyTarget(null);
    }
    if (sheetReplyTarget && idsToRemove.has(String(sheetReplyTarget.id))) {
      setSheetReplyTarget(null);
    }
  };

  const handleReply = (target: ReplyTarget) => {
    setReplyTarget(target);
  };

  const handleSheetReply = (target: ReplyTarget) => {
    setSheetReplyTarget(target);
  };

  return (
    <div className="container mx-auto py-6 sm:py-12 px-4 sm:px-6 max-w-4xl pb-28 md:pb-8">
      <MobilePageHeader
        title={discussion.title}
        fallbackHref="/community"
        className="-mx-4 -mt-6 mb-4 md:hidden"
      />

      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="hidden mb-4 pl-0 hover:pl-2 transition-all text-sm md:mb-6 md:inline-flex"
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

        {isEditingDiscussion ? (
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={editDiscussionTitle}
              onChange={(e) => setEditDiscussionTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-xl sm:text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              maxLength={200}
              disabled={isSavingDiscussion}
            />
            <textarea
              value={editDiscussionContent}
              onChange={(e) => setEditDiscussionContent(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm sm:text-lg leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              rows={6}
              maxLength={5000}
              disabled={isSavingDiscussion}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveDiscussion} disabled={isSavingDiscussion || !editDiscussionTitle.trim() || !editDiscussionContent.trim()}>
                保存
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingDiscussion(false)} disabled={isSavingDiscussion}>
                取消
              </Button>
            </div>
          </div>
        ) : (
          <>
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
              <button
                type="button"
                onClick={handleToggleDiscussionLike}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 transition-colors",
                  discussionLiked
                    ? "text-red-500"
                    : "text-muted-foreground hover:text-red-500",
                )}
              >
                <Heart
                  className={cn(
                    "h-3.5 w-3.5 sm:h-4 sm:w-4",
                    discussionLiked && "fill-current",
                  )}
                />
                {discussion.likes}
              </button>
              {user && user.id === discussion.authorId && (
                <button
                  type="button"
                  onClick={handleStartEditDiscussion}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                  title="编辑讨论"
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">编辑</span>
                </button>
              )}
              {user && user.id !== discussion.authorId && (
                <ReportDialog contentType="discussion" contentId={discussion.id} />
              )}
            </div>

            <div className="prose dark:prose-invert max-w-none">
              <p className="text-sm sm:text-lg leading-relaxed whitespace-pre-wrap">
                {discussion.content}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 sm:space-y-8">
        <h3 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
          回复 ({totalReplies})
        </h3>

        {topLevelReplies.length > 0 ? (
          <div className="bg-card rounded-lg">
            {topLevelReplies.map((reply) => {
              const replyCount = getRepliesUnderRoot(discussion.replies, reply.id).length;
              const directReplies = getDirectReplies(reply.id);
              const previewCount = getPreviewCount(directReplies);
              const previewReplies = directReplies.slice(0, previewCount);
              return (
                <div key={reply.id} className="border-b border-border/60 last:border-0">
                  <CommentCard
                    comment={reply}
                    showReplyButton
                    noBorder
                    anchorId={`reply-${reply.id}`}
                    user={user}
                    profile={profile}
                    replyTarget={replyTarget}
                    onReply={handleReply}
                    onDelete={handleDeleteReply}
                    onEdit={handleEditReply}
                    isLiked={likedReplies.has(String(reply.id))}
                    onToggleLike={handleToggleReplyLike}
                    reportContentType="discussion_reply"
                  />
                  {previewReplies.length > 0 && (
                    <div className="ml-12 sm:ml-16 pl-4 border-l border-border/60 mt-1">
                      {previewReplies.map((sub) => (
                        <div
                          key={sub.id}
                          className="border-b border-border/60 last:border-0"
                        >
                          <CommentCard
                            comment={sub}
                            showReplyButton
                            noBorder
                            compact
                            user={user}
                            profile={profile}
                            isLiked={likedReplies.has(String(sub.id))}
                            replyTarget={replyTarget}
                            onToggleLike={handleToggleReplyLike}
                            onDelete={handleDeleteReply}
                            onEdit={handleEditReply}
                            onReply={handleReply}
                            reportContentType="discussion_reply"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {replyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailRootIdStack([Number(reply.id)]);
                        setReplyTarget(null);
                        setSheetReplyTarget(null);
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

      {/* 回复详情 Sheet */}
      <Sheet
        open={detailRootIdStack.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRootIdStack([]);
            setSheetReplyTarget(null);
          }
        }}
      >
        <SheetContent side="bottom" className="h-[70dvh] flex flex-col p-0">
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
              const defaultTarget: ReplyTarget = {
                id: rootReply.id,
                author: rootReply.author,
                userId: rootReply.userId,
              };
              return (
                <>
                  <div className="flex-1 overflow-auto px-4">
                    <CommentCard
                      comment={rootReply}
                      showReplyButton={false}
                      readOnly
                      user={user}
                      profile={profile}
                    />
                    <p className="text-sm text-muted-foreground py-2">
                      相关回复共 {detailReplies.length} 条
                    </p>
                    {detailReplies.map((r) => {
                      const childCount = getRepliesUnderRoot(discussion.replies, r.id).length;
                      return (
                        <div key={r.id} className="border-b border-border/60 last:border-0">
                          <CommentCard
                            comment={r}
                            showReplyButton
                            noBorder
                            user={user}
                            profile={profile}
                            replyTarget={sheetReplyTarget}
                            onReply={handleSheetReply}
                            onDelete={handleDeleteReply}
                            onEdit={handleEditReply}
                            isLiked={likedReplies.has(String(r.id))}
                            onToggleLike={handleToggleReplyLike}
                            reportContentType="discussion_reply"
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
                  <BottomReplyBox
                    variant="sheet"
                    user={user}
                    profile={profile}
                    defaultTarget={defaultTarget}
                    replyTarget={sheetReplyTarget}
                    onCancelReply={() => setSheetReplyTarget(null)}
                    canUploadImage={canUploadImage}
                    onSubmit={handleSubmitReply}
                  />
                </>
              );
            })()}
        </SheetContent>
      </Sheet>

      <BottomReplyBox
        variant="fixed"
        user={user}
        profile={profile}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
        canUploadImage={canUploadImage}
        onSubmit={handleSubmitReply}
      />
    </div>
  );
}
