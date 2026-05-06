"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function SteamLogo({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            className={cn("w-6 h-6 transition-transform hover:scale-110", className)}
            fill="none"
        >
            {/* Hexagon Outline (Engineering & Tech) */}
            <path
                d="M50 10 L84.64 30 L84.64 70 L50 90 L15.36 70 L15.36 30 Z"
                stroke="#1fb874"
                strokeWidth="6"
                strokeLinejoin="round"
                fill="transparent"
            />

            {/* Inner Atom/Orbit (Science & Math) */}
            <ellipse
                cx="50"
                cy="50"
                rx="25"
                ry="8"
                stroke="#1fb7d8"
                strokeWidth="6"
                transform="rotate(60 50 50)"
            />
            <ellipse
                cx="50"
                cy="50"
                rx="25"
                ry="8"
                stroke="#1fb7d8"
                strokeWidth="6"
                transform="rotate(120 50 50)"
            />
            <ellipse
                cx="50"
                cy="50"
                rx="25"
                ry="8"
                stroke="#0f7ee8"
                strokeWidth="6"
                transform="rotate(180 50 50)"
            />

            {/* Center dot (Art / Core) */}
            <circle cx="50" cy="50" r="8" fill="#0f7ee8" />
        </svg>
    );
}
