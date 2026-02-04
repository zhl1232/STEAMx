"use client";

import React from "react";
import Link from "next/link";
import { FlaskConical, Cpu, Rocket, Palette, Calculator, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    {
        href: "/explore?category=科学",
        icon: FlaskConical,
        label: "科学",
        color: "text-blue-500",
        bg: "bg-blue-50"
    },
    {
        href: "/explore?category=技术",
        icon: Cpu,
        label: "技术",
        color: "text-indigo-500",
        bg: "bg-indigo-50"
    },
    {
        href: "/explore?category=工程",
        icon: Rocket,
        label: "工程",
        color: "text-orange-500",
        bg: "bg-orange-50"
    },
    {
        href: "/explore?category=艺术",
        icon: Palette,
        label: "艺术",
        color: "text-pink-500",
        bg: "bg-pink-50"
    },
    {
        href: "/explore?category=数学",
        icon: Calculator,
        label: "数学",
        color: "text-green-500",
        bg: "bg-green-50"
    },
    {
        href: "/explore",
        icon: Sparkles,
        label: "全部",
        color: "text-purple-500",
        bg: "bg-purple-50"
    }
];

export function MobileCategoryGrid() {
    return (
        <div className="grid grid-cols-3 gap-y-6 gap-x-4 py-6 px-4">
            {CATEGORIES.map((item) => (
                <Link 
                    key={item.label} 
                    href={item.href}
                    className="flex flex-col items-center gap-2 group"
                >
                    <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border border-transparent transition-all group-active:scale-95",
                        "bg-background border-border/50", 
                        // Using a subtle approach instead of full color bg
                        "dark:bg-muted/30"
                    )}>
                        <item.icon className={cn("h-7 w-7", item.color)} />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                        {item.label}
                    </span>
                </Link>
            ))}
        </div>
    );
}
