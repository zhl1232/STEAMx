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
        <nav className="flex items-center gap-4 text-[14px] font-semibold text-[#1f2937] dark:text-[#d9e4f2] xl:gap-7 xl:text-[15px] 2xl:gap-9">
            {routes.map((route) => (
                <Link
                    key={route.href}
                    href={route.href}
                    className={cn(
                        "relative flex h-16 shrink-0 items-center whitespace-nowrap px-1 transition-colors hover:text-[#1478ea] dark:hover:text-[#8bbdff]",
                        route.active
                            ? "text-[#1478ea] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[#1478ea] dark:text-[#8bbdff] dark:after:bg-[#8bbdff]"
                            : "text-[#1f2937] dark:text-[#d9e4f2]"
                    )}
                >
                    {route.label}
                </Link>
            ))}
        </nav>
    );
}
