"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Header/footer mark: teal circle with white star+leaves.
 * Avoid logo-mark-white (white filled disc with cutouts) — it reads as a white square on dark UI.
 */
export function SteamLogo({ className }: { className?: string }) {
    return (
        <Image
            src="/logo-mark.png"
            alt={BRAND_NAME}
            width={64}
            height={64}
            draggable={false}
            className={cn("h-6 w-6 object-contain transition-transform hover:scale-110", className)}
        />
    );
}
