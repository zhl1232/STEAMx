"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Feather, Home, MessageSquare, User } from "lucide-react";

import { LoginDialog } from "@/components/layout/login-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from '@/lib/context/auth-context';

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);
    const isNatureRoute = pathname === "/nature" || pathname.startsWith("/nature/");

    const navItems = [
        {
            href: "/",
            label: "首页",
            icon: Home,
            active: pathname === "/",
        },
        {
            href: "/explore",
            label: "探索",
            icon: Compass,
            active: pathname === "/explore" || pathname === "/project" || pathname.startsWith("/project/"),
        },
        {
            href: "/nature",
            label: "自然",
            icon: Feather,
            active: pathname === "/nature" || pathname.startsWith("/nature/"),
            nature: true,
        },
        {
            href: "/community",
            label: "社区",
            icon: MessageSquare,
            active: pathname === "/community" || pathname.startsWith("/community/"),
        },
        {
            href: "/profile",
            label: "我的",
            icon: User,
            active: pathname === "/profile" || pathname.startsWith("/profile/"),
            protected: true,
        },
    ];

    return (
        <div
            className={cn(
                "bottom-nav-bar",
                isNatureRoute && "bottom-nav-bar-nature",
            )}
        >
            {navItems.map((item) => {
                const isNatureItem = Boolean(item.nature);
                const activePillClass = isNatureItem
                    ? "bg-[hsl(var(--nature-accent))] text-[hsl(var(--nature-accent-foreground))] shadow-[0_12px_22px_-14px_hsl(var(--nature-accent)/0.8)]"
                    : "bg-[hsl(var(--nav-active))] text-[hsl(var(--nav-active-foreground))] shadow-[0_12px_22px_-14px_hsl(var(--nav-active)/0.8)]";
                const inactivePillClass = isNatureItem
                    ? "text-muted-foreground hover:bg-[hsl(var(--nature-accent-soft))] hover:text-[hsl(var(--nature-accent))]"
                    : "text-muted-foreground hover:bg-[hsl(var(--status-info-surface))] hover:text-[hsl(var(--nav-active))]";
                const content = (
                    <div
                        className={cn(
                            "mx-auto flex min-w-[2.875rem] max-w-full flex-col items-center justify-center gap-1 rounded-xl px-2 py-1.5 transition-all",
                            item.active ? activePillClass : inactivePillClass,
                        )}
                    >
                        <item.icon
                            className={cn(
                                "h-[17px] w-[17px] shrink-0",
                                item.active && "stroke-[2.5px]",
                            )}
                        />
                        <span className="text-[10.5px] font-semibold leading-none">{item.label}</span>
                    </div>
                )

                if (item.protected && !user) {
                    return (
                        <button
                            key={item.href}
                            type="button"
                            onClick={() => {
                                setPendingHref(item.href);
                                setLoginOpen(true);
                            }}
                            className="flex flex-1 items-stretch rounded-2xl"
                        >
                            {content}
                        </button>
                    )
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex flex-1 items-stretch rounded-2xl"
                    >
                        {content}
                    </Link>
                )
            })}
            <LoginDialog
                open={loginOpen}
                onOpenChange={(open) => {
                    setLoginOpen(open);
                    if (!open) {
                        setPendingHref(null);
                    }
                }}
                onSuccess={() => {
                    const nextHref = pendingHref;
                    setPendingHref(null);
                    if (nextHref) {
                        router.push(nextHref);
                    }
                }}
                title="登录后继续"
            />
        </div>
    );
}
