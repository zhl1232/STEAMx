"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function MainNav() {
    const pathname = usePathname();
    const routes = [
        {
            href: "/explore",
            label: "探索",
            active: pathname === "/explore" || pathname === "/project" || pathname?.startsWith("/project/"),
        },
        {
            href: "/community",
            label: "社区",
            active: pathname === "/community" || pathname?.startsWith("/community/"),
        },
        {
            href: "/leaderboard",
            label: "排行榜",
            active: pathname === "/leaderboard" || pathname?.startsWith("/leaderboard/"),
        },
        {
            href: "/nature",
            label: "自然观察",
            active: pathname === "/nature" || pathname?.startsWith("/nature/"),
        },
        {
            href: "/playground",
            label: "游乐场",
            active: pathname === "/playground" || pathname?.startsWith("/playground/"),
        },
    ];

    return (
        <nav className="flex items-center gap-4 text-[14px] font-semibold xl:gap-7 xl:text-[15px] 2xl:gap-9">
            {routes.map((route) => (
                <Link
                    key={route.href}
                    href={route.href}
                    className={cn("nav-link", route.active && "nav-link-active")}
                >
                    {route.label}
                </Link>
            ))}
        </nav>
    );
}
