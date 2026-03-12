"use client";

import Image from "next/image";

import { MessageSquare, Heart, Trash2 } from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { RoleBadge } from "@/components/ui/role-badge";
import { cn } from "@/lib/utils";
import { getNameColorClassName } from "@/lib/shop/items";
import { InlineReplyForm } from "./inline-reply-form";
import type { Comment, Profile } from "@/lib/mappers/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export interface ReplyCardProps {
  reply: Comment;
  showReplyForm?: boolean;
  readOnly?: boolean;
  noBorder?: boolean;
  user: SupabaseUser | null;
  profile: Profile | null;
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  isLiked?: boolean;
  onToggleLike?: (id: number) => void;
  onSubmitReply: (
    e: React.FormEvent,
    content: string,
    parentId: number,
    replyToUserId?: string,
    replyToUsername?: string,
  ) => void;
  onCancelReply: () => void;
  onDeleteReply: (id: number) => void;
}

export function ReplyCard({
  reply,
  showReplyForm = true,
  readOnly = false,
  noBorder = false,
  user,
  profile,
  replyingTo,
  setReplyingTo,
  onSubmitReply,
  onCancelReply,
  onDeleteReply,
  isLiked = false,
  onToggleLike,
}: ReplyCardProps) {
  const isReplying = replyingTo === Number(reply.id);
  const likesCount = reply.likes_count ?? 0;

  return (
    <div
      className={cn(
        "group flex gap-2 sm:gap-4 px-3 py-4 sm:py-6",
        !noBorder && "border-b border-border/60 last:border-0",
      )}
      id={`reply-${reply.id}`}
    >
      <AvatarWithFrame
        src={reply.avatar}
        fallback={reply.author[0]?.toUpperCase()}
        avatarFrameId={reply.avatarFrameId}
        className="shrink-0 border h-9 w-9 sm:h-10 sm:w-10"
      />
      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="mb-1 flex items-center gap-1.5">
          {reply.role && reply.role !== "user" && <RoleBadge role={reply.role} size="sm" />}
          <span
            className={cn(
              "font-semibold cursor-pointer hover:text-primary transition-colors text-sm sm:text-base",
              getNameColorClassName(reply.nameColorId ?? null),
            )}
          >
            {reply.author}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
          {reply.reply_to_username && (
            <span className="inline-block bg-primary/10 text-primary px-1 rounded text-xs mr-1.5 align-middle">
              回复 @{reply.reply_to_username}
            </span>
          )}
          {reply.content}
        </p>
        {reply.image_url && (
          <a
            href={reply.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block"
          >
            <Image
              src={reply.image_url}
              alt="回复附图"
              width={200}
              height={200}
              className="rounded-lg border object-cover max-h-[200px] w-auto hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
        )}
        {!readOnly && (
          <div className="flex justify-between items-center gap-2 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3 shrink-0 min-w-0">
              <span className="shrink-0">{reply.date}</span>
              {showReplyForm && (
                <button
                  type="button"
                  className={cn(
                    "shrink-0 flex items-center gap-1 hover:text-primary transition-colors",
                    isReplying && "text-primary",
                  )}
                  onClick={() => setReplyingTo(Number(reply.id))}
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
                onClick={() => onToggleLike?.(Number(reply.id))}
              >
                <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                <span className="tabular-nums">{likesCount}</span>
              </button>
              {(user?.id === reply.userId ||
                profile?.role === "admin" ||
                profile?.role === "moderator" ||
                profile?.role === "teacher") && (
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteReply(Number(reply.id));
                  }}
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
          <InlineReplyForm
            replyId={Number(reply.id)}
            replyAuthor={reply.author}
            replyUserId={reply.userId}
            userAvatar={profile?.avatar_url || user?.user_metadata?.avatar_url || undefined}
            userAvatarFrameId={profile?.equipped_avatar_frame_id || undefined}
            onSubmit={onSubmitReply}
            onCancel={onCancelReply}
          />
        )}
      </div>
    </div>
  );
}
