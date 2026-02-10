"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useNotifications, type Notification } from "@/context/notification-context";
import { useConversations } from "@/hooks/use-messages";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  MessageSquare,
  MessageCircle,
  Heart,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FollowButton } from "@/components/features/social/follow-button";

const TABS = [
  { key: "replies", label: "回复与@", icon: MessageSquare },
  { key: "likes", label: "收到喜欢", icon: Heart },
  { key: "follows", label: "新增粉丝", icon: UserPlus },
  { key: "dm", label: "私信", icon: MessageCircle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function filterByTab(notifications: Notification[], tab: TabKey): Notification[] {
  if (tab === "replies") {
    return notifications.filter(
      (n) =>
        n.type === "mention" ||
        n.type === "reply" ||
        n.type === "creator_update"
    );
  }
  if (tab === "likes") return notifications.filter((n) => n.type === "like");
  if (tab === "follows") return notifications.filter((n) => n.type === "follow");
  return [];
}

function MessagesContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey) || "replies";
  const setTab = (key: TabKey) => {
    router.replace(`/messages?tab=${key}`, { scroll: false });
  };

  const { notifications, unreadCount, markAsRead, isLoading: notificationsLoading } = useNotifications();
  const { conversations, isLoading: conversationsLoading } = useConversations();

  const filteredNotifications = tab !== "dm" ? filterByTab(notifications, tab) : [];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.is_read) await markAsRead(n.id);
    if (n.type === "creator_update" && n.project_id) {
      router.push(`/project/${n.project_id}`);
    } else if (n.type === "follow" && n.from_user_id) {
      router.push(`/users/${n.from_user_id}`);
    } else if (n.related_type === "comment" && n.project_id && n.related_id) {
      router.push(`/project/${n.project_id}#comment-${n.related_id}`);
    } else if (
      n.related_type === "discussion_reply" &&
      n.discussion_id &&
      n.related_id
    ) {
      router.push(`/community/discussion/${n.discussion_id}#reply-${n.related_id}`);
    } else if (n.type === "like" && n.project_id) {
      router.push(`/project/${n.project_id}`);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-4 px-4 pb-24 md:pb-8">
      <h1 className="text-xl font-bold mb-4 md:mb-4">消息</h1>

      {/* 移动端：一排 4 个紧凑入口 */}
      <div className="grid grid-cols-4 gap-2 mb-6 md:hidden">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            title={label}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 rounded-lg transition-colors active:scale-[0.98]",
              tab === key
                ? "bg-primary/15 text-foreground"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[11px] font-medium leading-tight text-center line-clamp-2">{label}</span>
          </button>
        ))}
      </div>

      {/* 桌面端：横向 Tab */}
      <div className="hidden md:flex gap-2 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 shrink-0 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              tab === key
                ? "bg-primary/15 text-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 回复与@ / 收到喜欢 / 新增粉丝 */}
      {tab !== "dm" && (
        <>
          {notificationsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse"
                >
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 h-4 w-48 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {tab === "replies" && "暂无回复与@提及"}
              {tab === "likes" && "暂无收到喜欢"}
              {tab === "follows" && "暂无新增粉丝"}
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredNotifications.map((n) => (
                <li key={n.id}>
                  <div
                    className={cn(
                      "w-full flex items-center gap-3 min-h-14 py-4 px-3 rounded-xl md:min-h-0 md:py-3 md:rounded-lg",
                      !n.is_read && "bg-accent/40"
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-3 min-w-0 flex-1 text-left hover:bg-muted/60 active:bg-muted/80 transition-colors rounded-lg -m-1 p-1 md:py-2 md:px-2"
                      )}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {n.from_username ? (
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={n.from_avatar ?? undefined} alt={n.from_username} />
                          <AvatarFallback className="bg-primary/10">
                            {n.from_username[0]}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{n.content}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                    {tab === "follows" && n.from_user_id && (
                      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                        <FollowButton targetUserId={n.from_user_id} followBack className="min-w-[72px]" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* 私信 */}
      {tab === "dm" && (
        <>
          {conversationsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse"
                >
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="font-medium">暂无私信</p>
              <p className="text-sm mt-1">去用户主页发起私信，与创作者协作交流吧。</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.peerId}>
                  <Link
                    href={`/messages/${conv.peerId}`}
                    className="flex items-center gap-3 min-h-16 py-4 px-3 rounded-xl hover:bg-muted/60 active:bg-muted/80 transition-colors md:min-h-0 md:py-3 md:rounded-lg"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage
                        src={conv.avatarUrl ?? undefined}
                        alt={conv.displayName ?? ""}
                      />
                      <AvatarFallback className="bg-primary/10">
                        {(conv.displayName || conv.peerId.slice(0, 2))[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{conv.displayName || "用户"}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.lastContent}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(conv.lastAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
