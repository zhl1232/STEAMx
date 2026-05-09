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

export type Notification = {
  id: number;
  user_id: string;
  type: "mention" | "reply" | "like" | "follow" | "system" | "creator_update" | "tip";
  content: string;
  related_type?: "comment" | "discussion_reply" | "project" | "discussion";
  related_id?: number;
  project_id?: number; // For comment notifications
  discussion_id?: number; // For discussion_reply notifications
  from_user_id?: string;
  from_username?: string;
  from_avatar?: string; // User avatar URL
  is_read: boolean;
  created_at: string;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  createNotification: (
    notification: Omit<Notification, "id" | "is_read" | "created_at">,
  ) => Promise<void>;
  isLoading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const EMPTY_NOTIFICATION_CONTEXT: NotificationContextType = {
  notifications: [],
  unreadCount: 0,
  hasMore: false,
  isLoadingMore: false,
  loadMore: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  clearAll: async () => {},
  createNotification: async () => {},
  isLoading: false,
};

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
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);
  const hasMoreRef = useRef(true);
  const { user } = useAuth();
  const shouldLoadNotificationList = pathname === "/messages";

  notificationsRef.current = notifications;
  hasMoreRef.current = hasMore;

  const fetchingUnreadRef = useRef(false);
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    if (fetchingUnreadRef.current) return;
    fetchingUnreadRef.current = true;
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.status === 401) {
        setUnreadCount(0);
        return;
      }
      if (!response.ok) {
        logger.error("Error fetching unread count:", { detail: await response.text() });
        return;
      }
      const payload = await response.json();
      setUnreadCount(Number(payload?.count ?? 0));
    } catch (error) {
      logger.error(error, { context: "Error fetching unread count" });
    } finally {
      fetchingUnreadRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchingNotificationsRef = useRef(false);
  const fetchNotifications = useCallback(
    async ({ reset = true, merge = false }: { reset?: boolean; merge?: boolean } = {}) => {
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setHasMore(true);
        setIsLoading(false);
        return;
      }
      if (fetchingNotificationsRef.current) return;
      fetchingNotificationsRef.current = true;
      if (reset) setIsLoading(true);
      try {
        const response = await fetch("/api/notifications");
        if (response.status === 401) {
          setNotifications([]);
          setUnreadCount(0);
          setHasMore(true);
          return;
        }
        if (!response.ok) {
          logger.error("Error fetching notifications:", { detail: await response.text() });
          return;
        }
        const payload = await response.json();
        const list = (payload?.notifications || []) as Notification[];
        if (merge) {
          const mergedState = mergeLatestNotificationState(
            list,
            notificationsRef.current,
            hasMoreRef.current,
          );
          setNotifications(mergedState.notifications);
          setHasMore(mergedState.hasMore);
        } else {
          setNotifications(list);
          setHasMore(Boolean(payload?.hasMore));
        }
      } catch (error) {
        logger.error(error, { context: "Error fetching notifications" });
      } finally {
        fetchingNotificationsRef.current = false;
        if (reset) setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );

  const loadMore = useCallback(async () => {
    const list = notificationsRef.current;
    if (!user || !hasMore || isLoadingMore || list.length === 0) return;
    const last = list[list.length - 1];
    const lastCreated = last?.created_at;
    if (!lastCreated) return;
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ before: lastCreated });
      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.status === 401) {
        setIsLoadingMore(false);
        return;
      }
      if (!response.ok) {
        logger.error("Error loading more notifications:", { detail: await response.text() });
        setIsLoadingMore(false);
        return;
      }
      const payload = await response.json();
      const next = (payload?.notifications || []) as Notification[];
      setNotifications((prev) => [...prev, ...next]);
      setHasMore(Boolean(payload?.hasMore));
    } catch (error) {
      logger.error(error, { context: "Error loading more notifications" });
    } finally {
      setIsLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hasMore, isLoadingMore]);

  const fetchUnreadCountRef = useRef(fetchUnreadCount);
  const fetchNotificationsRef = useRef(fetchNotifications);
  fetchUnreadCountRef.current = fetchUnreadCount;
  fetchNotificationsRef.current = fetchNotifications;

  useEffect(() => {
    if (!user?.id) {
      setNotifications((prev) => (prev.length === 0 ? prev : []));
      setUnreadCount(0);
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

  useEffect(() => {
    if (!user?.id) return;

    const interval = window.setInterval(() => {
      if (shouldLoadNotificationList) {
        void fetchNotificationsRef.current({ reset: false, merge: true });
      }
      void fetchUnreadCountRef.current();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [user?.id, shouldLoadNotificationList]);

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

      if (!wasUnread) {
        return;
      }

      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
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

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
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
        fetchUnreadCount();
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

    setNotifications([]);
    setUnreadCount(0);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      hasMore,
      isLoadingMore,
      loadMore,
      markAsRead,
      markAllAsRead,
      clearAll,
      createNotification,
      isLoading,
    }),
    [
      notifications,
      unreadCount,
      hasMore,
      isLoadingMore,
      loadMore,
      markAsRead,
      markAllAsRead,
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
