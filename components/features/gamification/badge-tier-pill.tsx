import { BADGE_TIER_LABELS } from "@/lib/gamification/badges";
import type { BadgeTier } from "@/lib/gamification/types";
import { cn } from "@/lib/utils";

const TIER_PILL_CLASS: Record<BadgeTier, string> = {
    bronze: "border-amber-200/80 bg-amber-50/95 text-amber-800 dark:border-amber-400/35 dark:bg-amber-950/90 dark:text-amber-100",
    silver: "border-slate-200/80 bg-slate-50/95 text-slate-700 dark:border-slate-400/35 dark:bg-slate-900/90 dark:text-slate-100",
    gold: "border-yellow-200/80 bg-yellow-50/95 text-yellow-800 dark:border-yellow-400/35 dark:bg-yellow-950/90 dark:text-yellow-100",
    platinum: "border-cyan-200/80 bg-cyan-50/95 text-cyan-800 dark:border-cyan-400/35 dark:bg-cyan-950/90 dark:text-cyan-100",
    diamond: "border-violet-200/80 bg-violet-50/95 text-violet-800 dark:border-violet-400/35 dark:bg-violet-950/90 dark:text-violet-100",
};

export function BadgeTierPill({
    tier,
    className,
}: {
    tier: BadgeTier;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-semibold leading-none tracking-wide",
                TIER_PILL_CLASS[tier],
                className,
            )}
        >
            {BADGE_TIER_LABELS[tier]}
        </span>
    );
}
