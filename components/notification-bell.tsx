"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useNotifications } from "@/context/notification-context";

/**
 * 右上角通知入口：点击进入统一「消息」页（回复与@、收到喜欢、新增粉丝、私信）
 * 角标为通知未读数
 */
export function NotificationBell() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  if (!user) {
    return null;
  }

  return (
    <Button variant="ghost" size="icon" className="relative h-9 w-9 shrink-0" asChild>
      <Link href="/messages" aria-label="消息">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
