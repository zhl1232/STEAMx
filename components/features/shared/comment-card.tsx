"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, MoreHorizontal, Trash2, ThumbsUp, Pencil, Check, Flag, X as XIcon } from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { RoleBadge } from "@/components/ui/role-badge";
import { ReportDialog } from "@/components/ui/report-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";
import type { Comment, Profile, ReplyTarget } from "@/lib/mappers/types";
import type { ReportContentType } from "@/lib/mappers/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface CommentCardProps {
  comment: Comment;
  compact?: boolean;
  noBorder?: boolean;
  anchorId?: string;
  showReplyButton?: boolean;
  readOnly?: boolean;
  enableUserLink?: boolean;
  isLiked?: boolean;
  /** Currently active reply target; used to highlight the "reply" button */
  replyTarget?: ReplyTarget | null;
  onToggleLike?: (id: number) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number | string, content: string) => Promise<void>;
  onReply?: (target: ReplyTarget) => void;
  user: SupabaseUser | null;
  profile: Profile | null;
  onImageClick?: (url: string) => void;
  /** Content type for report button; omit to hide report */
  reportContentType?: ReportContentType;
  highlighted?: boolean;
}

function CommentCardComponent({
  comment,
  compact = false,
  noBorder = false,
  anchorId,
  showReplyButton = true,
  readOnly = false,
  enableUserLink = false,
  isLiked = false,
  replyTarget,
  onToggleLike,
  onDelete,
  onEdit,
  onReply,
  user,
  profile,
  onImageClick,
  reportContentType,
  highlighted = false,
}: CommentCardProps) {
  const isReplying =
    replyTarget != null && String(replyTarget.id) === String(comment.id);
  const likesCount = comment.likes_count ?? 0;
  const isEdited = !!comment.updated_at;
  const isOwnComment = !!user?.id && user.id === comment.userId;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const canDelete = !!onDelete && (
    user?.id === comment.userId ||
    profile?.role === "admin" ||
    profile?.role === "moderator" ||
    profile?.role === "teacher"
  );
  const canReport = !!reportContentType && !!user && user.id !== comment.userId;
  const hasMoreActions = canDelete || canReport;

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }
  }, [isEditing]);

  const handleSaveEdit = async () => {
    if (!onEdit || !editContent.trim() || editContent.trim() === comment.content) {
      setIsEditing(false);
      setEditContent(comment.content);
      return;
    }
    setIsSaving(true);
    try {
      await onEdit(comment.id, editContent.trim());
      setIsEditing(false);
    } catch {
      setEditContent(comment.content);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  const UserLink = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => {
    if (enableUserLink && comment.userId) {
      return (
        <Link href={`/users/${comment.userId}`} className={className}>
          {children}
        </Link>
      );
    }
    return <span className={className}>{children}</span>;
  };

  const imageElement = comment.image_url &&
    (onImageClick ? (
      <button
        type="button"
        className="mt-2 block"
        onClick={() => onImageClick(comment.image_url!)}
      >
        <Image
          src={comment.image_url}
          alt="评论附图"
          width={200}
          height={200}
          className="rounded-xs border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
        />
      </button>
    ) : (
      <a
        href={comment.image_url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block"
      >
        <Image
          src={comment.image_url}
          alt="评论附图"
          width={200}
          height={200}
          className="rounded-xs border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
        />
      </a>
    ));

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-lg px-2 py-1 transition-colors [transition-duration:2800ms] sm:px-3",
        highlighted && "bg-sky-50/90 ring-1 ring-sky-200/80 dark:bg-sky-500/10 dark:ring-sky-400/30",
        compact ? "py-3" : "py-4 sm:py-5 sm:gap-4",
        !noBorder && "border-b border-border/60 last:border-0",
      )}
      id={anchorId}
    >
      <UserLink className="shrink-0">
        <AvatarWithFrame
          src={comment.avatar}
          fallback={comment.author[0]?.toUpperCase()}
          avatarFrameId={comment.avatarFrameId}
          className={cn(
            "shrink-0 border transition-transform hover:scale-105",
            compact ? "h-8 w-8" : "h-9 w-9 sm:h-10 sm:w-10",
          )}
          avatarClassName={compact ? "h-8 w-8" : undefined}
        />
      </UserLink>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="mb-0 flex flex-wrap items-center gap-1.5">
          {comment.role && comment.role !== "user" && (
            <RoleBadge role={comment.role} size="sm" className="shrink-0" />
          )}
          <UserLink
            className={cn(
              "font-semibold cursor-pointer hover:text-primary transition-colors",
              compact ? "text-sm" : "text-sm sm:text-base",
              getNameColorClassName(comment.nameColorId ?? null),
              isOwnComment && "text-primary",
            )}
          >
            {comment.author}
          </UserLink>
          {isOwnComment && (
            <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
              我的评论
            </span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-xs border bg-background px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              rows={3}
              maxLength={2000}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleCancelEdit();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSaveEdit();
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving || !editContent.trim()}
                onClick={handleSaveEdit}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> 保存
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCancelEdit}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" /> 取消
              </button>
              <span className="text-[10px] text-muted-foreground ml-auto">Ctrl+Enter 保存 · Esc 取消</span>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {comment.reply_to_username && (
              <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-1.5 align-middle">
                回复 @{comment.reply_to_username}
              </span>
            )}
            {comment.content}
          </p>
        )}

        {imageElement}

        {!readOnly && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <span className="shrink-0">{comment.date}</span>
              {isEdited && (
                <span className="text-[10px] text-muted-foreground/70 shrink-0">(已编辑)</span>
              )}
              {showReplyButton && onReply && (
                <button
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 transition-colors hover:bg-muted/70 hover:text-primary",
                    isReplying && "bg-primary/10 text-primary",
                  )}
                  onClick={() =>
                    onReply({
                      id: comment.id,
                      author: comment.author,
                      userId: comment.userId,
                    })
                  }
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>回复</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleLike && (
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors hover:bg-muted/70",
                    isLiked ? "bg-primary/10 text-primary" : "hover:text-primary",
                  )}
                  title="赞"
                  aria-label="赞"
                  onClick={() => onToggleLike(Number(comment.id))}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                  <span className="tabular-nums">{likesCount}</span>
                </button>
              )}
              {user?.id === comment.userId && onEdit && !isEditing && !comment.parent_id && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full p-1.5 text-muted-foreground/75 transition-colors hover:bg-muted/70 hover:text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  onClick={() => {
                    setEditContent(comment.content);
                    setIsEditing(true);
                  }}
                  title="编辑"
                  aria-label="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {hasMoreActions && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground/85 hover:bg-muted/70 hover:text-foreground"
                        aria-label="更多操作"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 rounded-sm">
                      {canDelete && (
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={(event) => {
                            event.preventDefault();
                            onDelete?.(Number(comment.id));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      )}
                      {canReport && (
                        <DropdownMenuItem
                          className="gap-2"
                          onSelect={(event) => {
                            event.preventDefault();
                            setReportDialogOpen(true);
                          }}
                        >
                          <Flag className="h-4 w-4" />
                          举报
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {canReport && reportContentType && (
                    <ReportDialog
                      contentType={reportContentType}
                      contentId={comment.id}
                      open={reportDialogOpen}
                      onOpenChange={setReportDialogOpen}
                      hideTrigger
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function areCommentCardPropsEqual(prev: CommentCardProps, next: CommentCardProps) {
  const prevReplyTargetId = prev.replyTarget ? String(prev.replyTarget.id) : null;
  const nextReplyTargetId = next.replyTarget ? String(next.replyTarget.id) : null;

  return (
    prev.comment === next.comment &&
    prev.compact === next.compact &&
    prev.noBorder === next.noBorder &&
    prev.anchorId === next.anchorId &&
    prev.showReplyButton === next.showReplyButton &&
    prev.readOnly === next.readOnly &&
    prev.enableUserLink === next.enableUserLink &&
    prev.isLiked === next.isLiked &&
    prev.highlighted === next.highlighted &&
    prevReplyTargetId === nextReplyTargetId &&
    prev.user?.id === next.user?.id &&
    prev.profile?.role === next.profile?.role &&
    prev.reportContentType === next.reportContentType
  );
}

export const CommentCard = React.memo(CommentCardComponent, areCommentCardPropsEqual);
CommentCard.displayName = "CommentCard";
