"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_FULL_NAME } from "@/lib/brand";

export function SteamLogo({ className }: { className?: string }) {
    return (
        <span className={cn("relative inline-flex h-6 w-6 shrink-0", className)}>
            <Image
                src="/logo-mark-teal.png"
                alt={BRAND_FULL_NAME}
                width={64}
                height={64}
                draggable={false}
                className="h-full w-full object-contain transition-transform hover:scale-110 dark:hidden"
            />
            <Image
                src="/logo-mark-white.png"
                alt={BRAND_FULL_NAME}
                width={64}
                height={64}
                draggable={false}
                className="hidden h-full w-full object-contain transition-transform hover:scale-110 dark:block"
            />
        </span>
    );
}
