"use client";

import Image from "next/image";
import Link from "next/link";

import { MessageSquare, Trash2, ThumbsUp } from "lucide-react";
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
  onReply,
  user,
  profile,
  onImageClick,
  reportContentType,
}: CommentCardProps) {
  const isReplying =
    replyTarget != null && String(replyTarget.id) === String(comment.id);
  const likesCount = comment.likes_count ?? 0;

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

        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
          {comment.reply_to_username && (
            <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-1.5 align-middle">
              回复 @{comment.reply_to_username}
            </span>
          )}
          {comment.content}
        </p>

        {imageElement}

        {!readOnly && (
          <div className="flex justify-between items-center gap-2 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-4 shrink-0 min-w-0">
              <span className="shrink-0">{comment.date}</span>
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
