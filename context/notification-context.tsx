"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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

type NotificationContextType = {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    clearAll: () => Promise<void>;
    createNotification: (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => Promise<void>;
    isLoading: boolean;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();
    const { user } = useAuth();

    const fetchNotifications = async () => {
        if (!user) {
            setNotifications([]);
            setIsLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Error fetching notifications:', error);
            setIsLoading(false);
            return;
        }

        setNotifications(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        if (!user?.id) return;

        fetchNotifications();

        // Subscribe to realtime changes
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
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const markAsRead = async (id: number) => {
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
    };

    const markAllAsRead = async () => {
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
    };

    const createNotification = async (notification: Omit<Notification, 'id' | 'is_read' | 'created_at'>) => {
        const { error } = await supabase
            .from('notifications')
            .insert(notification as never);

        if (error) {
            console.error('Error creating notification:', error);
        }
    };

    const clearAll = async () => {
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
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            markAsRead,
            markAllAsRead,
            clearAll,
            createNotification,
            isLoading
        }}>
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
