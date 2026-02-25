"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";

export function MainNav() {
    const pathname = usePathname();
    const { user } = useAuth();

    const routes = [
        {
            href: "/explore",
            label: "探索",
            active: pathname === "/explore",
        },
        {
            href: "/playground",
            label: "游乐场",
            active: pathname === "/playground" || pathname?.startsWith("/playground/"),
        },
        {
            href: "/community",
            label: "社区",
            active: pathname === "/community",
        },
        {
            href: "/messages?tab=dm",
            label: "私信",
            active: pathname === "/messages" || pathname?.startsWith("/messages/"),
        },
        {
            href: "/leaderboard",
            label: "排行榜",
            active: pathname === "/leaderboard",
        },
        {
            href: "/shop",
            label: "商店",
            active: pathname === "/shop",
        },
    ].filter(route => {
        if (!user && (route.href === '/leaderboard' || route.href === '/messages' || route.href === '/shop')) {
            return false;
        }
        return true;
    });

    return (
        <nav className="flex items-center gap-6 text-sm font-medium">
            {routes.map((route) => (
                <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                        "transition-colors hover:text-primary px-3 py-2 rounded-md",
                        route.active
                            ? "text-foreground font-semibold bg-accent/50"
                            : "text-foreground/60 hover:bg-accent/50"
                    )}
                >
                    {route.label}
                </Link>
            ))}
            <ThemeToggle />
        </nav>
    );
}