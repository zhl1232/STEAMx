"use client";

import { CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Badge, BadgeTier, UserStats } from "@/lib/gamification/types";
import {
    getNextSeriesThreshold,
    getSeriesLabel,
    getSeriesProgressValue,
    getVisibleSeriesBadges,
    isSeriesAtVisibleMax,
} from "@/lib/gamification/badges";
import { buildInsectObservationProgress } from "@/lib/gamification/species-difficulty";
import { BadgeIcon } from "./badge-icon";
import { BadgeTierPill } from "./badge-tier-pill";

const SERIES_COPY: Partial<Record<string, string>> = {
    intro_likes: "从第一次点赞开始积累平台互动热度。",
    intro_publish: "把灵感真正发布出来，形成持续输出。",
    intro_collections: "把值得回看的项目收进自己的灵感库。",
    science_expert: "科学类项目和审核通过的观察都算进这一条。",
    tech_expert: "技术类项目和 Scratch 课时都算进这一条。",
    engineering_expert: "工程类项目和大颗粒积木课都算进这一条。",
    art_expert: "艺术类项目和审核通过的课时作品都算进这一条。",
    math_expert: "数学类项目和五子棋课时都算进这一条。",
    social: "留言和回复形成的社区参与度。",
    popularity: "作品或发言被更多人看见和认可。",
    milestone: "完成的项目和课时加在一起的长期里程碑。",
    level: "等级增长对应的整体成长轨迹。",
    challenge: "参与挑战，进入更明确的目标场景。",
    streak: "连续登录和持续返回形成的习惯强度。",
    bird_observer: "审核通过的观察记录条数，同一种拍多次也算。",
    species_collector: "图鉴点亮的物种种数，鸟虫植物加在一起，同一种只算一次。",
    bird_common: "点亮常见堆里的鸟，一种只算一次。",
    bird_uncommon: "点亮进阶堆里的鸟，一种只算一次。",
    bird_rare: "点亮稀有堆里的鸟，一种只算一次。",
    insect_rank: "按《北京自然观察手册：昆虫》的九宫格升级，完成任意一套即升到这一级。",
    playground_explorer: "玩过的不同游乐场游戏数量。",
    playground_victories: "游乐场累计胜利和通关次数。",
    first_steps: "适合新用户的起步徽章，很快就能点亮第一组。",
    playground_star: "游乐场高难度彩蛋，达成特定纪录才点亮。",
    rare: "限定、纪念或人工授予的特别徽章。",
};

const BIRD_SERIES = new Set(["bird_common", "bird_uncommon", "bird_rare"]);

function formatUnlockedDate(iso?: string) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("zh-CN");
}

function getProgressUnit(seriesKey: string) {
    if (BIRD_SERIES.has(seriesKey) || seriesKey === "species_collector") return "种";
    if (seriesKey === "bird_observer") return "条";
    if (seriesKey === "insect_rank") return "级";
    return "";
}

