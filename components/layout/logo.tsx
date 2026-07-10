"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function SteamLogo({ className }: { className?: string }) {
    return (
        <Image
            src="/logo.png"
            alt="STEAM 探索"
            width={64}
            height={64}
            draggable={false}
            className={cn("h-6 w-6 object-contain transition-transform hover:scale-110", className)}
        />
    );
}
