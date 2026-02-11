"use client";

import { motion } from "framer-motion";
import type { BadgeTier } from "@/lib/gamification/types";

const TIER_TOAST_STYLES: Record<BadgeTier, string> = {
    bronze: "border-amber-600 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/40 dark:to-amber-800/30 dark:border-amber-500/50",
    silver: "border-slate-400 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700/40 dark:to-slate-800/30 dark:border-slate-500/50",
    gold: "border-yellow-500 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/40 dark:to-yellow-800/30 dark:border-yellow-400/50",
    platinum: "border-cyan-400 bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/40 dark:to-cyan-800/30 dark:border-cyan-400/50",
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

    return (
        <div className="flex w-full items-center gap-4">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl ${iconRingClass}`}
            >
                {icon}
            </motion.div>
            <div className="flex flex-col">
                <motion.h4
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-lg font-bold text-foreground"
                >
                    {title}
                </motion.h4>
                <motion.p
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm text-muted-foreground"
                >
                    {description}
                </motion.p>
            </div>
        </div>
    );
}
