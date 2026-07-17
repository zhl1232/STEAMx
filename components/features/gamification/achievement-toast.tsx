"use client";

import type { BadgeTier } from "@/lib/gamification/types";
import { PREMIUM_ICONS_MAP } from "./premium-icons";

const TIER_TOAST_STYLES: Record<BadgeTier, string> = {
    bronze: "border-amber-600 bg-linear-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 dark:border-amber-500/50",
    silver: "border-slate-400 bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-700/40 dark:to-slate-800/30 dark:border-slate-500/50",
    gold: "border-yellow-500 bg-linear-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/40 dark:to-yellow-800/30 dark:border-yellow-400/50",
    platinum: "border-cyan-400 bg-linear-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/40 dark:to-cyan-800/30 dark:border-cyan-400/50",
};

interface AchievementToastProps {
    title: string;
    description: string;
    icon: string;
    tier?: BadgeTier;
}

export function AchievementToast({ title, description, icon, tier }: AchievementToastProps) {
    const iconRingClass = tier
        ? TIER_TOAST_STYLES[tier]
        : "border-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 dark:border-yellow-500/50";

    const IconComp = PREMIUM_ICONS_MAP[icon];

    return (
        <div className="flex w-full items-center gap-4">
            <div
                className={`achievement-toast-icon flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl ${iconRingClass}`}
            >
                {IconComp ? <IconComp className="h-6 w-6" /> : icon}
            </div>
            <div className="flex flex-col">
                <h4 className="achievement-toast-copy text-lg font-bold text-foreground">
                    {title}
                </h4>
                <p className="achievement-toast-copy achievement-toast-copy-delayed text-sm text-muted-foreground">
                    {description}
                </p>
            </div>
        </div>
    );
}
