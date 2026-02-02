"use client";

import { useGamification } from "@/context/gamification-context";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface LevelProgressProps {
    className?: string;
    showLabel?: boolean;
}

export function LevelProgress({ className, showLabel = true }: LevelProgressProps) {
    const { level, progress, xp, levelProgress, levelTotalNeeded } = useGamification();

    return (
        <div className={cn("flex flex-col gap-2 w-full max-w-xs", className)}>
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
            <Progress value={progress} className="h-2" />
        </div>
    );
}
