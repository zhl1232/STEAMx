"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Compass, PlusCircle, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useLoginPrompt } from "@/context/login-prompt-context";

export function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const { promptLogin } = useLoginPrompt();

    const handleProtectedClick = (e: React.MouseEvent, href: string) => {
        if (!user) {
            e.preventDefault();
            promptLogin(() => {
                router.push(href);
            }, {
                title: "需要登录",
                description: "登录后即可继续操作"
            });
        }
    };

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
            active: pathname === "/explore" || pathname.startsWith("/project/"),
        },
        {
            href: "/share",
            label: "发布",
            icon: PlusCircle,
            active: pathname === "/share",
            primary: true,
            protected: true,
        },
        {
            href: "/community",
            label: "社区",
            icon: MessageSquare,
            active: pathname === "/community" || pathname.startsWith("/discussion"),
        },
        {
            href: "/profile",
            label: "我的",
            icon: User,
            active: pathname === "/profile",
            protected: true,
        },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur px-2 pb-[env(safe-area-inset-bottom)] supports-[backdrop-filter]:bg-background/80 md:hidden shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            {navItems.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => item.protected && handleProtectedClick(e, item.href)}
                    className={cn(
                        "relative flex flex-col items-center justify-center gap-1 min-w-[64px] rounded-lg p-1",
                    )}
                >
                    {item.primary ? (
                        <div className={cn(
                            "absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 border-4 border-background",
                             item.active && "ring-2 ring-primary"
                        )}>
                            <item.icon className="h-7 w-7" />
                        </div>
                    ) : (
                        <div className={cn(
                            "flex flex-col items-center gap-1 transition-colors",
                            item.active ? "text-primary" : "text-muted-foreground hover:text-primary"
                        )}>
                            <item.icon className={cn("h-6 w-6", item.active && "stroke-[2.5px]")} />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </div>
                    )}
                </Link>
            ))}
        </div>
    );
}
