"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Compass, PlusCircle, MessageSquare, User } from "lucide-react";

import { LoginDialog } from "@/components/layout/login-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from '@/lib/context/auth-context';

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const [loginOpen, setLoginOpen] = useState(false);
    const [pendingHref, setPendingHref] = useState<string | null>(null);

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
            href: "/share",
            label: "发布",
            icon: PlusCircle,
            active: pathname === "/share" || pathname.startsWith("/share/"),
            primary: true,
            protected: true,
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
        <div className="fixed bottom-2 left-3 right-3 z-50 flex items-center justify-around rounded-[22px] border border-border/70 bg-background/92 px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.38)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/82 md:hidden">
            {navItems.map((item) => {
                const content = item.primary ? (
                    <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-background bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95",
                        item.active && "ring-2 ring-foreground/15"
                    )}>
                        <item.icon className="h-6 w-6" />
                    </div>
                ) : (
                    <div className={cn(
                        "flex flex-col items-center gap-0.5 px-2 py-1 transition-colors",
                        item.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}>
                        <item.icon className={cn("h-5 w-5", item.active && "stroke-[2.5px]")} />
                        <span className="text-[10px] font-medium leading-none">{item.label}</span>
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
                            className="relative flex min-w-[56px] flex-col items-center justify-center rounded-2xl px-1.5 py-0.5"
                        >
                            {content}
                        </button>
                    )
                }

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="relative flex min-w-[56px] flex-col items-center justify-center rounded-2xl px-1.5 py-0.5"
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
