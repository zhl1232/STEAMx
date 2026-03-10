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
import { useAuth } from "@/context/auth-context";

export type Notification = {
  id: number;
  user_id: string;
  type: "mention" | "reply" | "like" | "follow" | "system" | "creator_update";
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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);
  const { user } = useAuth();

  notificationsRef.current = notifications;

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.status === 401) {
        setUnreadCount(0);
        return;
      }
      if (!response.ok) {
        console.error("Error fetching unread count:", await response.text());
        return;
      }
      const payload = await response.json();
      setUnreadCount(Number(payload?.count ?? 0));
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [user]);

  const fetchNotifications = useCallback(
    async (reset = true) => {
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        setHasMore(true);
        setIsLoading(false);
        return;
      }
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
          console.error("Error fetching notifications:", await response.text());
          return;
        }
        const payload = await response.json();
        const list = (payload?.notifications || []) as Notification[];
        setNotifications(list);
        setHasMore(Boolean(payload?.hasMore));
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        if (reset) setIsLoading(false);
      }
    },
    [user],
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
        console.error("Error loading more notifications:", await response.text());
        setIsLoadingMore(false);
        return;
      }
      const payload = await response.json();
      const next = (payload?.notifications || []) as Notification[];
      setNotifications((prev) => [...prev, ...next]);
      setHasMore(Boolean(payload?.hasMore));
    } catch (error) {
      console.error("Error loading more notifications:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, hasMore, isLoadingMore]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setHasMore(true);
      setIsLoading(false);
      return;
    }

    fetchNotifications(true);
    fetchUnreadCount();
  }, [user?.id, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (!user?.id) return;

    const interval = window.setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [user?.id, fetchUnreadCount]);

  const markAsRead = useCallback(
    async (id: number) => {
      if (!user) return;

      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        console.error("Error marking notification as read:", await response.text());
        return;
      }

      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    },
    [user],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    const response = await fetch("/api/notifications/mark-all-read", {
      method: "POST",
    });

    if (!response.ok) {
      console.error("Error marking all notifications as read:", await response.text());
      return;
    }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, [user]);

  const createNotification = useCallback(
    async (notification: Omit<Notification, "id" | "is_read" | "created_at">) => {
      if (!user) return;

      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification),
      });

      if (!response.ok) {
        console.error("Error creating notification:", await response.text());
      } else if (notification.user_id === user.id) {
        fetchNotifications(true);
        fetchUnreadCount();
      }
    },
    [user, fetchNotifications, fetchUnreadCount],
  );

  const clearAll = useCallback(async () => {
    if (!user) return;

    const response = await fetch("/api/notifications/clear", {
      method: "POST",
    });

    if (!response.ok) {
      console.error("Error clearing notifications:", await response.text());
      return;
    }

    setNotifications([]);
    setUnreadCount(0);
    setHasMore(true);
  }, [user]);

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
