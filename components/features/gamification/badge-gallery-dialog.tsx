"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import type { BadgeDisplay, UserStats } from "@/lib/gamification/types";
import { BadgeSeriesGallery, getLitSeriesCount, getTotalSeriesCount } from "./badge-series-gallery";

interface BadgeGalleryDialogProps {
    badges: BadgeDisplay[];
    unlockedBadges: Set<string>;
    userBadgeDetails?: Map<string, { unlockedAt: string }>;
    userStats?: UserStats | null;
    featuredBadgeIds?: string[] | null;
    canManageHonors?: boolean;
    children?: React.ReactNode;
}

export function BadgeGalleryDialog({
    badges,
    unlockedBadges,
    userBadgeDetails,
    userStats,
    featuredBadgeIds,
    canManageHonors = true,
    children,
}: BadgeGalleryDialogProps) {
    const litCount = getLitSeriesCount(badges, unlockedBadges);
    const totalCount = getTotalSeriesCount(badges);

    return (
        <Dialog>
            <DialogTrigger asChild>{children || <Button variant="outline">查看所有徽章</Button>}</DialogTrigger>
            <DialogContent className="flex h-[80vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-sm p-0 sm:rounded-xs [&>button]:hidden">
                <DialogHeader className="shrink-0 p-4 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        徽章图鉴
                        <span className="ml-auto text-right text-xs font-normal text-muted-foreground sm:ml-2 sm:text-sm">
                            已解锁 {litCount} 个系列 · 共 {totalCount} 个系列
                        </span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        浏览全部徽章，点击徽章可查看解锁进度和主页佩戴状态。
                    </DialogDescription>
                </DialogHeader>
                <BadgeSeriesGallery
                    badges={badges}
                    unlockedBadges={unlockedBadges}
                    userBadgeDetails={userBadgeDetails}
                    userStats={userStats}
                    featuredBadgeIds={featuredBadgeIds}
                    canManageHonors={canManageHonors}
                />
            </DialogContent>
        </Dialog>
    );
}
