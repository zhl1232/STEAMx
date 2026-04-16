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
            <defs>
                <linearGradient id="steamPrimaryGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" /> {/* Indigo 500 */}
                    <stop offset="100%" stopColor="#a855f7" /> {/* Purple 500 */}
                </linearGradient>
                <linearGradient id="steamSecondaryGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" /> {/* Blue 500 */}
                    <stop offset="100%" stopColor="#ec4899" /> {/* Pink 500 */}
                </linearGradient>
            </defs>

            {/* Hexagon Outline (Engineering & Tech) */}
            <path
                d="M50 10 L84.64 30 L84.64 70 L50 90 L15.36 70 L15.36 30 Z"
                stroke="url(#steamPrimaryGrad)"
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
                stroke="url(#steamSecondaryGrad)"
                strokeWidth="6"
                transform="rotate(60 50 50)"
            />
            <ellipse
                cx="50"
                cy="50"
                rx="25"
                ry="8"
                stroke="url(#steamSecondaryGrad)"
                strokeWidth="6"
                transform="rotate(120 50 50)"
            />
            <ellipse
                cx="50"
                cy="50"
                rx="25"
                ry="8"
                stroke="url(#steamPrimaryGrad)"
                strokeWidth="6"
                transform="rotate(180 50 50)"
            />

            {/* Center dot (Art / Core) */}
            <circle cx="50" cy="50" r="8" fill="url(#steamPrimaryGrad)" />
        </svg>
    );
}
