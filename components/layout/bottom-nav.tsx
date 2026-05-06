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
                "fixed bottom-2 left-4 right-4 z-50 flex items-center gap-1 rounded-[28px] border bg-white/[0.94] px-2.5 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_22px_58px_-30px_rgba(27,70,126,0.42)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/[0.88] md:hidden",
                isNatureRoute
                    ? "border-[#d5e8da] dark:border-[#274d37] dark:bg-[#0d1d14]/[0.92] dark:shadow-none dark:supports-[backdrop-filter]:bg-[#0d1d14]/[0.86]"
                    : "border-[#e2ebf5] dark:border-[#2a3a50] dark:bg-[#111a28]/[0.92] dark:shadow-none dark:supports-[backdrop-filter]:bg-[#111a28]/[0.84]",
            )}
        >
            {navItems.map((item) => {
                const isNatureItem = item.href === "/nature";
                const activeTextClass = isNatureItem
                    ? "text-[#16844b] dark:text-[#74d79a]"
                    : "text-[#1478ea] dark:text-[#8bbdff]";
                const inactiveTextClass = isNatureItem
                    ? "text-[#334155] hover:bg-[#eef8ef] hover:text-[#16844b] dark:text-[#c5cfdd] dark:hover:bg-[#172a1e] dark:hover:text-[#74d79a]"
                    : "text-[#334155] hover:bg-[#eef5ff] hover:text-[#1478ea] dark:text-[#c5cfdd] dark:hover:bg-[#172234] dark:hover:text-[#8bbdff]";
                const activeIconClass = isNatureItem
                    ? "bg-[#16844b] text-white shadow-[0_12px_22px_-14px_rgba(22,132,75,0.8)] dark:bg-[#2fb76b] dark:text-[#041208]"
                    : "bg-[#1478ea] text-white shadow-[0_12px_22px_-14px_rgba(20,120,234,0.8)] dark:bg-[#2f8df0]";
                const content = (
                    <div className={cn(
                        "flex w-full flex-col items-center justify-center gap-0.5 rounded-[16px] px-1 py-1.5 transition-all",
                        item.active
                            ? activeTextClass
                            : inactiveTextClass,
                    )}>
                        <span className={cn("grid h-7 w-7 place-items-center rounded-[10px]", item.active && activeIconClass)}>
                            <item.icon className={cn("h-[18px] w-[18px]", item.active && "stroke-[2.6px]")} />
                        </span>
                        <span className="text-[11px] font-semibold leading-none">{item.label}</span>
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
