"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { usePathname } from "next/navigation";
import { useAuth } from '@/lib/context/auth-context';
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/client";

export type Notification = {
  id: number;
  user_id: string;
  type: "mention" | "reply" | "like" | "follow" | "system" | "creator_update" | "tip";
  content: string;
  related_type?: "comment" | "discussion_reply" | "project" | "discussion" | "observation";
  related_id?: number;
  project_id?: number; // For comment notifications
  discussion_id?: number; // For discussion_reply notifications
  from_user_id?: string;
  from_username?: string;
  from_avatar?: string; // User avatar URL
  is_read: boolean;
  created_at: string;
  title?: string | null;
  system_kind?: 'welcome' | 'announcement' | null;
  announcement_id?: number | null;
};
export type NotificationCategory = 'system' | 'replies' | 'likes' | 'follows';

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  notificationUnreadCount: number;
  unreadCountsByCategory: Record<NotificationCategory, number>;
  dmUnreadCount: number;
  supportUnreadCount: number;
  supportUnreadByChannel: { platform: number; store: number };
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  loadCategory: (category: NotificationCategory) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  clearAll: () => Promise<void>;
  createNotification: (
    notification: Omit<Notification, "id" | "is_read" | "created_at">,
  ) => Promise<void>;
  isLoading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const UNREAD_COUNT_CACHE_TTL_MS = 1500;
const EMPTY_NOTIFICATION_CONTEXT: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  notificationUnreadCount: 0,
  unreadCountsByCategory: { system: 0, replies: 0, likes: 0, follows: 0 },
  dmUnreadCount: 0,
  supportUnreadCount: 0,
  supportUnreadByChannel: { platform: 0, store: 0 },
  hasMore: false,
  isLoadingMore: false,
  loadMore: async () => {},
  loadCategory: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  refreshUnreadCount: async () => {},
  clearAll: async () => {},
  createNotification: async () => {},
  isLoading: false,
};

type UnreadCountSnapshot = {
  notificationUnreadCount: number;
  dmUnreadCount: number;
  unreadCountsByCategory: Record<NotificationCategory, number>;
};

let unreadCountCache: { userId: string; fetchedAt: number; data: UnreadCountSnapshot } | null = null;
let unreadCountInFlight: { userId: string; promise: Promise<UnreadCountSnapshot> } | null = null;
let notificationRealtimeUnavailable = false;

function isLocalDevelopmentHost() {
  if (process.env.NODE_ENV !== "development") return false;
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function shouldSubscribeRealtimeNotifications() {
  if (notificationRealtimeUnavailable) return false;
  if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME === "true") return true;
  if (process.env.NEXT_PUBLIC_ENABLE_NOTIFICATION_REALTIME === "false") return false;
  return !isLocalDevelopmentHost();
}

function isRealtimeFailureStatus(status: string) {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT";
}

async function fetchUnreadCountSnapshot(userId: string, { force = false }: { force?: boolean } = {}) {
  const now = Date.now();
  if (
    !force &&
    unreadCountCache?.userId === userId &&
    now - unreadCountCache.fetchedAt < UNREAD_COUNT_CACHE_TTL_MS
  ) {
    return unreadCountCache.data;
  }

  if (!force && unreadCountInFlight?.userId === userId) {
    return unreadCountInFlight.promise;
  }

  const promise = (async (): Promise<UnreadCountSnapshot> => {
    const [notificationResponse, dmResponse] = await Promise.all([
      fetch("/api/notifications/unread-count"),
      fetch("/api/messages/unread-count"),
    ]);

    if (notificationResponse.status === 401 || dmResponse.status === 401) {
      return { notificationUnreadCount: 0, dmUnreadCount: 0, unreadCountsByCategory: { system: 0, replies: 0, likes: 0, follows: 0 } };
    }

    let notificationUnreadCount = unreadCountCache?.userId === userId
      ? unreadCountCache.data.notificationUnreadCount
      : 0;
    let dmUnreadCount = unreadCountCache?.userId === userId
      ? unreadCountCache.data.dmUnreadCount
      : 0;

    let unreadCountsByCategory: Record<NotificationCategory, number> = unreadCountCache?.userId === userId
      ? unreadCountCache.data.unreadCountsByCategory
      : { system: 0, replies: 0, likes: 0, follows: 0 };
    if (notificationResponse.ok) {
      const payload = await notificationResponse.json();
      notificationUnreadCount = Number(payload?.count ?? 0);
      if (payload?.countsByCategory) unreadCountsByCategory = { ...unreadCountsByCategory, ...payload.countsByCategory };
    } else {
      logger.error("Error fetching notification unread count:", {
        detail: await notificationResponse.text(),
      });
    }

    if (dmResponse.ok) {
      const payload = await dmResponse.json();
      dmUnreadCount = Number(payload?.count ?? 0);
    } else {
      logger.error("Error fetching message unread count:", { detail: await dmResponse.text() });
    }

    return { notificationUnreadCount, dmUnreadCount, unreadCountsByCategory };
  })();

  unreadCountInFlight = { userId, promise };

  try {
    const data = await promise;
    unreadCountCache = { userId, fetchedAt: Date.now(), data };
    return data;
  } finally {
    if (unreadCountInFlight?.promise === promise) {
      unreadCountInFlight = null;
    }
  }
}

