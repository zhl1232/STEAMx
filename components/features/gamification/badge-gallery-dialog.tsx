"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, BadgeTier } from "@/lib/gamification/types";
import { SERIES_ORDER } from "@/lib/gamification/badges";

// ... existing imports
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

// ... existing imports
import { BadgeIcon } from "./badge-icon";

const TIER_ORDER: Record<BadgeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

// TIER_STYLES removed as they are now in BadgeIcon

interface BadgeGalleryDialogProps {
    badges: Badge[];
    unlockedBadges: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    children?: React.ReactNode;
}

function groupBadgesBySeries(badges: Badge[]): Map<string, Badge[]> {
    const map = new Map<string, Badge[]>();
    for (const badge of badges) {
        const key = badge.seriesKey ?? "other";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(badge);
    }
    for (const [, list] of map) {
        list.sort((a, b) => {
            if (a.tier && b.tier) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
            return 0;
        });
    }
    return map;
}

/** 阶梯系列只展示一枚：该系列已解锁的最高档，若都未解锁则展示铜档 */
function pickOneBadgePerTieredSeries(
    seriesList: Badge[],
    unlockedBadges: Set<string>
): Badge[] {
    if (seriesList.length !== 4 || !seriesList.every((b) => b.tier)) return seriesList;
    const unlocked = seriesList.filter((b) => unlockedBadges.has(b.id));
    if (unlocked.length === 0) return [seriesList[0]];
    const highest = unlocked.reduce((a, b) =>
        TIER_ORDER[a.tier!] > TIER_ORDER[b.tier!] ? a : b
    );
    return [highest];
}

export function BadgeGalleryDialog({ badges, unlockedBadges, userBadgeDetails, children }: BadgeGalleryDialogProps) {
    const [open, setOpen] = useState(false);

    const unlockedList = badges.filter((b) => unlockedBadges.has(b.id));
    const lockedList = badges.filter((b) => !unlockedBadges.has(b.id));
    const grouped = useMemo(() => groupBadgesBySeries(badges), [badges]);

    const BadgeCard = ({ badge, isUnlocked }: { badge: Badge; isUnlocked: boolean }) => {
        const details = userBadgeDetails?.get(badge.id);
        const unlockedDate = details?.unlockedAt ? new Date(details.unlockedAt).toLocaleDateString() : null;

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <div
                        className={`
                            relative overflow-hidden rounded-xl border p-2 sm:p-3 flex flex-col items-center text-center gap-1.5 sm:gap-2
                            transition-all duration-200 group h-full cursor-pointer hover:shadow-md
                            ${isUnlocked
                                ? "bg-gradient-to-br from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 border-white/20 shadow-sm"
                                : "bg-muted/30 border-muted opacity-80"
                            }
                        `}
                    >
                        <div className="flex justify-center p-1 sm:p-2">
                            <BadgeIcon 
                                icon={badge.icon} 
                                tier={badge.tier} 
                                size="md" 
                                locked={!isUnlocked}
                                className="w-10 h-10 sm:w-12 sm:h-12"
                            />
                        </div>
                        
                        <div className="w-full flex-1 flex flex-col justify-start min-h-0">
                            <div className={cn(
                                "font-semibold text-[10px] sm:text-sm line-clamp-1",
                                isUnlocked ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {badge.name}
                            </div>
                            {/* Hide description on mobile for cleaner look */}
                            <div className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-2 leading-tight">
                                {badge.description}
                            </div>
                        </div>
                    </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 p-2" align="center">
                    <DropdownMenuLabel className="flex justify-between items-center">
                        <span>{badge.name}</span>
                        {isUnlocked && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">已获得</span>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground leading-relaxed">
                        {badge.description}
                    </div>
                    {isUnlocked && unlockedDate && (
                        <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1.5 text-[10px] text-muted-foreground flex justify-between">
                                <span>获得时间</span>
                                <span>{unlockedDate}</span>
                            </div>
                        </>
                    )}
                    {!isUnlocked && (
                         <div className="px-2 py-1 text-[10px] text-orange-500/80 mt-1 italic">
                             尚未解锁
                         </div>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const renderGroupedGrid = (badgeList: Badge[]) => {
        // Flatten the badges into a single list based on SERIES_ORDER
        const combinedList: Badge[] = [];
        
        SERIES_ORDER.forEach(({ key: seriesKey }) => {
            const fullSeries = grouped.get(seriesKey) ?? [];
            const inTab = fullSeries.filter((b) => badgeList.some((x) => x.id === b.id));
            if (inTab.length === 0) return;
            
            const displayList = pickOneBadgePerTieredSeries(fullSeries, unlockedBadges);
            const showList = displayList.filter((b) => badgeList.some((x) => x.id === b.id));
            
            combinedList.push(...showList);
        });

        if (combinedList.length === 0) return null;

        return (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 p-1">
                {combinedList.map((badge) => (
                    <BadgeCard key={badge.id} badge={badge} isUnlocked={unlockedBadges.has(badge.id)} />
                ))}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children || <Button variant="outline">查看所有徽章</Button>}</DialogTrigger>
            <DialogContent className="flex h-[80vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0 sm:rounded-lg [&>button]:hidden">
                <DialogHeader className="shrink-0 p-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        徽章图鉴
                        <span className="ml-auto text-xs font-normal text-muted-foreground sm:ml-2 sm:text-sm">
                            {unlockedList.length}/{badges.length}
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="all" className="flex flex-1 flex-col overflow-hidden">
                    <div className="shrink-0 border-b px-4">
                        <TabsList className="w-full justify-between bg-transparent p-0 sm:justify-start sm:gap-6">
                            <TabsTrigger
                                value="all"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                全部 <span className="ml-1 text-muted-foreground">{badges.length}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="unlocked"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                已拥有 <span className="ml-1 text-muted-foreground">{unlockedList.length}</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="locked"
                                className="flex-1 rounded-none border-b-2 border-transparent px-0 pb-3 pt-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none sm:flex-none sm:text-sm"
                            >
                                未解锁 <span className="ml-1 text-muted-foreground">{lockedList.length}</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 bg-muted/10 p-3 sm:p-6">
                        <TabsContent value="all" className="mt-0">
                            {renderGroupedGrid(badges)}
                        </TabsContent>
                        <TabsContent value="unlocked" className="mt-0">
                            {unlockedList.length > 0 ? (
                                renderGroupedGrid(unlockedList)
                            ) : (
                                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                                    <div className="mb-4 text-4xl">🌱</div>
                                    <p className="text-sm">还没有获得徽章</p>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="locked" className="mt-0">
                            {lockedList.length > 0 ? (
                                renderGroupedGrid(lockedList)
                            ) : (
                                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
                                    <p className="text-sm">已解锁全部展示的徽章</p>
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>
                
                {/* Mobile Close Button (Optional, if we removed the top one) */}
                {/* For now we rely on clicking outside or native behavior if user wanted 'x' gone */}
            </DialogContent>
        </Dialog>
    );
}
