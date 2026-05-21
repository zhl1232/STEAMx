"use client";

import { useGamification } from '@/lib/context/gamification-context';
import { cn } from "@/lib/utils";

interface LevelProgressProps {
    className?: string;
    showLabel?: boolean;
}

export function LevelProgress({ className, showLabel = true }: LevelProgressProps) {
    const { level, progress, levelProgress, levelTotalNeeded } = useGamification();
    const progressValue = Math.max(0, Math.min(100, progress || 0));

    return (
        <div className={cn("flex flex-col gap-2 w-full", className)}>
            {showLabel && (
                <div className="flex justify-between items-end">
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">Lv.{level}</span>
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            ({levelProgress}/{levelTotalNeeded})
                        </span>
                    </div>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="font-medium text-primary">{Math.floor(progress)}%</span>
                        <span className="text-[10px] text-muted-foreground/80 sm:hidden">
                            ({levelProgress}/{levelTotalNeeded})
                        </span>
                    </span>
                </div>
            )}
            <div
                className="profile-xp-track h-2.5"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(progressValue)}
            >
                <div
                    className="profile-xp-progress h-full"
                    style={{ width: `${progressValue}%` }}
                />
            </div>
        </div>
    );
}
