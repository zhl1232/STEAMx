"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";

export function MainNav() {
    const pathname = usePathname();
    const { user } = useAuth();
    const isProtectedRoute = (href: string) =>
        href.startsWith("/messages") || href === "/shop";

    const routes = [
        {
            href: "/explore",
            label: "探索",
            active: pathname === "/explore" || pathname === "/project" || pathname?.startsWith("/project/"),
        },
        {
            href: "/playground",
            label: "游乐场",
            active: pathname === "/playground" || pathname?.startsWith("/playground/"),
        },
        {
            href: "/community",
            label: "社区",
            active: pathname === "/community" || pathname?.startsWith("/community/"),
        },
        {
            href: "/messages?tab=dm",
            label: "私信",
            active: pathname === "/messages" || pathname?.startsWith("/messages/"),
        },
        {
            href: "/leaderboard",
            label: "排行榜",
            active: pathname === "/leaderboard" || pathname?.startsWith("/leaderboard/"),
        },
        {
            href: "/shop",
            label: "商店",
            active: pathname === "/shop" || pathname?.startsWith("/shop/"),
        },
    ].filter(route => {
        if (!user && isProtectedRoute(route.href)) {
            return false;
        }
        return true;
    });

    return (
        <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1 rounded-full border border-border/70 bg-background/72 p-1 text-sm font-medium shadow-sm backdrop-blur-sm">
                {routes.map((route) => (
                    <Link
                        key={route.href}
                        href={route.href}
                        className={cn(
                            "rounded-full px-3 py-2 transition-colors",
                            route.active
                                ? "bg-foreground text-background shadow-sm"
                                : "text-foreground/68 hover:bg-muted hover:text-foreground"
                        )}
                    >
                        {route.label}
                    </Link>
                ))}
            </nav>
            <div className="rounded-full border border-border/70 bg-background/72 p-1 shadow-sm backdrop-blur-sm">
                <ThemeToggle />
            </div>
        </div>
    );
}
