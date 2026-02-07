"use client";

import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, type Notification } from "@/context/notification-context";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useRouter } from "next/navigation";

export function NotificationBell() {
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
    const router = useRouter();

    // 未登录时不显示通知图标
    if (!user) {
        return null;
    }

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.is_read) {
            await markAsRead(notification.id);
        }

        // Navigate to related content with hash anchor
        if (notification.type === 'creator_update' && notification.project_id) {
            router.push(`/project/${notification.project_id}`);
        } else if (notification.related_type === 'comment' && notification.project_id && notification.related_id) {
            router.push(`/project/${notification.project_id}#comment-${notification.related_id}`);
        } else if (notification.related_type === 'discussion_reply' && notification.discussion_id && notification.related_id) {
            router.push(`/community/discussion/${notification.discussion_id}#reply-${notification.related_id}`);
        }
    };

    const getNotificationIcon = (notification: Notification) => {
        if (notification.from_username) {
            return (
                <Avatar className="h-8 w-8">
                    {notification.from_avatar && <AvatarImage src={notification.from_avatar} />}
                    <AvatarFallback>{notification.from_username[0]}</AvatarFallback>
                </Avatar>
            );
        }
        return <Bell className="h-8 w-8 p-2  bg-primary/10 rounded-full text-primary" />;
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>通知</span>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={markAllAsRead}>
                                全部已读
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-destructive hover:text-destructive"
                                onClick={clearAll}
                            >
                                <Trash2 className="h-3 w-3 mr-1" />
                                清空
                            </Button>
                        )}
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            暂无通知
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <DropdownMenuItem
                                key={notification.id}
                                className={`flex gap-3 p-3 cursor-pointer ${!notification.is_read ? 'bg-accent/50' : ''
                                    }`}
                                onClick={() => handleNotificationClick(notification)}
                            >
                                {getNotificationIcon(notification)}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm leading-snug mb-1">
                                        {notification.content}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDistance(new Date(notification.created_at), new Date(), {
                                            addSuffix: true,
                                            locale: zhCN
                                        })}
                                    </p>
                                </div>
                                {!notification.is_read && (
                                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                                )}
                            </DropdownMenuItem>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
