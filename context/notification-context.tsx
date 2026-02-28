"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/auth-context";

export type Notification = {
    id: number;
    user_id: string;
    type: 'mention' | 'reply' | 'like' | 'follow' | 'system' | 'creator_update';
    content: string;
    related_type?: 'comment' | 'discussion_reply' | 'project' | 'discussion';
    related_id?: number;
    project_id?: number;  // For comment notifications
    discussion_id?: number;  // For discussion_reply notifications
    from_user_id?: string;
    from_username?: string;
    from_avatar?: string;  // User avatar URL
    is_read: boolean;
    created_at: string;
};

const NOTIFICATION_PAGE_SIZE = 20;

type NotificationContextType = {
    notifications: Notification[];
    unreadCount: number;
    hasMore: boolean;
    isLoadingMore: boolean;
    loadMore: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    createNotification: (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => Promise<void>;
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
    const supabase = createClient();
    const { user } = useAuth();

    notificationsRef.current = notifications;

    const fetchUnreadCount = useCallback(async () => {
        if (!user) return;
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false);
        if (!error) setUnreadCount(count ?? 0);
    }, [user?.id, supabase]);

    const fetchNotifications = useCallback(async (reset = true) => {
        if (!user) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }
        if (reset) setIsLoading(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(NOTIFICATION_PAGE_SIZE);

        if (error) {
            console.error('Error fetching notifications:', error);
            setIsLoading(false);
            return;
        }
        const list = data || [];
        setNotifications(list);
        setHasMore(list.length === NOTIFICATION_PAGE_SIZE);
        setIsLoading(false);
    }, [user?.id, supabase]);

    const loadMore = useCallback(async () => {
        const list = notificationsRef.current;
        if (!user || !hasMore || isLoadingMore || list.length === 0) return;
        const last = list[list.length - 1];
        const lastCreated = last?.created_at;
        if (!lastCreated) return;
        setIsLoadingMore(true);
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .lt('created_at', lastCreated)
            .order('created_at', { ascending: false })
            .limit(NOTIFICATION_PAGE_SIZE);

        if (error) {
            console.error('Error loading more notifications:', error);
            setIsLoadingMore(false);
            return;
        }
        const next = data || [];
        setNotifications((prev) => [...prev, ...next]);
        setHasMore(next.length === NOTIFICATION_PAGE_SIZE);
        setIsLoadingMore(false);
    }, [user?.id, hasMore, isLoadingMore]);

    useEffect(() => {
        if (!user?.id) return;

        fetchNotifications(true);
        fetchUnreadCount();
    }, [user?.id, fetchNotifications, fetchUnreadCount]);

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase
            .channel('notifications')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                () => {
                    fetchNotifications(true);
                    fetchUnreadCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchNotifications, fetchUnreadCount, supabase]);

    const markAsRead = useCallback(async (id: number) => {
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true } as never)
            .eq('id', id);

        if (error) {
            console.error('Error marking notification as read:', error);
            return;
        }

        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount((c) => Math.max(0, c - 1));
    }, [user?.id, supabase]);

    const markAllAsRead = useCallback(async () => {
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true } as never)
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (error) {
            console.error('Error marking all notifications as read:', error);
            return;
        }

        setNotifications(prev =>
            prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
    }, [user?.id, supabase]);

    const createNotification = useCallback(async (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => {
        const { error } = await supabase
            .from('notifications')
            .insert(notification as never);

        if (error) {
            console.error('Error creating notification:', error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const clearAll = useCallback(async () => {
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id);

        if (error) {
            console.error('Error clearing notifications:', error);
            return;
        }

        setNotifications([]);
        setUnreadCount(0);
        setHasMore(true);
    }, [user?.id, supabase]);

    const contextValue = useMemo(() => ({
        notifications,
        unreadCount,
        hasMore,
        isLoadingMore,
        loadMore,
        markAsRead,
        markAllAsRead,
        clearAll,
        createNotification,
        isLoading
    }), [notifications, unreadCount, hasMore, isLoadingMore, loadMore, markAsRead, markAllAsRead, clearAll, createNotification, isLoading]);

    return (
        <NotificationContext.Provider value={contextValue}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error("useNotifications must be used within a NotificationProvider");
    }
    return context;
}
