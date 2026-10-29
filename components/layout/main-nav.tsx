"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoreEntryVisible } from "@/lib/context/store-availability-context";
import { cn } from "@/lib/utils";

export function MainNav() {
    const pathname = usePathname();
    const storeEntryVisible = useStoreEntryVisible();
    const routes = [
        {
            href: "/explore",
            label: "探索",
            active: pathname === "/explore" || pathname === "/project" || pathname?.startsWith("/project/"),
        },
        // 主线频道。/create 与 /pbl 书签仍高亮课程，不再从导航或首页推广创造营
        {
            href: "/courses",
            label: "技能课程",
            active:
                pathname === "/courses" ||
                pathname?.startsWith("/courses/") ||
                pathname === "/create" ||
                pathname?.startsWith("/create/") ||
                pathname?.startsWith("/pbl/"),
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
        ...(storeEntryVisible ? [{
            href: "/store",
            label: "材料商城",
            active: pathname === "/store" || pathname?.startsWith("/store/"),
        }] : []),
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
