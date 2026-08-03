"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import {
  MessageCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";
import { useProjects } from '@/lib/context/project-context';
import { useAuth } from '@/lib/context/auth-context';
import { useLoginPrompt } from '@/lib/context/login-prompt-context';
import { type Comment, type ReplyTarget } from "@/lib/mappers/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getDisplayName } from "@/lib/utils/user";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { CommentCard } from "@/components/features/shared/comment-card";
import { BottomReplyBox } from "@/components/features/shared/bottom-reply-box";
import { OptimizedImage } from "@/components/ui/optimized-image";

const getRootOrderFromComments = (items: Comment[]): string[] => {
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

const mergeRootOrder = (current: string[], incoming: Comment[]): string[] => {
  if (incoming.length === 0) return current;
  const next = [...current];
  const seen = new Set(current);
  for (const id of getRootOrderFromComments(incoming)) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
};

const getPreviewReplies = (
  replies: Comment[],
  previewCount: number,
  highlightedCommentIds: Set<string>,
): Comment[] => {
  const highlightedReply = [...replies]
    .reverse()
    .find((reply) => highlightedCommentIds.has(String(reply.id)));

  if (previewCount <= 0) {
    return highlightedReply ? [highlightedReply] : [];
  }
  if (replies.length <= previewCount) return replies;

  const base = replies.slice(0, previewCount);

  if (!highlightedReply || base.some((reply) => String(reply.id) === String(highlightedReply.id))) {
    return base;
  }

  return [...base.slice(0, Math.max(0, previewCount - 1)), highlightedReply];
};

const getCommentThreadIds = (items: Comment[], rootId: string | number): Set<string> => {
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

interface ProjectCommentsProps {
  projectId: string | number;
  initialComments: Comment[];
  initialTotal?: number;
  initialHasMore?: boolean;
  initialLikedCommentIds?: Array<string | number>;
  actionsSlot?: React.ReactNode;
  commentBoxId?: string;
  mobileFixedComposerActionsSlot?: React.ReactNode;
  hideInlineComposerOnMobile?: boolean;
  preserveScrollOnSubmit?: boolean;
}

export function ProjectComments({
  projectId,
  initialComments,
  initialTotal = 0,
  initialHasMore = false,
  initialLikedCommentIds = [],
  actionsSlot,
  commentBoxId = "project-comment-box",
  mobileFixedComposerActionsSlot,
  hideInlineComposerOnMobile = false,
  preserveScrollOnSubmit = false,
}: ProjectCommentsProps) {
  const router = useRouter();
  const { addComment, deleteComment } = useProjects();
  const { user, profile } = useAuth();
  const { promptLogin } = useLoginPrompt();

  const canUploadImage = Boolean(user && profile?.age_confirmed_at);

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [total, setTotal] = useState(initialTotal || initialComments.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [rootOrder, setRootOrder] = useState<string[]>(() =>
    getRootOrderFromComments(initialComments),
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const isLoadingMoreRef = useRef(false);
  const PAGE_SIZE = 5;
  const PREVIEW_REPLY_MAX = 3;
  const PREVIEW_LIKES_SHOW_2 = 3;
  const PREVIEW_LIKES_SHOW_3 = 8;

  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [sheetReplyTarget, setSheetReplyTarget] = useState<ReplyTarget | null>(null);
  const [detailRootIdStack, setDetailRootIdStack] = useState<(number | string)[]>([]);
  const [likedComments, setLikedComments] = useState<Set<string>>(
    () => new Set(initialLikedCommentIds.map((id) => String(id))),
  );

  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [highlightedCommentIds, setHighlightedCommentIds] = useState<Set<string>>(new Set());
  const highlightTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingScrollTarget, setPendingScrollTarget] = useState<{
    id: string;
    scope: "main" | "sheet";
  } | null>(null);
  const isSheetOpen = detailRootIdStack.length > 0;

  const triggerCommentHighlight = useCallback((commentId: string | number) => {
    const key = String(commentId);

    setHighlightedCommentIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const currentTimeout = highlightTimeoutsRef.current.get(key);
    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }

    const timeoutId = setTimeout(() => {
      setHighlightedCommentIds((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      highlightTimeoutsRef.current.delete(key);
    }, 2800);

    highlightTimeoutsRef.current.set(key, timeoutId);
  }, []);

  useEffect(() => {
    setComments(initialComments);
    setTotal(initialTotal || initialComments.length);
    setHasMore(initialHasMore);
    setRootOrder(getRootOrderFromComments(initialComments));
    setPage(1);
    isLoadingMoreRef.current = false;
    setIsLoadingMore(false);
    setReplyTarget(null);
    setSheetReplyTarget(null);
    setDetailRootIdStack([]);
    setLikedComments(new Set(initialLikedCommentIds.map((id) => String(id))));
    setHighlightedCommentIds(new Set());
    setPendingScrollTarget(null);
  }, [projectId, initialComments, initialTotal, initialHasMore, initialLikedCommentIds]);

  useEffect(() => {
    const activeTimeouts = highlightTimeoutsRef.current;
    return () => {
      activeTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
      activeTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!pendingScrollTarget) return;

    const targetId = pendingScrollTarget.scope === "sheet"
      ? `sheet-comment-${pendingScrollTarget.id}`
      : `main-comment-${pendingScrollTarget.id}`;

    const rafId = window.requestAnimationFrame(() => {
      const element = document.getElementById(targetId);
      if (!element) return;

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
      setPendingScrollTarget(null);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [pendingScrollTarget, comments, detailRootIdStack]);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || !hasMore) return;
    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/comments?page=${page}&pageSize=${PAGE_SIZE}`
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const payload = await response.json();
      const newComments = (payload?.comments as Comment[]) || [];
      const likedIds = (payload?.likedCommentIds as Array<string | number>) || [];

      setRootOrder((prev) => mergeRootOrder(prev, newComments));
      if (likedIds.length > 0) {
        setLikedComments((prev) => {
          const next = new Set(prev);
          for (const id of likedIds) {
            next.add(String(id));
          }
          return next;
        });
      }
      setComments((prev: Comment[]) => {
        const merged = new Map<string, Comment>();
        for (const c of [...prev, ...newComments]) {
          merged.set(String(c.id), c);
        }
        return Array.from(merged.values());
      });
      setPage((prev: number) => prev + 1);
      setHasMore(Boolean(payload?.hasMore));
      if (payload?.total !== undefined) setTotal(payload.total);
    } catch (error) {
      logger.error("Error loading more comments", { error });
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, page, projectId, PAGE_SIZE]);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMore();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0.1 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMore]);

  const buildCommentPayload = useCallback(
    (content: string, imageUrl?: string, replyToUserId?: string, replyToUsername?: string) => ({
      id: 0,
      author: getDisplayName({
        profileName: profile?.display_name,
        metadataFullName: user?.user_metadata?.full_name,
        metadataName: user?.user_metadata?.name,
        email: user?.email,
        fallback: "Me",
      }),
      userId: user?.id,
      avatar: profile?.avatar_url || getDefaultAvatarPath(user?.id),
      content: content || "",
      image_url: imageUrl || null,
      date: "刚刚",
      reply_to_user_id: replyToUserId,
      reply_to_username: replyToUsername,
    }),
    [profile, user],
  );

  const handleSubmit = useCallback(
    async (
      e: React.FormEvent,
      content: string,
      parentId?: number,
      replyToUserId?: string,
      replyToUsername?: string,
      imageUrl?: string,
    ) => {
      e.preventDefault();
      if (!content.trim() && !imageUrl) return;

      const doSubmit = async () => {
        if (parentId != null) {
          const addedReply = await addComment(
            projectId,
            buildCommentPayload(content, imageUrl, replyToUserId, replyToUsername),
            parentId,
          );
          if (addedReply) {
            setComments((prev: Comment[]) => {
              const merged = new Map<string, Comment>();
              for (const c of [addedReply, ...prev]) merged.set(String(c.id), c);
              return Array.from(merged.values());
            });
            setTotal((prev: number) => prev + 1);
            triggerCommentHighlight(addedReply.id);
            if (!preserveScrollOnSubmit) {
              setPendingScrollTarget({
                id: String(addedReply.id),
                scope: isSheetOpen ? "sheet" : "main",
              });
            }
            setReplyTarget(null);
            setSheetReplyTarget(null);
          }
        } else {
          const addedComment = await addComment(
            projectId,
            buildCommentPayload(content, imageUrl),
          );
          if (addedComment) {
            setComments((prev: Comment[]) => {
              const merged = new Map<string, Comment>();
              for (const c of [addedComment, ...prev]) merged.set(String(c.id), c);
              return Array.from(merged.values());
            });
            triggerCommentHighlight(addedComment.id);
            if (!preserveScrollOnSubmit) {
              setPendingScrollTarget({ id: String(addedComment.id), scope: "main" });
            }
            if (!addedComment.parent_id) {
              const key = String(addedComment.id);
              setRootOrder((prev) => [key, ...prev.filter((id) => id !== key)]);
            }
            setTotal((prev: number) => prev + 1);
          }
        }
      };

      if (!user) {
        promptLogin(
          () => { doSubmit(); },
          {
            title: parentId != null ? "登录以回复评论" : "登录以发表评论",
            description: parentId != null
              ? "登录后即可参与讨论，回复其他用户"
              : "登录后即可参与讨论，分享你的想法",
          },
        );
        return;
      }

      doSubmit();
    },
    [addComment, projectId, user, promptLogin, buildCommentPayload, triggerCommentHighlight, isSheetOpen, preserveScrollOnSubmit],
  );

  const handleDeleteComment = useCallback(async (commentId: string | number) => {
    const idsToRemove = getCommentThreadIds(comments, commentId);
    await deleteComment(commentId);

    setComments((prev: Comment[]) =>
      prev.filter((comment) => !idsToRemove.has(String(comment.id))),
    );
    setRootOrder((order) => order.filter((id) => !idsToRemove.has(id)));
    setLikedComments((prev) => {
      const next = new Set(prev);
      for (const id of idsToRemove) {
        next.delete(id);
      }
      return next;
    });
    setTotal((prev: number) => Math.max(0, prev - idsToRemove.size));
    setDetailRootIdStack((prev) =>
      prev.filter((id) => !idsToRemove.has(String(id))),
    );
    if (replyTarget && idsToRemove.has(String(replyTarget.id))) {
      setReplyTarget(null);
    }
    if (sheetReplyTarget && idsToRemove.has(String(sheetReplyTarget.id))) {
      setSheetReplyTarget(null);
    }

    router.refresh();
  }, [comments, deleteComment, replyTarget, router, sheetReplyTarget]);

  const handleToggleLike = useCallback(
    async (commentId: string | number) => {
      if (!user) {
        promptLogin(
          () => {},
          {
            title: "登录以点赞评论",
            description: "登录后即可点赞喜欢的评论",
          },
        );
        return;
      }

      try {
        const response = await fetch(`/api/comments/${commentId}/like`, { method: "POST" });
        if (!response.ok) throw new Error(await response.text());
        const payload = await response.json();
        const liked = Boolean(payload?.liked);
        const action = payload?.action as "liked" | "unliked" | undefined;
        const delta = action === "liked" ? 1 : action === "unliked" ? -1 : liked ? 1 : -1;
        const key = String(commentId);

        setComments((prev: Comment[]) =>
          prev.map((c) => {
            if (String(c.id) !== key) return c;
            const nextCount = Math.max(0, (c.likes_count ?? 0) + delta);
            return { ...c, likes_count: nextCount };
          }),
        );

        setLikedComments((prev) => {
          const next = new Set(prev);
          if (liked) next.add(key);
          else next.delete(key);
          return next;
        });
      } catch (error) {
        logger.error("Error toggling comment like", { error });
      }
    },
    [user, promptLogin],
  );

  const rootOrderIndex = useMemo(() => {
    const map = new Map<string, number>();
    rootOrder.forEach((id, index) => map.set(id, index));
    return map;
  }, [rootOrder]);

  const childrenByParent = useMemo(() => {
    const map = new Map<number, Comment[]>();
    for (const c of comments) {
      if (c.parent_id == null) continue;
      const pid = Number(c.parent_id);
      if (Number.isNaN(pid)) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(c);
    }
    return map;
  }, [comments]);

  const sortByTimeAsc = useCallback((items: Comment[]) => {
    return [...items].sort((a, b) => {
      const t1 = a.created_at ?? "";
      const t2 = b.created_at ?? "";
      return t1.localeCompare(t2);
    });
  }, []);

  const getDescendantCount = useMemo(() => {
    const memo = new Map<number, number>();
    const count = (id: number): number => {
      if (memo.has(id)) return memo.get(id)!;
      const children = childrenByParent.get(id) || [];
      let total = 0;
      for (const child of children) {
        total += 1 + count(Number(child.id));
      }
      memo.set(id, total);
      return total;
    };
    return count;
  }, [childrenByParent]);

  const getRepliesUnderRoot = useCallback(
    (rootId: number | string): Comment[] => {
      const rid = Number(rootId);
      if (Number.isNaN(rid)) return [];
      const result: Comment[] = [];
      const queue = [rid];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const children = sortByTimeAsc(childrenByParent.get(id) || []);
        for (const child of children) {
          result.push(child);
          queue.push(Number(child.id));
        }
      }
      return result;
    },
    [childrenByParent, sortByTimeAsc],
  );

  const getDirectReplies = useCallback(
    (rootId: number | string): Comment[] => {
      const rid = Number(rootId);
      if (Number.isNaN(rid)) return [];
      return sortByTimeAsc(childrenByParent.get(rid) || []);
    },
    [childrenByParent, sortByTimeAsc],
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
    [PREVIEW_LIKES_SHOW_2, PREVIEW_LIKES_SHOW_3, PREVIEW_REPLY_MAX],
  );

  const topLevelComments = useMemo(() => {
    const roots = comments.filter((c: Comment) => !c.parent_id);
    if (roots.length <= 1) return roots;
    return [...roots].sort((a, b) => {
      const aKey = String(a.id);
      const bKey = String(b.id);
      const aIndex = rootOrderIndex.get(aKey);
      const bIndex = rootOrderIndex.get(bKey);
      if (aIndex != null && bIndex != null) return aIndex - bIndex;
      if (aIndex != null) return -1;
      if (bIndex != null) return 1;
      const t1 = a.created_at ?? "";
      const t2 = b.created_at ?? "";
      if (t2 !== t1) return t2.localeCompare(t1);
      return Number(b.id) - Number(a.id);
    });
  }, [comments, rootOrderIndex]);

  const commentsListRef = useRef<HTMLDivElement>(null);

  const handleReply = useCallback((target: ReplyTarget) => {
    setReplyTarget(target);
  }, []);

  const handleSheetReply = useCallback((target: ReplyTarget) => {
    setSheetReplyTarget(target);
  }, []);

  return (
    <div className="border-t pt-8 relative md:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-primary">|</span>
          评论
          {total > 0 ? (
            <span className="ml-1 text-base font-normal text-muted-foreground">{total}</span>
          ) : null}
        </h3>
        {actionsSlot ? <div className="shrink-0">{actionsSlot}</div> : null}
      </div>

      <div className="mb-8">
        {comments.length > 0 ? (
          <>
            <div ref={commentsListRef} className="rounded-xs">
              <div className="space-y-0">
                {topLevelComments.map((comment: Comment) => {
                  const replyCount = getDescendantCount(Number(comment.id));
                  const directReplies = getDirectReplies(comment.id);
                  const previewCount = getPreviewCount(directReplies);
                  const previewReplies = getPreviewReplies(
                    directReplies,
                    previewCount,
                    highlightedCommentIds,
                  );
                  return (
                    <div key={comment.id} className="border-b border-border/60 last:border-0">
                      <CommentCard
                        comment={comment}
                        anchorId={`main-comment-${comment.id}`}
                        showReplyButton
                        noBorder
                        enableUserLink
                        user={user}
                        profile={profile}
                        isLiked={likedComments.has(String(comment.id))}
                        replyTarget={replyTarget}
                        onToggleLike={handleToggleLike}
                        onDelete={handleDeleteComment}
                        onReply={handleReply}
                        onImageClick={setPreviewImageUrl}
                        reportContentType="comment"
                        highlighted={highlightedCommentIds.has(String(comment.id))}
                      />
                      {previewReplies.length > 0 && (
                        <div className="ml-11 mt-2 rounded-md border border-border/50 bg-muted/22 px-2 sm:ml-14 sm:px-3">
                          {previewReplies.map((reply) => (
                            <div
                              key={reply.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <CommentCard
                                comment={reply}
                                anchorId={`main-comment-${reply.id}`}
                                showReplyButton
                                noBorder
                                compact
                                enableUserLink
                                user={user}
                                profile={profile}
                                isLiked={likedComments.has(String(reply.id))}
                                replyTarget={replyTarget}
                                onToggleLike={handleToggleLike}
                                onDelete={handleDeleteComment}
                                onReply={handleReply}
                                onImageClick={setPreviewImageUrl}
                                reportContentType="comment"
                                highlighted={highlightedCommentIds.has(String(reply.id))}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {replyCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDetailRootIdStack([comment.id]);
                            setReplyTarget(null);
                            setSheetReplyTarget(null);
                          }}
                          className="ml-11 mt-1 flex items-center gap-1 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/55 hover:text-primary active:bg-muted/70 sm:ml-14"
                        >
                          展开全部 {replyCount} 条回复
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {hasMore && (
              <div
                ref={loadMoreRef}
                className="flex justify-center pt-4 text-sm text-muted-foreground"
              >
                {isLoadingMore ? (
                  <span className="inline-flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载中...
                  </span>
                ) : (
                  "上滑加载更多"
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-sm border border-dashed">
            <MessageCircle className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">还没有评论，快来抢沙发吧！</p>
          </div>
        )}
      </div>

      {mobileFixedComposerActionsSlot ? (
        <div className="md:hidden">
          <BottomReplyBox
            variant="fixed"
            fixedPlacement="screen"
            portalFixed
            user={user}
            profile={profile}
            replyTarget={replyTarget}
            onCancelReply={() => setReplyTarget(null)}
            canUploadImage={canUploadImage}
            placeholder="写评论..."
            actionsSlot={mobileFixedComposerActionsSlot}
            onSubmit={handleSubmit}
          />
        </div>
      ) : null}

      <div id={commentBoxId} className={cn("mt-6 scroll-mt-24", hideInlineComposerOnMobile && "hidden md:block")}>
        <BottomReplyBox
          variant="inline"
          user={user}
          profile={profile}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          canUploadImage={canUploadImage}
          placeholder="说点什么..."
          onSubmit={handleSubmit}
        />
      </div>

      {/* 评论详情 Sheet */}
      <Sheet
        open={detailRootIdStack.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDetailRootIdStack([]);
            setSheetReplyTarget(null);
          }
          setReplyTarget(null);
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
            <SheetTitle className="flex-1">评论详情</SheetTitle>
          </SheetHeader>
          {detailRootIdStack.length > 0 &&
            (() => {
              const currentRootId = detailRootIdStack[detailRootIdStack.length - 1];
              const rootComment = comments.find(
                (c: Comment) => Number(c.id) === Number(currentRootId),
              );
              const detailReplies = getRepliesUnderRoot(currentRootId);
              if (!rootComment) return null;
              const defaultTarget: ReplyTarget = {
                id: rootComment.id,
                author: rootComment.author,
                userId: rootComment.userId,
              };
              return (
                <>
                  <div className="flex-1 overflow-auto px-4">
                    <CommentCard
                      comment={rootComment}
                      anchorId={`sheet-comment-${rootComment.id}`}
                      showReplyButton={false}
                      readOnly
                      enableUserLink
                      user={user}
                      profile={profile}
                      onImageClick={setPreviewImageUrl}
                      highlighted={highlightedCommentIds.has(String(rootComment.id))}
                    />
                    <p className="text-sm text-muted-foreground py-2">
                      相关回复共 {detailReplies.length} 条
                    </p>
                    {detailReplies.map((c: Comment) => {
                      const childCount = getRepliesUnderRoot(c.id).length;
                      return (
                        <div key={c.id} className="border-b border-border/60 last:border-0">
                          <CommentCard
                            comment={c}
                            anchorId={`sheet-comment-${c.id}`}
                            showReplyButton
                            noBorder
                            enableUserLink
                            user={user}
                            profile={profile}
                            isLiked={likedComments.has(String(c.id))}
                            replyTarget={sheetReplyTarget}
                            onToggleLike={handleToggleLike}
                            onDelete={handleDeleteComment}
                            onReply={handleSheetReply}
                            onImageClick={setPreviewImageUrl}
                            reportContentType="comment"
                            highlighted={highlightedCommentIds.has(String(c.id))}
                          />
                          {childCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setDetailRootIdStack((prev) => [...prev, c.id])}
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
                    onSubmit={handleSubmit}
                  />
                </>
              );
            })()}
        </SheetContent>
      </Sheet>

      {/* 图片预览弹窗 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <OptimizedImage
            src={previewImageUrl}
            alt="图片预览"
            width={800}
            height={800}
            variant="cover"
            className="max-w-full max-h-[85vh] object-contain rounded-xs"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
