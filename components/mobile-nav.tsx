"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Rocket } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";

export function MobileNav() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const { user } = useAuth();

    const routes = [
        {
            href: "/", // Added Home for mobile convenience
            label: "首页",
            active: pathname === "/",
        },
        {
            href: "/explore",
            label: "探索",
            active: pathname === "/explore",
        },
        {
            href: "/community",
            label: "社区",
            active: pathname === "/community",
        },
        {
            href: "/leaderboard",
            label: "排行榜",
            active: pathname === "/leaderboard",
        },
        {
            href: "/share",
            label: "分享",
            active: pathname === "/share",
        },
        {
            href: "/profile",
            label: "个人中心",
            active: pathname === "/profile",
        },
    ].filter(route => {
        if (!user && (route.href === '/leaderboard' || route.href === '/share' || route.href === '/profile')) {
            return false;
        }
        return true;
    });

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-2">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
                <SheetHeader className="px-1 text-left">
                    <SheetTitle asChild>
                        <Link href="/" className="flex items-center space-x-2" onClick={() => setOpen(false)}>
                            <Rocket className="h-6 w-6 text-primary" />
                            <span className="font-bold text-lg">STEAM 探索</span>
                        </Link>
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 py-8 items-start">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                                "text-base font-medium transition-colors hover:text-primary w-full px-2 py-1.5 rounded-md",
                                route.active
                                    ? "text-primary bg-accent/20"
                                    : "text-muted-foreground"
                            )}
                        >
                            {route.label}
                        </Link>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    );
}
