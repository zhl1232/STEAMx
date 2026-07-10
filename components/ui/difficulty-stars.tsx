"use client"

import { cn } from "@/lib/utils"

interface DifficultyStarsProps {
    stars: number // 1-6 星
    size?: "xs" | "sm" | "md" | "lg"
    showLabel?: boolean
    tone?: "default" | "white"
    className?: string
}

const DIFFICULTY_LABELS: Record<number, string> = {
    1: "入门",
    2: "简单",
    3: "中等",
    4: "进阶",
    5: "挑战",
    6: "传说",
}

const SIZE_CLASSES = {
    xs: "text-[10px] gap-px",
    sm: "text-xs gap-0.5",
    md: "text-sm gap-1",
    lg: "text-base gap-1",
}

export function DifficultyStars({
    stars,
    size = "sm",
    showLabel = false,
    tone = "default",
    className
}: DifficultyStarsProps) {
    // 确保星级在 1-6 范围内
    const validStars = Math.max(1, Math.min(6, stars))
    const isLegendary = validStars === 6
    const filledClass = tone === "white" ? "text-yellow-400" : "text-yellow-500"
    const emptyClass = tone === "white" ? "text-white/40" : "text-gray-300 dark:text-gray-600"

    if (isLegendary) {
        // 6 星传说级 - 特殊样式
        return (
            <div className={cn("inline-flex items-center", SIZE_CLASSES[size], className)}>
                <span className={cn("animate-pulse", tone === "white" ? "text-white" : "text-purple-500")} title="传说级">💫</span>
                {showLabel && (
                    <span className={cn("ml-1 font-medium", tone === "white" ? "text-white" : "text-purple-500")}>
                        {DIFFICULTY_LABELS[6]}
                    </span>
                )}
            </div>
        )
    }

    // 1-5 星普通显示
    return (
        <div className={cn("inline-flex items-center", SIZE_CLASSES[size], className)}>
            {Array.from({ length: 5 }).map((_, index) => (
                <span
                    key={index}
                    className={cn(
                        "transition-colors",
                        index < validStars ? filledClass : emptyClass
                    )}
                >
                    ★
                </span>
            ))}
            {showLabel && (
                <span className={cn("ml-1", tone === "white" ? "text-white/90" : "text-muted-foreground")}>
                    {DIFFICULTY_LABELS[validStars]}
                </span>
            )}
        </div>
    )
}

// 紧凑版本 - 只显示数字和图标
export function DifficultyBadge({ stars, className }: { stars: number; className?: string }) {
    const validStars = Math.max(1, Math.min(6, stars))
    const isLegendary = validStars === 6

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                isLegendary
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                className
            )}
        >
            {isLegendary ? "💫" : "⭐"}
            {isLegendary ? "传说" : `${validStars}星`}
        </span>
    )
}
