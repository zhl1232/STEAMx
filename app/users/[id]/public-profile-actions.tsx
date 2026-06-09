"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { FollowButton } from "@/components/features/social/follow-button";
import { Button } from "@/components/ui/button";
import { useFollow } from "@/hooks/use-follow";
import { useAuth } from "@/lib/context/auth-context";

type MessagePrivacy = "everyone" | "followers_only" | "nobody";

function getMessagePrivacy(value: string | null | undefined): MessagePrivacy {
  if (value === "followers_only" || value === "nobody") return value;
  return "everyone";
}

export function PublicProfileActions({
  targetUserId,
  messagePrivacy,
}: {
  targetUserId: string;
  messagePrivacy?: string | null;
}) {
  const { user } = useAuth();
  const { isFollowing, isLoading } = useFollow(targetUserId);
  const privacy = getMessagePrivacy(messagePrivacy);
  const canMessage =
    user &&
    user.id !== targetUserId &&
    (privacy === "everyone" || (privacy === "followers_only" && isFollowing));
  const disabledMessage =
    privacy === "nobody"
      ? "对方已关闭私信"
      : privacy === "followers_only"
        ? isLoading
          ? "确认关系中"
          : "关注后可私信"
        : "发私信";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 xl:justify-end">
      <FollowButton
        targetUserId={targetUserId}
        showCount={false}
        className="h-11 px-6 text-sm font-semibold"
      />
      {user && user.id !== targetUserId ? (
        canMessage ? (
          <Button variant="outline" className="h-11 px-6 text-sm font-semibold" asChild>
            <Link href={`/messages/${targetUserId}`}>
              <MessageCircle className="mr-2 h-4 w-4" />
              发私信
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-md px-6 text-sm font-semibold"
            disabled
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {disabledMessage}
          </Button>
        )
      ) : null}
    </div>
  );
}
