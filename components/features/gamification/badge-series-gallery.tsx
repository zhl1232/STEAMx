"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { BadgeDisplay, UserStats } from "@/lib/gamification/types";
import {
    SERIES_ORDER,
    getNextSeriesThreshold,
    getSeriesDisplayBadge,
    getSeriesProgressValue,
    getVisibleSeriesBadges,
    isLadderSeries,
} from "@/lib/gamification/badges";
import { BadgeIcon } from "./badge-icon";
import { BadgeDetailDialog } from "./badge-detail-dialog";

type GalleryMode = "all" | "unlocked" | "locked";
type DetailSelection = { seriesKey: string; badgeId: string };

function groupBadgesBySeries(badges: BadgeDisplay[]) {
    const map = new Map<string, BadgeDisplay[]>();
    for (const badge of badges) {
        const key = badge.seriesKey ?? "other";
        const list = map.get(key) ?? [];
        list.push(badge);
        map.set(key, list);
    }
    return map;
}

function seriesIsLit(seriesBadges: BadgeDisplay[], unlockedIds: Set<string>) {
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
    badges: BadgeDisplay[];
    unlockedBadges: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    userStats?: UserStats | null;
    showTabs?: boolean;
    onlyUnlocked?: boolean;
    className?: string;
}) {
    const grouped = useMemo(() => groupBadgesBySeries(badges), [badges]);
    const [detailSelection, setDetailSelection] = useState<DetailSelection | null>(null);

    const seriesStates = useMemo(() => {
        const orderedKeys = [
            ...SERIES_ORDER.map(({ key }) => key),
            ...Array.from(grouped.keys()).filter((key) => !SERIES_ORDER.some((item) => item.key === key)),
        ];

        return orderedKeys
            .map((key) => {
                const fullSeries = grouped.get(key);
                return fullSeries?.length ? { key, fullSeries, lit: seriesIsLit(fullSeries, unlockedBadges) } : null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [grouped, unlockedBadges]);

    const flatBadges = useMemo(
        () =>
            seriesStates.flatMap(({ key, fullSeries, lit }) => {
                const cards = isLadderSeries(key)
                    ? [getSeriesDisplayBadge(fullSeries, unlockedBadges)].filter((badge): badge is BadgeDisplay => Boolean(badge))
                    : getVisibleSeriesBadges(fullSeries, unlockedBadges);

                return cards.map((badge) => ({
                    badge,
                    seriesKey: key,
                    lit,
                    unlocked: unlockedBadges.has(badge.id),
                }));
            }),
        [seriesStates, unlockedBadges],
    );
    const litCount = seriesStates.filter((item) => item.lit).length;
    const totalCount = seriesStates.length;
    const detailSeries = detailSelection ? seriesStates.find((item) => item.key === detailSelection.seriesKey) : null;
    const detailVisibleBadges = detailSeries ? getVisibleSeriesBadges(detailSeries.fullSeries, unlockedBadges) : [];
    const detailDisplay = detailSeries && isLadderSeries(detailSeries.key)
        ? getSeriesDisplayBadge(detailSeries.fullSeries, unlockedBadges)
        : detailVisibleBadges.find((badge) => badge.id === detailSelection?.badgeId)
            ?? detailVisibleBadges.find((badge) => unlockedBadges.has(badge.id))
            ?? detailVisibleBadges[0]
            ?? null;

    const renderBadges = (mode: GalleryMode) => {
        const visible = flatBadges.filter(({ unlocked }) => {
            if (onlyUnlocked || mode === "unlocked") return unlocked;
            if (mode === "locked") return !unlocked;
            return true;
        });

        if (visible.length === 0) {
            return (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                    <p className="text-sm">{mode === "unlocked" ? "还没有获得徽章" : "已解锁全部徽章"}</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                {visible.map(({ badge, seriesKey, unlocked }) => {
                    const unlockedAt = userBadgeDetails?.get(badge.id)?.unlockedAt;
                    const unlockedDate = unlockedAt ? new Date(unlockedAt).toLocaleDateString("zh-CN") : null;
                    const progress = isLadderSeries(seriesKey) ? getCardProgress(seriesKey, unlockedBadges, userStats) : null;

                    return (
                        <button
                            key={badge.id}
                            type="button"
                            aria-label={`${badge.name}${unlocked ? "，已获得" : "，未解锁"}`}
                            title={badge.description}
                            onClick={() => setDetailSelection({ seriesKey, badgeId: badge.id })}
                            className={cn(
                                "group relative flex min-h-[108px] min-w-0 cursor-pointer flex-col items-center gap-1.5 overflow-hidden rounded-md border p-2 text-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-[132px] sm:gap-2 sm:p-3",
                                unlocked
                                    ? "border-white/70 bg-white/80 dark:border-white/12 dark:bg-slate-900/94"
                                    : "border-slate-200/80 bg-white/55 opacity-95 dark:border-white/8 dark:bg-slate-950/82",
                            )}
                        >
                            <div className="relative flex justify-center p-1 sm:p-2">
                                <BadgeIcon
                                    icon={badge.icon}
                                    tier={badge.tier}
                                    seriesKey={badge.seriesKey}
                                    size="md"
                                    locked={!unlocked}
                                    className="h-10 w-10 sm:h-12 sm:w-12"
                                />
                            </div>
                            <div className={cn("line-clamp-2 text-[10px] font-semibold leading-tight sm:text-sm", unlocked ? "text-foreground" : "text-slate-700 dark:text-slate-300")}>
                                {badge.name}
                            </div>
                            {unlocked && unlockedDate ? (
                                <div className="mt-auto text-[10px] font-medium leading-none text-emerald-600 dark:text-emerald-400">
                                    {unlockedDate} 获得
                                </div>
                            ) : progress ? (
                                <div className="mt-auto text-[10px] font-medium text-muted-foreground">{progress}</div>
                            ) : (
                                <div className="mt-auto hidden line-clamp-2 text-[10px] leading-tight text-slate-600 dark:text-slate-400 sm:block sm:text-xs">
                                    {badge.description}
                                </div>
                            )}
                        </button>
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
                        <TabsContent value="all" className="mt-0">{renderBadges("all")}</TabsContent>
                        <TabsContent value="unlocked" className="mt-0">{renderBadges("unlocked")}</TabsContent>
                        <TabsContent value="locked" className="mt-0">{renderBadges("locked")}</TabsContent>
                    </ScrollArea>
                </Tabs>
            ) : (
                <div className="p-1 sm:p-2">{renderBadges(onlyUnlocked ? "unlocked" : "all")}</div>
            )}

            {detailSeries && detailDisplay ? (
                <BadgeDetailDialog
                    open={Boolean(detailSelection)}
                    onOpenChange={(open) => {
                        if (!open) setDetailSelection(null);
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

export function getLitSeriesCount(badges: BadgeDisplay[], unlockedBadges: Set<string>) {
    const grouped = groupBadgesBySeries(badges);
    return getOrderedSeriesKeys(grouped).filter((key) => {
        const series = grouped.get(key) ?? [];
        return series.length > 0 && seriesIsLit(series, unlockedBadges);
    }).length;
}

export function getTotalSeriesCount(badges: BadgeDisplay[]) {
    const grouped = groupBadgesBySeries(badges);
    return getOrderedSeriesKeys(grouped).filter((key) => (grouped.get(key) ?? []).length > 0).length;
}

function getOrderedSeriesKeys(grouped: Map<string, BadgeDisplay[]>) {
    return [
        ...SERIES_ORDER.map(({ key }) => key),
        ...Array.from(grouped.keys()).filter((key) => !SERIES_ORDER.some((item) => item.key === key)),
    ];
}
