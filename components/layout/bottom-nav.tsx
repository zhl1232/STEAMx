"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Leaf, Home, Sparkles, CircleUser } from "lucide-react";

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
            href: "/create",
            label: "创造营",
            icon: Sparkles,
            active:
                pathname === "/create" ||
                pathname.startsWith("/create/") ||
                pathname.startsWith("/pbl/") ||
                pathname.startsWith("/courses/"),
        },
        {
            href: "/nature",
            label: "自然",
            icon: Leaf,
            active: pathname === "/nature" || pathname.startsWith("/nature/"),
        },
        {
            href: "/profile",
            label: "我的",
            icon: CircleUser,
            active: pathname === "/profile" || pathname.startsWith("/profile/"),
            protected: true,
        },
    ];

    return (
        <>
            <div className="bottom-nav-scrim" aria-hidden="true" />
            <div className="bottom-nav-bar">
                {navItems.map((item) => {
                    const activePillClass = "bg-[hsl(var(--nav-active))] text-[hsl(var(--nav-active-foreground))] shadow-[0_12px_22px_-14px_hsl(var(--nav-active)/0.8)]";
                    const inactivePillClass = "text-muted-foreground hover:nature-media-placeholder hover:text-[hsl(var(--nav-active))]";
                    const content = (
                        <div
                            className={cn(
                                "mx-auto flex min-w-11.5 max-w-full flex-col items-center justify-center gap-1 rounded-sm px-2 py-1.5 transition-[color,background-color,transform] duration-150 active:scale-[0.85] motion-reduce:transition-none",
                                item.active ? activePillClass : inactivePillClass,
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-[19px] w-[19px] shrink-0 transition-all duration-300",
                                    item.active ? "stroke-[2.5px]" : "stroke-[2px]",
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
                                className="flex flex-1 items-stretch rounded-md"
                            >
                                {content}
                            </button>
                        )
                    }

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-1 items-stretch rounded-md"
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
        </>
    );
}
