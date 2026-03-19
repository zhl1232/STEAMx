"use client";

import Image from "next/image";
import Link from "next/link";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Trash2, ThumbsUp, Pencil, Check, X as XIcon } from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { RoleBadge } from "@/components/ui/role-badge";
import { ReportDialog } from "@/components/ui/report-dialog";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";
import type { Comment, Profile, ReplyTarget } from "@/lib/mappers/types";
import type { ReportContentType } from "@/lib/types/database";
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
}

export function CommentCard({
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
}: CommentCardProps) {
  const isReplying =
    replyTarget != null && String(replyTarget.id) === String(comment.id);
  const likesCount = comment.likes_count ?? 0;
  const isEdited = !!comment.updated_at;

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSaving, setIsSaving] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

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
          className="rounded-lg border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
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
          className="rounded-lg border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
        />
      </a>
    ));

  return (
    <div
      className={cn(
        "group flex gap-2",
        compact ? "py-3" : "py-4 sm:py-6 sm:gap-4",
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
        <div className="mb-0 flex items-center gap-1.5">
          {comment.role && comment.role !== "user" && (
            <RoleBadge role={comment.role} size="sm" className="shrink-0" />
          )}
          <UserLink
            className={cn(
              "font-semibold cursor-pointer hover:text-primary transition-colors",
              compact ? "text-sm" : "text-sm sm:text-base",
              getNameColorClassName(comment.nameColorId ?? null),
            )}
          >
            {comment.author}
          </UserLink>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
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
          <div className="flex justify-between items-center gap-2 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4 shrink-0 min-w-0">
              <span className="shrink-0">{comment.date}</span>
              {isEdited && (
                <span className="text-[10px] text-muted-foreground/70 shrink-0">(已编辑)</span>
              )}
              {showReplyButton && onReply && (
                <button
                  type="button"
                  className={cn(
                    "shrink-0 flex items-center gap-1 hover:text-primary transition-colors",
                    isReplying && "text-primary",
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
            <div className="flex items-center gap-x-4 shrink-0">
              {onToggleLike && (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 transition-colors",
                    isLiked ? "text-primary" : "hover:text-primary",
                  )}
                  title="赞"
                  aria-label="赞"
                  onClick={() => onToggleLike(Number(comment.id))}
                >
                  <ThumbsUp className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                  <span className="tabular-nums">{likesCount}</span>
                </button>
              )}
              {user?.id === comment.userId && onEdit && !isEditing && (
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
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
              {(user?.id === comment.userId ||
                profile?.role === "admin" ||
                profile?.role === "moderator" ||
                profile?.role === "teacher") &&
                onDelete && (
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      onDelete(Number(comment.id));
                    }}
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              {reportContentType && user && user.id !== comment.userId && (
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ReportDialog
                    contentType={reportContentType}
                    contentId={comment.id}
                  />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