export function BadgeDetailDialog({
    open,
    onOpenChange,
    seriesKey,
    seriesBadges,
    displayBadge,
    unlockedIds,
    userBadgeDetails,
    userStats,
    seriesCopy,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    seriesKey: string;
    seriesBadges: Badge[];
    displayBadge: Badge;
    unlockedIds: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    userStats?: UserStats | null;
    seriesCopy?: Partial<Record<string, string>>;
}) {
    const visibleBadges = getVisibleSeriesBadges(seriesBadges, unlockedIds);
    const isUnlocked = unlockedIds.has(displayBadge.id);
    const unlockedDate = formatUnlockedDate(userBadgeDetails?.get(displayBadge.id)?.unlockedAt);
    const copy = (seriesCopy ?? SERIES_COPY)[seriesKey] ?? "这一组徽章记录了同一方向上的进展。";
    const current = getSeriesProgressValue(seriesKey, userStats);
    const next = current === null ? null : getNextSeriesThreshold(seriesKey, current, unlockedIds);
    const atMax = current !== null && isSeriesAtVisibleMax(seriesKey, current, unlockedIds);
    const unit = getProgressUnit(seriesKey);
    const insectProgress = userStats?.observedInsectSlugs
        ? buildInsectObservationProgress(userStats.observedInsectSlugs)
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[86vh] w-[95vw] max-w-3xl flex-col gap-0 overflow-hidden rounded-sm p-0 sm:rounded-md">
                <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-5">
                    <DialogTitle className="text-base sm:text-lg">{getSeriesLabel(seriesKey)}</DialogTitle>
                </DialogHeader>
                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:p-5">
                    <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                        <BadgeIcon
                            icon={displayBadge.icon}
                            tier={displayBadge.tier}
                            seriesKey={displayBadge.seriesKey}
                            size="xl"
                            locked={!isUnlocked}
                            className="h-24 w-24 sm:h-28 sm:w-28"
                        />
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                            <div className="text-base font-semibold">{displayBadge.name}</div>
                            {displayBadge.tier ? <BadgeTierPill tier={displayBadge.tier} /> : null}
                        </div>
                        {isUnlocked && unlockedDate ? (
                            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{unlockedDate} 获得</div>
                        ) : (
                            <div className="mt-1 text-xs text-muted-foreground">尚未解锁</div>
                        )}
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">{copy}</p>
                        {current !== null ? (
                            <div className="mt-3 text-sm font-medium">
                                {next !== null
                                    ? `${current}/${next}${unit ? ` ${unit}` : ""}`
                                    : atMax
                                        ? "已升到最高品质"
                                        : `${current}${unit ? ` ${unit}` : ""}`}
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-4">
                        {visibleBadges.some((badge) => badge.tier) ? (
                            <ol className="space-y-2">
                                {visibleBadges.map((badge) => {
                                    const done = unlockedIds.has(badge.id);
                                    return (
                                        <li
                                            key={badge.id}
                                            className={cn(
                                                "flex items-start gap-2 rounded-md border px-3 py-2",
                                                done
                                                    ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                                                    : "border-border/70 bg-background/70",
                                            )}
                                        >
                                            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", done ? "text-emerald-600" : "text-muted-foreground/40")} />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className="text-sm font-medium">{badge.name}</span>
                                                    {badge.tier ? <BadgeTierPill tier={badge.tier as BadgeTier} /> : null}
                                                </div>
                                                <div className="mt-0.5 text-xs text-muted-foreground">{badge.description}</div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        ) : (
                            <p className="text-sm text-muted-foreground">{displayBadge.description}</p>
                        )}

                        {BIRD_SERIES.has(seriesKey) && current !== null && next !== null ? (
                            <div className="text-xs text-muted-foreground">当前进度 {current}/{next} 种</div>
                        ) : null}

                        {seriesKey === "insect_rank" && insectProgress ? (
                            <InsectDetailProgress
                                progress={insectProgress}
                                diamondUnlocked={unlockedIds.has("insect_rank_diamond")}
                            />
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InsectDetailProgress({
    progress,
    diamondUnlocked,
}: {
    progress: ReturnType<typeof buildInsectObservationProgress>;
    diamondUnlocked: boolean;
}) {
    const nextRank = (["D", "C", "B", "A"] as const).find((rank) => !progress.completedRanks.includes(rank));
    const grids = nextRank
        ? progress.grids.filter((grid) => grid.rank === nextRank)
        : progress.grids.filter((grid) => grid.rank === "A");
    const completedChallenges = progress.challenges.filter((challenge) => challenge.complete && !challenge.mythic);
    const showMythic = progress.mythicRevealed;

    return (
        <div className="space-y-3">
            {nextRank ? (
                <div className="text-xs text-muted-foreground">
                    再集齐一套{grids.map((grid) => grid.title).join("或")}，升到{
                        { D: "铜档", C: "银档", B: "金档", A: "白金档" }[nextRank]
                    }
                </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
                {grids.map((grid) => (
                    <div key={grid.id} className="rounded-md border border-border/70 p-2">
                        <div className="mb-2 text-xs font-medium">
                            {grid.title} · {grid.found}/{grid.total}
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                            {grid.cells.map((cell) => (
                                <div
                                    key={cell.slug}
                                    className={cn(
                                        "rounded px-1 py-1 text-center text-[10px] leading-4",
                                        cell.found
                                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200"
                                            : "bg-muted/60 text-muted-foreground",
                                    )}
                                >
                                    {cell.name}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            {diamondUnlocked && completedChallenges.length > 0 ? (
                <div className="space-y-2">
                    {completedChallenges.map((challenge) => (
                        <div key={challenge.id} className="text-xs text-emerald-700 dark:text-emerald-300">
                            已完成 S 级 · {challenge.title}（{challenge.found}/{challenge.total}）
                        </div>
                    ))}
                </div>
            ) : null}
            {showMythic ? (
                <div className="rounded-md border border-violet-200/80 p-2 dark:border-violet-500/25">
                    <div className="mb-2 text-xs font-medium">北京神物 · {progress.mythicObservedCount}/7</div>
                    <div className="grid grid-cols-2 gap-1">
                        {progress.challenges.find((item) => item.id === "mythic")?.cells.map((cell) => (
                            <div
                                key={cell.slug}
                                className={cn(
                                    "rounded px-1 py-1 text-[10px]",
                                    cell.found ? "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200" : "bg-muted/60 text-muted-foreground",
                                )}
                            >
                                {cell.name}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export { SERIES_COPY };