function updateUnreadCountCache(
  userId: string,
  updater: (current: UnreadCountSnapshot) => UnreadCountSnapshot,
) {
  if (!unreadCountCache || unreadCountCache.userId !== userId) return;
  unreadCountCache = {
    userId,
    fetchedAt: Date.now(),
    data: updater(unreadCountCache.data),
  };
}

export function __resetNotificationUnreadCountCacheForTests() {
  if (process.env.NODE_ENV !== "test") return;
  unreadCountCache = null;
  unreadCountInFlight = null;
  notificationRealtimeUnavailable = false;
}

export function mergeLatestNotifications(latest: Notification[], existing: Notification[]) {
  const latestIds = new Set(latest.map((notification) => notification.id));
  return [...latest, ...existing.filter((notification) => !latestIds.has(notification.id))];
}

export function mergeLatestNotificationState(
  latest: Notification[],
  existing: Notification[],
  previousHasMore: boolean,
) {
  return {
    notifications: mergeLatestNotifications(latest, existing),
    hasMore: previousHasMore,
  };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [unreadCountsByCategory, setUnreadCountsByCategory] = useState<Record<NotificationCategory, number>>({ system: 0, replies: 0, likes: 0, follows: 0 });
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [supportUnreadByChannel, setSupportUnreadByChannel] = useState({ platform: 0, store: 0 });
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);
  const hasMoreRef = useRef(true);
  const { user } = useAuth();
  const shouldLoadNotificationList = pathname === "/messages";
  const currentUserRef = useRef(user?.id);

  // Support is a separate inbox. Only its count contributes to the common bell.
  // A visible-page timer works without requiring Realtime on the private tables.
  useEffect(() => {
    setSupportUnreadCount(0);
    setSupportUnreadByChannel({ platform: 0, store: 0 });
    if (!user?.id) return;
    const userId = user.id;
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (disposed || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const response = await fetch('/api/support/unread', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        if (!disposed && currentUserRef.current === userId) {
          const total=Math.max(0, Number(payload?.unreadCount) || 0);
          setSupportUnreadCount(total);
          setSupportUnreadByChannel({
            platform: Math.max(0, Number(payload?.unreadByChannel?.platform ?? total) || 0),
            store: Math.max(0, Number(payload?.unreadByChannel?.store) || 0),
          });
        }
      } catch { /* A failed reminder count must not hide existing notifications. */ }
      finally { pending = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('support:updated', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('support:updated', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.id]);
  const categoryRef = useRef<NotificationCategory | null>(null);
  const listRequestRef = useRef(0);
  if (currentUserRef.current !== user?.id) {
    currentUserRef.current = user?.id;
    listRequestRef.current += 1;
  }


  notificationsRef.current = notifications;
  hasMoreRef.current = hasMore;

  const fetchUnreadCount = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!user) {
      setNotificationUnreadCount(0);
      setUnreadCountsByCategory({ system: 0, replies: 0, likes: 0, follows: 0 });
      setDmUnreadCount(0);
      return;
    }
    try {
      const snapshot = await fetchUnreadCountSnapshot(user.id, { force });
      if (currentUserRef.current !== user.id) return;
      setNotificationUnreadCount(snapshot.notificationUnreadCount);
      setUnreadCountsByCategory(snapshot.unreadCountsByCategory);
      setDmUnreadCount(snapshot.dmUnreadCount);
    } catch (error) {
      logger.error(error, { context: "Error fetching unread count" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchNotifications = useCallback(
    async ({ reset = true, merge = false }: { reset?: boolean; merge?: boolean } = {}) => {
      const requestId = ++listRequestRef.current;
      const userId = user?.id;
      const isCurrent = () => requestId === listRequestRef.current && currentUserRef.current === userId;
      if (!userId) {
        setNotifications([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      if (reset) setIsLoading(true);
      setIsLoadingMore(false);
      try {
        const category = categoryRef.current;
        const response = await fetch(category ? `/api/notifications?category=${category}` : '/api/notifications');
        if (!isCurrent()) return;
        if (response.status === 401) {
          setNotifications([]);
          setHasMore(false);
          return;
        }
        if (!response.ok) throw new Error('通知加载失败');
        const payload = await response.json();
        if (!isCurrent()) return;
        const list = (payload?.notifications || []) as Notification[];
        if (merge) {
          setNotifications(mergeLatestNotifications(list, notificationsRef.current));
        } else {
          setNotifications(list);
          setHasMore(Boolean(payload?.hasMore));
        }
      } catch (error) {
        if (isCurrent()) logger.error(error, { context: 'Error fetching notifications' });
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [user?.id],
  );

  const loadMore = useCallback(async () => {
    const list = notificationsRef.current;
    if (!user || !hasMore || isLoadingMore || list.length === 0) return;
    const last = list[list.length - 1];
    if (!last?.created_at) return;
    const requestId = ++listRequestRef.current;
    const userId = user.id;
    const isCurrent = () => requestId === listRequestRef.current && currentUserRef.current === userId;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ before: last.created_at, beforeId: String(last.id) });
      if (categoryRef.current) params.set('category', categoryRef.current);
      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error('更多通知加载失败');
      const payload = await response.json();
      if (!isCurrent()) return;
      const next = (payload?.notifications || []) as Notification[];
      setNotifications((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        return [...prev, ...next.filter((item) => !ids.has(item.id))];
      });
      setHasMore(Boolean(payload?.hasMore));
    } catch (error) {
      if (isCurrent()) logger.error(error, { context: 'Error loading more notifications' });
    } finally {
      if (isCurrent()) setIsLoadingMore(false);
    }
  }, [user?.id, hasMore, isLoadingMore]);

  const loadCategory = useCallback(async (category: NotificationCategory) => {
    categoryRef.current = category;
    listRequestRef.current += 1;
    setNotifications([]);
    setHasMore(false);
    await fetchNotifications();
  }, [fetchNotifications]);

  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  const fetchNotificationsRef = useRef(fetchNotifications);
  fetchUnreadCountRef.current = fetchUnreadCount;
  fetchNotificationsRef.current = fetchNotifications;

  useEffect(() => {
    listRequestRef.current += 1;
    setNotifications([]);
    setIsLoadingMore(false);
    if (!user?.id) {
      setNotifications((prev) => (prev.length === 0 ? prev : []));
      setNotificationUnreadCount(0);
      setUnreadCountsByCategory({ system: 0, replies: 0, likes: 0, follows: 0 });
      setDmUnreadCount(0);
      setHasMore(true);
      setIsLoading(false);
      return;
    }

    if (shouldLoadNotificationList) {
      fetchNotificationsRef.current({ reset: true });
    } else {
      setNotifications((prev) => (prev.length === 0 ? prev : []));
      setHasMore(true);
      setIsLoading(false);
    }

    fetchUnreadCountRef.current();
  }, [user?.id, shouldLoadNotificationList]);

  const shouldLoadNotificationListRef = useRef(shouldLoadNotificationList);
  shouldLoadNotificationListRef.current = shouldLoadNotificationList;

  // Realtime 订阅：通知/私信表有自己的新行或变更时刷新未读数，替代轮询。
  useEffect(() => {
    if (!user?.id) return;
    if (!shouldSubscribeRealtimeNotifications()) return;

    const supabase = createClient();
    let refreshTimer: number | null = null;

    // 短防抖合并连续事件（如批量标记已读）。
    const scheduleRefresh = () => {
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void fetchUnreadCountRef.current();
        if (shouldLoadNotificationListRef.current) {
          void fetchNotificationsRef.current({ reset: false, merge: true });
        }
      }, 500);
    };

    const channel = supabase.channel(`unread-counts:${user.id}`, {
      config: { private: true },
    });
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `receiver_id=eq.${user.id}` },
        scheduleRefresh,
      )
      .subscribe((status, error) => {
        if (isRealtimeFailureStatus(status)) {
          notificationRealtimeUnavailable = true;
          logger.warn("Notification realtime channel unavailable; HTTP unread-count fallback remains active.", {
            status,
            error,
          });
          void supabase.removeChannel(channel).finally(() => {
            supabase.realtime.disconnect();
          });
        }
      });

    // 兜底：WebSocket 断线期间可能漏事件，回到前台时刷一次。
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadCountRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = useCallback(
    async (id: number) => {
      if (!user) return;
      const wasUnread = notificationsRef.current.some((n) => n.id === id && !n.is_read);

      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        logger.error("Error marking notification as read:", { detail: await response.text() });
        return;
      }

      if (currentUserRef.current !== user.id || !wasUnread) {
        return;
      }

      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setNotificationUnreadCount((c) => Math.max(0, c - 1));
      const notification = notificationsRef.current.find((n) => n.id === id);
      const category = notification?.type === 'system' ? 'system'
        : notification?.type === 'follow' ? 'follows'
        : notification?.type === 'like' || notification?.type === 'tip' ? 'likes' : 'replies';
      setUnreadCountsByCategory((counts) => ({ ...counts, [category]: Math.max(0, counts[category] - 1) }));
      updateUnreadCountCache(user.id, (current) => ({
        ...current,
        notificationUnreadCount: Math.max(0, current.notificationUnreadCount - 1),
        unreadCountsByCategory: { ...current.unreadCountsByCategory, [category]: Math.max(0, current.unreadCountsByCategory[category] - 1) },
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const response = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    });

    if (!response.ok) {
      logger.error("Error marking all notifications as read:", { detail: await response.text() });
      return;
    }

    if (currentUserRef.current !== user.id) return;
    listRequestRef.current += 1;
    setIsLoadingMore(false);
    setIsLoading(false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setNotificationUnreadCount(0);
    setUnreadCountsByCategory({ system: 0, replies: 0, likes: 0, follows: 0 });
    updateUnreadCountCache(user.id, (current) => ({ ...current, notificationUnreadCount: 0, unreadCountsByCategory: { system: 0, replies: 0, likes: 0, follows: 0 } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createNotification = useCallback(
    async (notification: Omit<Notification, "id" | "is_read" | "created_at">) => {
      if (!user) return;
      if (notification.user_id === user.id && notification.type !== "system") return;

      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        logger.error("Error creating notification:", { detail: await response.text() });
      } else if (notification.user_id === user.id) {
        if (shouldLoadNotificationList) {
          fetchNotifications({ reset: true });
        }
        fetchUnreadCount({ force: true });
      }
    },
    [user, shouldLoadNotificationList, fetchNotifications, fetchUnreadCount],
  );

  const clearAll = useCallback(async () => {
    if (!user) return;

    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    });

    if (!response.ok) {
      logger.error("Error clearing notifications:", { detail: await response.text() });
      return;
    }

    if (currentUserRef.current !== user.id) return;
    listRequestRef.current += 1;
    setNotifications([]);
    setNotificationUnreadCount(0);
    setUnreadCountsByCategory({ system: 0, replies: 0, likes: 0, follows: 0 });
    setIsLoadingMore(false);
    setIsLoading(false);
    setHasMore(false);
    updateUnreadCountCache(user.id, (current) => ({ ...current, notificationUnreadCount: 0, unreadCountsByCategory: { system: 0, replies: 0, likes: 0, follows: 0 } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unreadCount = notificationUnreadCount + dmUnreadCount + supportUnreadCount;
  const refreshUnreadCount = useCallback(() => fetchUnreadCount({ force: true }), [fetchUnreadCount]);

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      notificationUnreadCount,
      unreadCountsByCategory,
      dmUnreadCount,
      supportUnreadCount,
      supportUnreadByChannel,
      hasMore,
      isLoadingMore,
      loadMore,
      loadCategory,
      markAsRead,
      markAllAsRead,
      refreshUnreadCount,
      clearAll,
      createNotification,
      isLoading,
    }),
    [
      notifications,
      unreadCount,
      notificationUnreadCount,
      unreadCountsByCategory,
      dmUnreadCount,
      supportUnreadCount,
      supportUnreadByChannel,
      hasMore,
      isLoadingMore,
      loadMore,
      loadCategory,
      markAsRead,
      markAllAsRead,
      refreshUnreadCount,
      clearAll,
      createNotification,
      isLoading,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

export function useOptionalNotifications() {
  return useContext(NotificationContext) ?? EMPTY_NOTIFICATION_CONTEXT;
}
