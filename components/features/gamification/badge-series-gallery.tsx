"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Badge, UserStats } from "@/lib/gamification/types";
import {
    SERIES_ORDER,
    getNextSeriesThreshold,
    getSeriesDisplayBadge,
    getSeriesProgressValue,
    getVisibleSeriesBadges,
    isLadderSeries,
} from "@/lib/gamification/badges";
import { BadgeIcon } from "./badge-icon";
import { BadgeDetailDialog, SERIES_COPY } from "./badge-detail-dialog";

type GalleryMode = "all" | "unlocked" | "locked";

function groupBadgesBySeries(badges: Badge[]) {
    const map = new Map<string, Badge[]>();
    for (const badge of badges) {
        const key = badge.seriesKey ?? "other";
        const list = map.get(key) ?? [];
        list.push(badge);
        map.set(key, list);
    }
    return map;
}

function seriesIsLit(seriesBadges: Badge[], unlockedIds: Set<string>) {
    return getVisibleSeriesBadges(seriesBadges, unlockedIds).some((badge) => unlockedIds.has(badge.id));
}

function getCardProgress(seriesKey: string, unlockedIds: Set<string>, userStats?: UserStats | null) {
    const current = getSeriesProgressValue(seriesKey, userStats);
    if (current === null) return null;
    const next = getNextSeriesThreshold(seriesKey, current, unlockedIds);
    if (next === null) return `${current}`;
    return `${current}/${next}`;
}

