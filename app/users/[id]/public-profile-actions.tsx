"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { BlockButton } from "@/components/features/social/block-button";
import { FollowButton } from "@/components/features/social/follow-button";
import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/use-follow";
import { useBlock } from "@/hooks/use-block";
import { useAuth } from "@/lib/context/auth-context";
import { cn } from "@/lib/utils";

type MessagePrivacy = "everyone" | "followers_only" | "nobody";

function getMessagePrivacy(value: string | null | undefined): MessagePrivacy {
  if (value === "followers_only" || value === "nobody") return value;
  return "everyone";
}

export function PublicProfileActions({
  targetUserId,
  messagePrivacy,
  className,
}: {
  targetUserId: string;
  messagePrivacy?: string | null;
  className?: string;
}) {
  const { user } = useAuth();
  const { isFollowing, isLoading } = useFollow(targetUserId);
  const { blocked, blockedByMe } = useBlock(targetUserId);
  const privacy = getMessagePrivacy(messagePrivacy);
  const blockMessage = blockedByMe ? "你已屏蔽该用户" : "你已被该用户屏蔽";
  const canMessage =
    user &&
    user.id !== targetUserId &&
    !blocked &&
    (privacy === "everyone" || (privacy === "followers_only" && isFollowing));
  const disabledMessage =
    blocked
      ? "无法私信"
      : privacy === "nobody"
        ? "对方已关闭私信"
        : privacy === "followers_only"
          ? isLoading
            ? "确认关系中"
            : "关注后可私信"
          : "发私信";
  const hasFullActionSet = Boolean(user && user.id !== targetUserId);

  return (
    <div
      className={cn(
        hasFullActionSet
          ? "grid w-full grid-cols-3 items-stretch gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center"
          : "flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto",
        className,
      )}
    >
      {blocked ? (
        <p className="col-span-3 -mb-0.5 text-center text-[11px] leading-4 text-muted-foreground sm:hidden">
          {blockMessage}，暂时无法互动
        </p>
      ) : null}
      {blocked ? (
        <Button
          type="button"
          variant="outline"
          title={blockMessage}
          aria-label={blockMessage}
          className="h-11 w-full min-w-0 px-2 text-xs font-semibold sm:w-auto sm:px-4 sm:text-sm"
          disabled
        >
          <span className="sm:hidden">{blockedByMe ? "已屏蔽" : "已被屏蔽"}</span>
          <span className="hidden sm:inline">{blockMessage}</span>
        </Button>
      ) : (
        <FollowButton
          targetUserId={targetUserId}
          showCount={false}
          className="h-11 w-full min-w-0 gap-1.5 px-2 text-xs font-semibold sm:w-auto sm:min-w-20 sm:px-4 sm:text-sm"
        />
      )}
      {user && user.id !== targetUserId ? (
        <BlockButton
          targetUserId={targetUserId}
          className="h-11 w-full min-w-0 gap-1.5 px-2 text-xs font-semibold sm:w-auto sm:px-4 sm:text-sm"
        />
      ) : null}
      {user && user.id !== targetUserId ? (
        canMessage ? (
          <Button variant="outline" className="h-11 w-full min-w-0 gap-1.5 px-2 text-xs font-semibold sm:w-auto sm:px-4 sm:text-sm" asChild>
            <Link href={`/messages/${targetUserId}`}>
              <MessageCircle className="h-4 w-4" />
              发私信
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            title={blocked ? `${blockMessage}，无法发送私信` : disabledMessage}
            aria-label={blocked ? `${blockMessage}，无法发送私信` : disabledMessage}
            className="h-11 w-full min-w-0 gap-1.5 rounded-md px-2 text-xs font-semibold sm:w-auto sm:px-4 sm:text-sm"
            disabled
          >
            <MessageCircle className="h-4 w-4" />
            {disabledMessage}
          </Button>
        )
      ) : null}
    </div>
  );
}
