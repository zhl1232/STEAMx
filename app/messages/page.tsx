"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  CheckCheck,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
} from "lucide-react";

import { FollowButton } from "@/components/features/social/follow-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { useAuth } from '@/lib/context/auth-context';
import { useNotifications, type Notification } from '@/lib/context/notification-context';
import { useConversations } from "@/hooks/use-messages";
import { getNotificationTargetHref } from "@/lib/notifications/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  {
    key: "replies",
    label: "回复与@",
    shortLabel: "回复",
    description: "查看提及、回复与创作者动态",
    icon: MessageSquare,
  },
  {
    key: "likes",
    label: "收到喜欢",
    shortLabel: "喜欢",
    description: "查看谁为你的内容点了赞",
    icon: Heart,
  },
  {
    key: "follows",
    label: "新增粉丝",
    shortLabel: "粉丝",
    description: "查看新关注你的用户",
    icon: UserPlus,
  },
  {
    key: "dm",
    label: "私信",
    shortLabel: "私信",
    description: "和创作者或同伴继续交流",
    icon: MessageCircle,
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];
const TAB_KEYS = new Set<TabKey>(TABS.map(({ key }) => key));

function getTabKey(value: string | null): TabKey {
  return value && TAB_KEYS.has(value as TabKey) ? (value as TabKey) : "replies";
}

function filterByTab(notifications: Notification[], tab: TabKey): Notification[] {
  if (tab === "replies") {
    return notifications.filter(
      (n) => n.type === "mention" || n.type === "reply" || n.type === "creator_update",
    );
  }
  if (tab === "likes") return notifications.filter((n) => n.type === "like" || n.type === "tip");
  if (tab === "follows") return notifications.filter((n) => n.type === "follow");
  return [];
}

function getUnreadByTab(notifications: Notification[], dmUnreadCount: number) {
  const unread = notifications.filter((n) => !n.is_read);

  return {
    replies: unread.filter(
      (n) => n.type === "mention" || n.type === "reply" || n.type === "creator_update",
    ).length,
    likes: unread.filter((n) => n.type === "like" || n.type === "tip").length,
    follows: unread.filter((n) => n.type === "follow").length,
    dm: dmUnreadCount,
  };
}

