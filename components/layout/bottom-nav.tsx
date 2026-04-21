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
            label: "观察",
            icon: Feather,
            active: pathname === "/nature" || pathname.startsWith("/nature/"),
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
        <div className="fixed bottom-2 left-3 right-3 z-50 flex items-center gap-1 rounded-[22px] border border-border/70 bg-background/92 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.38)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/82 md:hidden">
            {navItems.map((item) => {
                const content = (
                    <div className={cn(
                        "flex w-full flex-col items-center justify-center gap-1 rounded-[18px] px-1 py-2 transition-all",
                        item.active
                            ? "bg-foreground text-background shadow-[0_16px_34px_-24px_rgba(15,23,42,0.52)]"
                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
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