export function BadgeSeriesGallery({
    badges,
    unlockedBadges,
    userBadgeDetails,
    userStats,
    showTabs = true,
    onlyUnlocked = false,
    className,
}: {
    badges: Badge[];
    unlockedBadges: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    userStats?: UserStats | null;
    showTabs?: boolean;
    onlyUnlocked?: boolean;
    className?: string;
}) {
    const grouped = useMemo(() => groupBadgesBySeries(badges), [badges]);
    const [detailKey, setDetailKey] = useState<string | null>(null);

    const seriesStates = SERIES_ORDER.map(({ key, label }) => {
        const fullSeries = grouped.get(key) ?? [];
        if (fullSeries.length === 0) return null;
        const lit = seriesIsLit(fullSeries, unlockedBadges);
        return { key, label, fullSeries, lit };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    const litCount = seriesStates.filter((item) => item.lit).length;
    const totalCount = seriesStates.length;
    const detailSeries = detailKey ? seriesStates.find((item) => item.key === detailKey) : null;
    const detailDisplay = detailSeries
        ? isLadderSeries(detailSeries.key)
            ? getSeriesDisplayBadge(detailSeries.fullSeries, unlockedBadges)
            : detailSeries.fullSeries.find((badge) => unlockedBadges.has(badge.id)) ?? detailSeries.fullSeries[0]
        : null;

    const renderSeries = (mode: GalleryMode) => {
        const visible = seriesStates.filter((item) => {
            if (onlyUnlocked || mode === "unlocked") return item.lit;
            if (mode === "locked") return !item.lit;
            return true;
        });

        if (visible.length === 0) {
            return (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">{mode === "unlocked" ? "还没有获得徽章" : "已点亮全部系列"}</p>
                </div>
            );
        }

        return (
            <div className="divide-y divide-border/60">
                {visible.map(({ key, label, fullSeries, lit }) => {
                    const cards = isLadderSeries(key)
                        ? [getSeriesDisplayBadge(fullSeries, unlockedBadges)].filter((badge): badge is Badge => Boolean(badge))
                        : fullSeries;
                    const progress = getCardProgress(key, unlockedBadges, userStats);

                    return (
                        <section
                            key={key}
                            className="grid gap-3 py-4 first:pt-1 last:pb-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold tracking-tight sm:text-base">{label}</h3>
                                    {lit ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                            <CheckCircle2 className="h-3 w-3" />
                                            已点亮
                                        </span>
                                    ) : (
                                        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                            未解锁
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-600 dark:text-slate-300 sm:text-xs">
                                    {SERIES_COPY[key] ?? "这一组徽章记录了同一方向上的进展。"}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2.5 sm:justify-end">
                                {cards.map((badge) => {
                                    const unlocked = unlockedBadges.has(badge.id);
                                    return (
                                        <button
                                            key={badge.id}
                                            type="button"
                                            onClick={() => setDetailKey(key)}
                                            className={cn(
                                                "relative flex min-h-[88px] w-[84px] shrink-0 cursor-pointer flex-col items-center gap-1.5 overflow-hidden rounded-md border p-2 text-center transition-all duration-200 hover:shadow-md sm:min-h-[100px] sm:w-[96px] sm:gap-2 sm:p-3",
                                                unlocked
                                                    ? "border-white/70 bg-white/80 dark:border-white/12 dark:bg-slate-900/94"
                                                    : "border-slate-200/80 bg-white/55 opacity-95 dark:border-white/8 dark:bg-slate-950/82",
                                            )}
                                        >
                                            <BadgeIcon
                                                icon={badge.icon}
                                                tier={badge.tier}
                                                seriesKey={badge.seriesKey}
                                                size="md"
                                                locked={!unlocked}
                                                className="h-10 w-10 sm:h-12 sm:w-12"
                                            />
                                            <div className={cn("text-[10px] font-semibold leading-tight sm:text-sm", unlocked ? "text-foreground" : "text-slate-700 dark:text-slate-300")}>
                                                {badge.name}
                                            </div>
                                            {isLadderSeries(key) && progress ? (
                                                <div className="text-[10px] font-medium text-muted-foreground">{progress}</div>
                                            ) : null}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    };

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
            {showTabs ? (
                <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div className="shrink-0 border-b px-4">
                        <TabsList className="w-full justify-between bg-transparent p-0 sm:justify-start sm:gap-6">
                            <TabsTrigger value="all" className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm">
                                全部 <span className="ml-1 text-muted-foreground">{totalCount}</span>
                            </TabsTrigger>
                            <TabsTrigger value="unlocked" className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm">
                                已拥有 <span className="ml-1 text-muted-foreground">{litCount}</span>
                            </TabsTrigger>
                            <TabsTrigger value="locked" className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm">
                                未解锁 <span className="ml-1 text-muted-foreground">{totalCount - litCount}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <ScrollArea className="flex-1 bg-muted/10 p-3 sm:p-6">
                        <TabsContent value="all" className="mt-0">{renderSeries("all")}</TabsContent>
                        <TabsContent value="unlocked" className="mt-0">{renderSeries("unlocked")}</TabsContent>
                        <TabsContent value="locked" className="mt-0">{renderSeries("locked")}</TabsContent>
                    </ScrollArea>
                </Tabs>
            ) : (
                <div className="p-1 sm:p-2">{renderSeries(onlyUnlocked ? "unlocked" : "all")}</div>
            )}

            {detailSeries && detailDisplay ? (
                <BadgeDetailDialog
                    open={Boolean(detailKey)}
                    onOpenChange={(open) => {
                        if (!open) setDetailKey(null);
                    }}
                    seriesKey={detailSeries.key}
                    seriesBadges={detailSeries.fullSeries}
                    displayBadge={detailDisplay}
                    unlockedIds={unlockedBadges}
                    userBadgeDetails={userBadgeDetails}
                    userStats={userStats}
                />
            ) : null}
        </div>
    );
}

export function getLitSeriesCount(badges: Badge[], unlockedBadges: Set<string>) {
    const grouped = groupBadgesBySeries(badges);
    return SERIES_ORDER.filter(({ key }) => {
        const series = grouped.get(key) ?? [];
        return series.length > 0 && seriesIsLit(series, unlockedBadges);
    }).length;
}

export function getTotalSeriesCount(badges: Badge[]) {
    const grouped = groupBadgesBySeries(badges);
    return SERIES_ORDER.filter(({ key }) => (grouped.get(key) ?? []).length > 0).length;
}