function MessagePageSkeleton() {
  return (
    <div className="page-shell pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
      <div className="surface-panel overflow-hidden">
        <div className="border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5">
          <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
          <div className="mt-3 h-9 w-40 animate-pulse rounded-md bg-muted" />
          <div className="mt-4 h-10 w-full animate-pulse rounded-full bg-muted" />
        </div>
        <div className="space-y-3 px-4 py-5 sm:px-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="surface-subtle flex items-center gap-3 px-4 py-4">
              <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessagesContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = getTabKey(searchParams.get("tab"));
  const activeTab = TABS.find((item) => item.key === tab) ?? TABS[0];
  const setTab = (key: TabKey) => {
    router.replace(`/messages?tab=${key}`, { scroll: false });
  };

  const {
    notifications,
    notificationUnreadCount,
    dmUnreadCount,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
    isLoadingMore,
    isLoading: notificationsLoading,
  } = useNotifications();
  const {
    conversations,
    dmUnreadCount: conversationsDmUnreadCount,
    isLoading: conversationsLoading,
    error: conversationsError,
  } = useConversations();

  const filteredNotifications = tab !== "dm" ? filterByTab(notifications, tab) : [];
  const unreadByTab = getUnreadByTab(notifications, Math.max(dmUnreadCount, conversationsDmUnreadCount));
  const hasNotificationUnread = notificationUnreadCount > 0;
  const loadMoreRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || tab === "dm") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) loadMore();
      },
      { rootMargin: "100px", threshold: 0 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, hasMore, isLoadingMore, loadMore]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) await markAsRead(notification.id);

    const href = getNotificationTargetHref(notification);
    if (href) router.push(href);
  };

  if (authLoading || !user) {
    return <MessagePageSkeleton />;
  }

  return (
    <div className="page-shell pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-10">
      <div className="mobile-subnav top-0 z-30 -mx-4 mb-4 md:hidden">
        <MobilePageHeader
          title="消息"
          fallbackHref="/"
          sticky={false}
          className="border-none bg-transparent shadow-none"
        />
        <div className="px-4 pb-3 pt-1">
          <div className="segmented-control flex w-full justify-between gap-1">
            {TABS.map(({ key, shortLabel }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "segmented-option min-w-0 flex-1 px-0",
                  tab === key && "segmented-option-active",
                )}
              >
                <span className="relative inline-flex items-center">
                  {shortLabel}
                  {unreadByTab[key] > 0 ? (
                    <span className="absolute -right-2.5 top-0 h-2 w-2 rounded-full bg-destructive" aria-hidden />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="surface-panel overflow-hidden">
        <div className="hidden border-b border-border/60 px-6 py-6 md:block">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="section-kicker">消息中心</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">站内通知与私信</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                把回复、喜欢、关注和私信收拢在同一处，减少在不同页面之间来回切换。
              </p>
            </div>
            {hasNotificationUnread ? (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => markAllAsRead()}>
                <CheckCheck className="h-4 w-4" />
                全部标为已读
              </Button>
            ) : null}
          </div>

          <div className="mt-6 segmented-control">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn("segmented-option gap-2", tab === key && "segmented-option-active")}
              >
                <span className="relative inline-flex items-center">
                  <Icon className="h-4 w-4" />
                  {unreadByTab[key] > 0 ? (
                    <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-destructive" aria-hidden />
                  ) : null}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-border/60 px-4 py-4 md:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{activeTab.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{activeTab.description}</p>
            </div>
            {hasNotificationUnread ? (
              <Button variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={() => markAllAsRead()}>
                全部已读
              </Button>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-5 sm:px-5 sm:py-6 md:px-6">
          {tab !== "dm" ? (
            notificationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="surface-subtle flex items-center gap-3 px-4 py-4">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted" />
                      <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="surface-subtle px-4 py-12 text-center">
                <p className="text-base font-medium text-foreground">
                  {tab === "replies" && "还没有新的回复或提及"}
                  {tab === "likes" && "还没有新的喜欢"}
                  {tab === "follows" && "还没有新的粉丝提醒"}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  新的互动会出现在这里，方便你继续回应和跟进。
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <li key={notification.id}>
                    <div
                      className={cn(
                        "surface-card p-3 transition-colors",
                        !notification.is_read && "border-primary/25 bg-primary/[0.06]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/60 active:bg-muted/80"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {notification.from_username ? (
                            <Avatar className="h-11 w-11 shrink-0">
                              <AvatarImage src={notification.from_avatar ?? undefined} alt={notification.from_username} />
                              <AvatarFallback className="bg-primary/10">
                                {notification.from_username[0]}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <MessageSquare className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6 text-foreground">{notification.content}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                  locale: zhCN,
                                })}
                              </span>
                              {!notification.is_read ? (
                                <>
                                  <span aria-hidden>·</span>
                                  <span className="font-medium text-primary">未读</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </button>

                        {tab === "follows" && notification.from_user_id ? (
                          <div onClick={(event) => event.stopPropagation()} className="shrink-0">
                            <FollowButton targetUserId={notification.from_user_id} followBack className="min-w-[72px]" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}

                {hasMore ? (
                  <li ref={loadMoreRef} className="flex justify-center pt-2">
                    <span className="text-sm text-muted-foreground">
                      {isLoadingMore ? "加载中…" : "继续下滑可加载更多"}
                    </span>
                  </li>
                ) : null}
              </ul>
            )
          ) : conversationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="surface-subtle flex items-center gap-3 px-4 py-4">
                  <div className="h-12 w-12 animate-pulse rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : conversationsError ? (
            <div className="surface-subtle px-4 py-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/70" />
              <p className="mt-4 text-base font-medium text-foreground">私信加载失败</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {conversationsError || "请稍后重试。"}
              </p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="surface-subtle px-4 py-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/70" />
              <p className="mt-4 text-base font-medium text-foreground">还没有私信对话</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                去用户主页发起私信，与创作者或同伴继续交流。
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {conversations.map((conversation) => (
                <li key={conversation.peerId}>
                  <Link
                    href={`/messages/${conversation.peerId}`}
                    className="surface-card flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/55 active:bg-muted/75"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={conversation.avatarUrl ?? undefined} alt={conversation.displayName ?? ""} />
                      <AvatarFallback className="bg-primary/10">
                        {(conversation.displayName || conversation.peerId.slice(0, 2))[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground">{conversation.displayName || "用户"}</p>
                        {conversation.unreadCount > 0 ? (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-none text-destructive-foreground">
                            {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={cn(
                          "mt-1 truncate text-sm",
                          conversation.unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {conversation.lastContent}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.lastAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagePageSkeleton />}>
      <MessagesContent />
    </Suspense>
  );
}
