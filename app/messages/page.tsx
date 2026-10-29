"use client";

import { Skeleton } from "@/components/ui/skeleton"
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  BrushCleaning,
  CheckCheck,
  Heart,
  MessageCircle,
  MessageSquare,
  UserPlus,
  Megaphone,
  Headphones,
} from "lucide-react";

import { WelcomeActions } from "@/components/features/communications/welcome-actions";
import { FollowButton } from "@/components/features/social/follow-button";
import { Button } from "@/components/ui/button";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { UserAvatar } from "@/components/ui/user-avatar";
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
    icon: MessageSquare,
  },
  {
    key: "likes",
    label: "收到喜欢",
    shortLabel: "喜欢",
    icon: Heart,
  },
  {
    key: "follows",
    label: "新增粉丝",
    shortLabel: "粉丝",
    icon: UserPlus,
  },
  {
    key: "dm",
    label: "私信",
    shortLabel: "私信",
    icon: MessageCircle,
  },
  { key: "system", label: "系统公告", shortLabel: "公告", icon: Megaphone },
  { key: "support", label: "服务消息", shortLabel: "服务", icon: Headphones },
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
  if (tab === "system") return notifications.filter((n) => n.type === "system");
  return [];
}

function getUnreadByTab(notifications: Notification[], dmUnreadCount: number, counts?: Record<string, number>) {
  const unread = notifications.filter((n) => !n.is_read);

  return {
    replies: counts?.replies ?? unread.filter(
      (n) => n.type === "mention" || n.type === "reply" || n.type === "creator_update",
    ).length,
    likes: counts?.likes ?? unread.filter((n) => n.type === "like" || n.type === "tip").length,
    follows: counts?.follows ?? unread.filter((n) => n.type === "follow").length,
    system: counts?.system ?? unread.filter((n) => n.type === "system").length,
    dm: dmUnreadCount,
  };
}

function MessagePageSkeleton() {
  return (
    <div className="flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader title="消息" fallbackHref="/" />
        <div className="mobile-subnav sticky top-(--mobile-page-header-height) z-20">
          <div className="px-4 pb-3 pt-1">
            <Skeleton className="h-10 w-full rounded-full" />
          </div>
        </div>
      </div>

      <div className="app-shell-narrow flex-1 md:pt-8">
      <div className="surface-panel overflow-hidden">
        <div className="hidden border-b border-border/60 px-4 py-4 sm:px-6 sm:py-5 md:block">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="mt-3 h-9 w-40 rounded-md" />
          <Skeleton className="mt-4 h-10 w-full rounded-full" />
        </div>
        <div className="space-y-3 px-4 py-5 sm:px-6">
          {[1, 2, 3].map((item) => (
            <div key={item} className="surface-subtle flex items-center gap-3 px-4 py-4">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
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
  const setTab = (key: TabKey) => {
    router.replace(`/messages?tab=${key}`, { scroll: false });
  };

  const {
    notifications,
    notificationUnreadCount,
    dmUnreadCount,
    supportUnreadCount = 0,
    supportUnreadByChannel = { platform: supportUnreadCount, store: 0 },
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
    isLoadingMore,
    isLoading: notificationsLoading,
    unreadCountsByCategory,
    loadCategory,
  } = useNotifications();
  const {
    conversations,
    dmUnreadCount: conversationsDmUnreadCount,
    isLoading: conversationsLoading,
    error: conversationsError,
  } = useConversations();

  const filteredNotifications = tab !== "dm" ? filterByTab(notifications, tab) : [];
  const unreadByTab = { ...getUnreadByTab(notifications, Math.max(dmUnreadCount, conversationsDmUnreadCount), unreadCountsByCategory), support: supportUnreadCount };
  const hasNotificationUnread = notificationUnreadCount > 0;
  const canMarkAllNotificationsRead = tab !== "dm" && tab !== "support" && hasNotificationUnread;
  const loadMoreRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (tab !== 'dm' && tab !== 'support' && loadCategory) void loadCategory(tab);
  }, [tab, loadCategory]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || tab === "dm" || tab === "support") return;

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
    <div className="flex min-h-[calc(100dvh-var(--mobile-global-header-height,0rem))] w-full flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="md:hidden">
        <MobilePageHeader
          title="消息"
          fallbackHref="/"
          rightSlot={
            canMarkAllNotificationsRead ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => markAllAsRead()}
                aria-label="全部标为已读"
                title="全部标为已读"
              >
                <BrushCleaning className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null
          }
        />
        <div className="mobile-subnav sticky top-(--mobile-page-header-height) z-20">
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
      </div>

      <div className="app-shell-narrow flex-1 md:pt-8">
      <section className="surface-panel overflow-hidden max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none max-md:backdrop-blur-0">
        <div className="hidden border-b border-border/60 px-6 py-6 md:block">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="section-kicker">消息中心</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">消息中心</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                查看互动、私信、服务回复和系统通知。
              </p>
            </div>
            {canMarkAllNotificationsRead ? (
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

        <div className="px-0 py-5 sm:px-5 sm:py-6 md:px-6">
          {tab === "support" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {([{channel:'platform',title:'平台帮助',description:'课程使用、账号问题与社区反馈。',href:'/support'}, {channel:'store',title:'商城客服',description:'商品咨询、订单配送与退换货售后。',href:'/store/support'}] as const).map(item=><section key={item.channel} className="surface-subtle px-5 py-8">
                <div className="flex items-center gap-3"><Headphones className="h-6 w-6 text-primary" /><h2 className="text-panel-title">{item.title}</h2></div>
                <p className="mt-3 text-sm text-muted-foreground">{item.description}</p>
                {supportUnreadByChannel[item.channel]>0?<p className="mt-3 text-sm font-medium text-primary">{item.title}有 {supportUnreadByChannel[item.channel]} 条未读回复</p>:null}
                <Button asChild className="mt-5" tone="brand"><Link href={item.href}>查看{item.title}会话</Link></Button>
              </section>)}
            </div>
          ) : tab !== "dm" ? (
            notificationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="surface-subtle flex items-center gap-3 px-4 py-4">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-4/5 rounded-full" />
                      <Skeleton className="h-3 w-24 rounded-full" />
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
                  {tab === "system" && "还没有系统公告"}
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
                        !notification.is_read && "border-primary/25 bg-primary/6",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition-colors hover:bg-muted/60 active:bg-muted/80"
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {notification.type === "system" ? (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Megaphone className="h-5 w-5" /></div>
                          ) : notification.from_username ? (
                            <UserAvatar
                              userId={notification.from_user_id}
                              name={notification.from_username}
                              src={notification.from_avatar}
                              href={null}
                              className="h-11 w-11 shrink-0"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <MessageSquare className="h-5 w-5" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            {notification.type === "system" ? <p className="mb-1 text-xs text-muted-foreground">平台助手</p> : null}
                            {notification.title ? <p className="font-medium text-foreground">{notification.title}</p> : null}
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
                      {notification.system_kind === "welcome" ? <WelcomeActions onRead={() => void markAsRead(notification.id)} /> : null}
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
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 rounded-full" />
                    <Skeleton className="h-3 w-4/5 rounded-full" />
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
                    <UserAvatar
                      userId={conversation.peerId}
                      name={conversation.displayName || conversation.peerId.slice(0, 2)}
                      src={conversation.avatarUrl}
                      href={null}
                      className="h-12 w-12 shrink-0"
                    />
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
