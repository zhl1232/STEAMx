"use client";
import Link from "next/link";
import Image from "next/image";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";

import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { RoleBadge } from "@/components/ui/role-badge";
import {
  MessageCircle,
  Trash2,
  ThumbsUp,
  MessageSquare,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ImagePlus,
  X,
} from "lucide-react";
import { useProjects } from "@/context/project-context";
import { useAuth } from "@/context/auth-context";
import { useGamification } from "@/context/gamification-context";
import { useLoginPrompt } from "@/context/login-prompt-context";
import { type Comment } from "@/lib/mappers/types";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getDisplayName } from "@/lib/utils/user";
import { uploadCommentImage, CommentImageError } from "@/lib/comment-image";
import { useToast } from "@/hooks/use-toast";

/** 内联回复框 - 支持图片上传 */
function ReplyWithImage({
  comment,
  canUploadImage,
  user,
  profile,
  handleSubmitReply,
  handleCancelReply,
  toast,
}: {
  comment: Comment;
  canUploadImage: boolean;
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];
  handleSubmitReply: (
    e: React.FormEvent,
    content: string,
    parentId: number,
    replyToUserId?: string,
    replyToUsername?: string,
    imageUrl?: string,
  ) => void;
  handleCancelReply: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "图片大小不能超过 2MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = textareaRef.current?.value || "";
    if (!content.trim() && !imageFile) return;

    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile && user) {
        try {
          imageUrl = await uploadCommentImage(imageFile, user.id);
        } catch (err) {
          toast({
            title: err instanceof CommentImageError ? err.message : "图片上传失败",
            variant: "destructive",
          });
          return;
        }
      }
      handleSubmitReply(e, content, Number(comment.id), comment.userId, comment.author, imageUrl);
      if (textareaRef.current) textareaRef.current.value = "";
      clearImage();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
      <form onSubmit={onSubmit} className="flex gap-3 items-start">
        <AvatarWithFrame
          src={profile?.avatar_url || user?.user_metadata?.avatar_url}
          fallback="M"
          avatarFrameId={profile?.equipped_avatar_frame_id}
          className="h-8 w-8 shrink-0"
          avatarClassName="h-8 w-8"
        />
        <div className="flex-1 space-y-2">
          <textarea
            ref={textareaRef}
            placeholder={`回复 @${comment.author}...`}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            autoFocus
          />
          {imagePreview && (
            <div className="relative inline-block">
              <Image
                src={imagePreview}
                alt="待发送图片"
                width={64}
                height={64}
                className="rounded-md border border-border/60 object-cover h-16 w-16"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground/90 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
          <div className="flex justify-between items-center">
            <div>
              {canUploadImage && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    onClick={() => fileInputRef.current?.click()}
                    title="插入图片 (Lv.2 特权)"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelReply}
                className="h-8"
              >
                取消
              </Button>
              <Button type="submit" size="sm" className="h-8" disabled={submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "发布"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

interface ProjectCommentsProps {
  projectId: string | number;
  initialComments: Comment[];
  initialTotal?: number;
  initialHasMore?: boolean;
  /** 与回复框同行的操作区（服务端不能传函数给客户端，故仅支持 ReactNode） */
  actionsSlot?: React.ReactNode;
}

export function ProjectComments({
  projectId,
  initialComments,
  initialTotal = 0,
  initialHasMore = false,
  actionsSlot,
}: ProjectCommentsProps) {
  const { addComment, deleteComment } = useProjects();
  const { user, profile } = useAuth();
  const { level } = useGamification();
  const { promptLogin } = useLoginPrompt();
  const { toast } = useToast();

  const canUploadImage = level >= 2;

  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [total, setTotal] = useState(initialTotal || initialComments.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 5;
  const PREVIEW_REPLY_MAX = 3;
  const PREVIEW_LIKES_SHOW_2 = 3;
  const PREVIEW_LIKES_SHOW_3 = 8;

  const [replyingTo, setReplyingTo] = useState<number | string | null>(null);
  const [detailRootIdStack, setDetailRootIdStack] = useState<(number | string)[]>([]);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  // 底部评论框 ref（非受控）
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [mainHasContent, setMainHasContent] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // 评论附图状态
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 图片预览弹窗
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const handleMainImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "图片大小不能超过 2MB", variant: "destructive" });
      return;
    }
    setMainImageFile(file);
    setMainImagePreview(URL.createObjectURL(file));
  };

  const clearMainImage = () => {
    setMainImageFile(null);
    if (mainImagePreview) URL.revokeObjectURL(mainImagePreview);
    setMainImagePreview(null);
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
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
      console.error("Error loading more comments:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = mainTextareaRef.current?.value || "";
    if (!content.trim() && !mainImageFile) return;

    const submitComment = async () => {
      setIsSubmitting(true);
      try {
        // 上传附图
        let imageUrl: string | undefined;
        if (mainImageFile && user) {
          try {
            imageUrl = await uploadCommentImage(mainImageFile, user.id);
          } catch (err) {
            toast({
              title: err instanceof CommentImageError ? err.message : "图片上传失败",
              variant: "destructive",
            });
            return;
          }
        }

        const addedComment = await addComment(projectId, {
          id: 0,
          author: getDisplayName({
            profileName: profile?.display_name,
            metadataFullName: user?.user_metadata?.full_name,
            metadataName: user?.user_metadata?.name,
            phone: user?.phone ?? null,
            email: user?.email,
            fallback: "Me",
          }),
          userId: user?.id,
          avatar: profile?.avatar_url || user?.user_metadata?.avatar_url,
          content: content || "",
          image_url: imageUrl || null,
          date: "刚刚",
        });

        if (addedComment) {
          setComments((prev: Comment[]) => {
            const merged = new Map<string, Comment>();
            for (const c of [addedComment, ...prev]) {
              merged.set(String(c.id), c);
            }
            return Array.from(merged.values());
          });
          setTotal((prev: number) => prev + 1);
          if (mainTextareaRef.current) {
            mainTextareaRef.current.value = "";
            setMainHasContent(false);
          }
          clearMainImage();
          setIsFocused(false);
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    if (!user) {
      promptLogin(
        () => {
          submitComment();
        },
        {
          title: "登录以发表评论",
          description: "登录后即可参与讨论，分享你的想法",
        },
      );
      return;
    }

    submitComment();
  };

  const handleSubmitReply = useCallback(
    async (
      e: React.FormEvent,
      content: string,
      parentId: number,
      replyToUserId?: string,
      replyToUsername?: string,
      imageUrl?: string,
    ) => {
      e.preventDefault();
      if (!content.trim() && !imageUrl) return;

      const submitReply = async () => {
        const addedReply = await addComment(
          projectId,
          {
            id: 0,
            author: getDisplayName({
              profileName: profile?.display_name,
              metadataFullName: user?.user_metadata?.full_name,
              metadataName: user?.user_metadata?.name,
              phone: user?.phone ?? null,
              email: user?.email,
              fallback: "Me",
            }),
            userId: user?.id,
            avatar: profile?.avatar_url || user?.user_metadata?.avatar_url,
            content: content || "",
            image_url: imageUrl || null,
            date: "刚刚",
            reply_to_user_id: replyToUserId,
            reply_to_username: replyToUsername,
          },
          parentId,
        );

        if (addedReply) {
          setComments((prev: Comment[]) => {
            const merged = new Map<string, Comment>();
            for (const c of [addedReply, ...prev]) {
              merged.set(String(c.id), c);
            }
            return Array.from(merged.values());
          });
          setTotal((prev: number) => prev + 1);
          setReplyingTo(null);
        }
      };

      if (!user) {
        promptLogin(
          () => {
            submitReply();
          },
          {
            title: "登录以回复评论",
            description: "登录后即可参与讨论，回复其他用户",
          },
        );
        return;
      }

      submitReply();
    },
    [addComment, projectId, user, profile, promptLogin],
  );

  const handleDeleteComment = async (commentId: string | number) => {
    await deleteComment(commentId);
    setComments((prev: Comment[]) => prev.filter((c: Comment) => c.id !== commentId));
  };

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

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
        console.error("Error toggling comment like:", error);
      }
    },
    [user, promptLogin],
  );

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

  /** 某条评论下的全部回复（含多级），平铺列表，用于「共 N 条」与详情页 */
  const getRepliesUnderRoot = useCallback(
    (rootId: number | string): Comment[] => {
      const rid = Number(rootId);
      if (Number.isNaN(rid)) return [];
      const result: Comment[] = [];
      const queue = [rid];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const children = sortByTimeAsc(childrenByParent.get(id) || []);
        // 同一父节点下按时间正序（新的在后）
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
    const getLikeCount = (comment: Comment): number => {
      const raw = comment as Comment & {
        likes_count?: number;
        likes?: number;
        like_count?: number;
        likeCount?: number;
      };
      const value =
        raw.likes_count ?? raw.likes ?? raw.like_count ?? raw.likeCount ?? 0;
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num : 0;
    };
    return [...roots].sort((a, b) => {
      const heatA = getLikeCount(a) + getDescendantCount(Number(a.id));
      const heatB = getLikeCount(b) + getDescendantCount(Number(b.id));
      if (heatB !== heatA) return heatB - heatA;
      const t1 = a.created_at ?? "";
      const t2 = b.created_at ?? "";
      if (t2 !== t1) return t2.localeCompare(t1);
      return Number(b.id) - Number(a.id);
    });
  }, [comments, getDescendantCount]);

  const commentsListRef = useRef<HTMLDivElement>(null);
  const sheetReplyRef = useRef<HTMLTextAreaElement>(null);

  /** 单条评论卡片：展示 + 可选回复框，无嵌套列表 */
  const CommentCard = ({
    comment,
    showReplyForm = true,
    readOnly = false,
    noBorder = false,
    compact = false,
  }: {
    comment: Comment;
    showReplyForm?: boolean;
    readOnly?: boolean;
    noBorder?: boolean;
    compact?: boolean;
  }) => {
    const isReplying = replyingTo === comment.id;
    const isLiked = likedComments.has(String(comment.id));
    const likesCount = comment.likes_count ?? 0;


    const UserLink = ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => {
      if (comment.userId) {
        return (
          <Link href={`/users/${comment.userId}`} className={className}>
            {children}
          </Link>
        );
      }
      return <span className={className}>{children}</span>;
    };

    return (
      <div
        className={cn(
          "group flex gap-2",
          compact ? "py-3" : "py-4 sm:py-6 sm:gap-4",
          !noBorder && "border-b border-border/60 last:border-0",
        )}
      >
        <UserLink className="shrink-0">
          <AvatarWithFrame
            src={comment.avatar}
            fallback={comment.author[0]?.toUpperCase()}
            avatarFrameId={comment.avatarFrameId}
            className={cn(
              "shrink-0 border transition-transform hover:scale-105",
              compact ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12",
            )}
            avatarClassName={compact ? "h-8 w-8" : "h-10 w-10 sm:h-12 sm:w-12"}
          />
        </UserLink>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="mb-1.5 flex items-center gap-1.5">
            {comment.role && comment.role !== "user" && <RoleBadge role={comment.role} size="sm" />}
            <UserLink
              className={cn(
                "font-semibold cursor-pointer hover:text-primary transition-colors",
                compact ? "text-sm" : "text-base",
                getNameColorClassName(comment.nameColorId ?? null),
              )}
            >
              {comment.author}
            </UserLink>
          </div>

          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {comment.reply_to_username && (
              <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-2 align-middle">
                回复 @{comment.reply_to_username}
              </span>
            )}
            {comment.content}
          </p>
          {comment.image_url && (
            <button
              type="button"
              className="mt-2 block"
              onClick={() => setPreviewImageUrl(comment.image_url!)}
            >
              <Image
                src={comment.image_url}
                alt="评论附图"
                width={200}
                height={200}
                className="rounded-lg border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
              />
            </button>
          )}

          {!readOnly && (
            <div className="flex justify-between items-center gap-2 mt-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-3 shrink-0 min-w-0">
                <span className="shrink-0">{comment.date}</span>
                {showReplyForm && (
                  <button
                    type="button"
                    className={cn(
                      "shrink-0 flex items-center gap-1 hover:text-primary transition-colors",
                      isReplying && "text-primary",
                    )}
                    onClick={() => setReplyingTo(comment.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>回复</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-x-4 shrink-0">
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 transition-colors",
                    isLiked ? "text-primary" : "hover:text-primary",
                  )}
                  title="赞"
                  aria-label="赞"
                  onClick={() => handleToggleLike(comment.id)}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                  <span className="tabular-nums">{likesCount}</span>
                </button>
                {(user?.id === comment.userId ||
                  profile?.role === "admin" ||
                  profile?.role === "moderator" ||
                  profile?.role === "teacher") && (
                  <button
                    type="button"
                    className="flex items-center gap-1 transition-colors text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteComment(comment.id)}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {showReplyForm && !readOnly && isReplying && (
            <ReplyWithImage
              comment={comment}
              canUploadImage={canUploadImage}
              user={user}
              profile={profile}
              handleSubmitReply={handleSubmitReply}
              handleCancelReply={handleCancelReply}
              toast={toast}
            />
          )}
        </div>
      </div>
    );
  };

  const isExpanded = isFocused || mainHasContent || !!mainImageFile;

  return (
    <div className="border-t pt-8 relative md:px-6 lg:px-8">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="text-primary">|</span>
        评论
        <span className="text-base font-normal text-muted-foreground ml-1">{total}</span>
      </h3>

      {/* Comments List - 不设固定高度，随内容增高，整页滚动，避免内部滚动条与多余空白 */}
      <div className="mb-8">
        {comments.length > 0 ? (
          <>
            <div ref={commentsListRef} className="rounded-lg">
              <div className="space-y-0">
                {topLevelComments.map((comment: Comment) => {
                  const replyCount = getDescendantCount(Number(comment.id));
                  const directReplies = getDirectReplies(comment.id);
                  const previewCount = getPreviewCount(directReplies);
                  const previewReplies = directReplies.slice(0, previewCount);
                  return (
                    <div key={comment.id} className="border-b border-border/60 last:border-0">
                      <CommentCard
                        comment={comment}
                        showReplyForm={true}
                        readOnly={false}
                        noBorder
                      />
                      {previewReplies.length > 0 && (
                        <div className="ml-12 sm:ml-16 pl-4 border-l border-border/60 mt-1">
                          {previewReplies.map((reply) => (
                            <div
                              key={reply.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <CommentCard
                                comment={reply}
                                showReplyForm={true}
                                readOnly={false}
                                noBorder
                                compact
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
                            setReplyingTo(null);
                          }}
                          className="ml-12 sm:ml-16 flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors py-2 px-3"
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
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full sm:w-auto"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    "加载更多评论"
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
            <MessageCircle className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-sm">还没有评论，快来抢沙发吧！</p>
          </div>
        )}
      </div>

      {/* 评论详情 Sheet：栈式钻取 + 查看对话 + 返回 */}
      <Sheet
        open={detailRootIdStack.length > 0}
        onOpenChange={(open) => {
          if (!open) setDetailRootIdStack([]);
          setReplyingTo(null);
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
              return (
                <>
                  <div className="flex-1 overflow-auto px-4">
                    <CommentCard comment={rootComment} showReplyForm={false} readOnly={true} />
                    <p className="text-sm text-muted-foreground py-2">
                      相关回复共 {detailReplies.length} 条
                    </p>
                    {detailReplies.map((c: Comment) => {
                      const childCount = getRepliesUnderRoot(c.id).length;
                      return (
                        <div key={c.id} className="border-b border-border/60 last:border-0">
                          <CommentCard comment={c} showReplyForm={true} readOnly={false} noBorder />
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
                          rootComment.userId,
                          rootComment.author,
                        );
                        if (sheetReplyRef.current) sheetReplyRef.current.value = "";
                      }}
                      className="flex gap-2 items-end"
                    >
                      <textarea
                        ref={sheetReplyRef}
                        placeholder={`回复 @${rootComment.author}...`}
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

      {/* 底部固定悬浮栏：单行 [头像] [胶囊输入框] [心][收藏][硬币]，顶部细线+柔和上投影 */}
      <div className="fixed bottom-16 left-0 right-0 md:sticky md:bottom-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-3 border-t border-[#F0F0F0] dark:border-border md:border-t-0 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.03)] md:shadow-none">
        <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
          <AvatarWithFrame
            src={profile?.avatar_url || user?.user_metadata?.avatar_url}
            fallback={profile?.display_name?.[0]?.toUpperCase() || "Me"}
            avatarFrameId={profile?.equipped_avatar_frame_id}
            className="h-9 w-9 border shrink-0"
            avatarClassName="h-9 w-9"
          />
          <form onSubmit={handleSubmitComment} className="flex-1 min-w-0 mr-4">
            {/* file input 始终挂载，避免文件选择器打开时 DOM 卸载导致 onChange 丢失 */}
            {canUploadImage && (
              <input
                ref={mainFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleMainImageSelect}
              />
            )}
            <div
              className={cn(
                "w-full min-w-0 bg-[#F0F2F5] dark:bg-muted/90 overflow-hidden transition-all duration-200 ease-out",
                "focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-0",
                "min-w-[160px]",
                isExpanded ? "rounded-xl" : "rounded-3xl",
              )}
            >
              <textarea
                ref={mainTextareaRef}
                placeholder="说点什么..."
                rows={1}
                onChange={(e) => setMainHasContent(e.target.value.trim().length > 0)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  if (!mainTextareaRef.current?.value && !mainImageFile) setIsFocused(false);
                }}
                className={cn(
                  "py-3 px-4 w-full bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none resize-none leading-normal",
                  isExpanded ? "min-h-[80px] max-h-[200px]" : "min-h-[44px] max-h-[120px]",
                )}
              />
              {/* 展开后：图片预览 + 底部工具栏 */}
              {isExpanded && (
                <>
                  {mainImagePreview && (
                    <div className="px-3 pb-2">
                      <div className="relative inline-block">
                        <Image
                          src={mainImagePreview}
                          alt="待发送图片"
                          width={72}
                          height={72}
                          className="rounded-md border border-border/60 object-cover h-[72px] w-[72px]"
                        />
                        <button
                          type="button"
                          onClick={clearMainImage}
                          className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-foreground/70 text-background flex items-center justify-center hover:bg-foreground/90 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center">
                      {canUploadImage && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => mainFileInputRef.current?.click()}
                          title="插入图片 (Lv.2 特权)"
                        >
                          <ImagePlus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Button
                      type="submit"
                      disabled={(!mainHasContent && !mainImageFile) || isSubmitting}
                      size="sm"
                      className="h-8 px-4 rounded-full text-xs font-medium"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "发布"}
                    </Button>
                  </div>
                </>
              )}

            </div>
          </form>
          {/* 聚焦时隐藏右侧操作区，让回复区域更宽 */}
          {!isFocused && <div className="min-w-2 shrink-0" aria-hidden />}
          {actionsSlot != null && !isFocused && (
            <div className="shrink-0 flex items-center">{actionsSlot}</div>
          )}
        </div>
      </div>

      {/* 图片预览弹窗 */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <Image
            src={previewImageUrl}
            alt="图片预览"
            width={800}
            height={800}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
