"use client";

import Link from "next/link";
import { Check, MessageCircle, MoreHorizontal, Share2, Ban, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { FollowButton } from "@/components/features/social/follow-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFollow } from "@/hooks/use-follow";
import { useBlock } from "@/hooks/use-block";
import { useAuth } from "@/lib/context/auth-context";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const { isMutualFollow, isLoading } = useFollow(targetUserId);
  const { blocked, blockedByMe, isLoading: isBlockLoading, isPending: isBlockPending, toggleBlock } = useBlock(targetUserId);
  const [copied, setCopied] = useState(false);

  const privacy = getMessagePrivacy(messagePrivacy);
  const blockMessage = blockedByMe ? "你已屏蔽该用户" : "你已被该用户屏蔽";
  const isSelf = Boolean(user && user.id === targetUserId);

  // followers_only 是互相关注语义：单向关注不解锁，否则陌生人点一下关注就能绕过。
  // 这个按钮只负责「发起新会话」；已经聊过的会话从消息列表继续，接口那边会放行。
  const canMessage =
    user &&
    !isSelf &&
    !blocked &&
    (privacy === "everyone" || (privacy === "followers_only" && isMutualFollow));

  const disabledMessage =
    blocked
      ? "无法私信"
      : privacy === "nobody"
        ? "对方已关闭私信"
        : privacy === "followers_only"
          ? isLoading
            ? "确认关系中"
            : "互相关注后可私信"
          : "发私信";

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: "用户主页", url });
        return;
      } catch {
        // 用户取消或不支持，回退到剪贴板
      }
    }

    if (navigator.clipboard?.writeText && url) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ title: "链接已复制", description: "主页链接已复制到剪贴板" });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: "复制失败", description: "请手动复制浏览器地址栏链接", variant: "destructive" });
      }
    }
  };

  if (isSelf) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button variant="outline" size="sm" className="h-9 rounded-md px-4 text-xs font-semibold" asChild>
          <Link href="/settings/profile">编辑资料</Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          onClick={handleShare}
          title="分享主页"
          aria-label="分享主页"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Share2 className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-2 sm:w-auto", className)}>
      {blocked ? (
        <p className="text-center text-[11px] leading-4 text-muted-foreground sm:text-left">
          {blockMessage}，暂时无法互动
        </p>
      ) : null}

      <div className="flex w-full items-center gap-2 sm:w-auto">
        {blocked ? (
          <Button
            type="button"
            variant="outline"
            title={blockMessage}
            aria-label={blockMessage}
            className="h-10 flex-1 min-w-0 rounded-md px-3 text-xs font-semibold sm:flex-initial sm:px-4 sm:text-sm"
            disabled
          >
            <span className="sm:hidden">{blockedByMe ? "已屏蔽" : "已被屏蔽"}</span>
            <span className="hidden sm:inline">{blockMessage}</span>
          </Button>
        ) : (
          <FollowButton
            targetUserId={targetUserId}
            showCount={false}
            className="h-10 flex-1 min-w-0 rounded-md gap-1.5 px-3 text-xs font-semibold sm:flex-initial sm:min-w-24 sm:px-5 sm:text-sm shadow-xs"
          />
        )}

        {canMessage ? (
          <Button
            variant="outline"
            className="h-10 flex-1 min-w-0 rounded-md gap-1.5 px-3 text-xs font-semibold sm:flex-initial sm:px-4 sm:text-sm"
            asChild
          >
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
            className="h-10 flex-1 min-w-0 rounded-md gap-1.5 px-3 text-xs font-semibold sm:flex-initial sm:px-4 sm:text-sm"
            disabled
          >
            <MessageCircle className="h-4 w-4" />
            {disabledMessage}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label="更多操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-md">
            <DropdownMenuItem onClick={handleShare} className="cursor-pointer rounded-sm">
              <Share2 className="mr-2 h-4 w-4" />
              分享主页
            </DropdownMenuItem>
            {user && !isSelf ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={toggleBlock}
                  disabled={isBlockLoading || isBlockPending || (blocked && !blockedByMe)}
                  className={cn(
                    "cursor-pointer rounded-sm",
                    blockedByMe ? "text-foreground" : "text-destructive focus:text-destructive",
                  )}
                >
                  {blockedByMe ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      取消屏蔽
                    </>
                  ) : (
                    <>
                      <Ban className="mr-2 h-4 w-4" />
                      屏蔽用户
                    </>
                  )}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
