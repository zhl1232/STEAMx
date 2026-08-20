"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { BadgeDisplay, UserStats } from "@/lib/gamification/types";
import { BADGE_TIER_LABELS } from "@/lib/gamification/badges";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeIcon } from "./badge-icon";
import { BadgeSeriesGallery } from "./badge-series-gallery";

export function PublicProfileBadges({
  featuredBadges,
  allBadges,
  unlockedBadgeIds,
  userStats,
}: {
  featuredBadges: BadgeDisplay[];
  allBadges: BadgeDisplay[];
  unlockedBadgeIds: string[];
  userStats?: UserStats | null;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const unlockedSet = new Set(unlockedBadgeIds);
  const totalUnlockedCount = unlockedBadgeIds.length;

  if (featuredBadges.length === 0 && totalUnlockedCount === 0) {
    return null;
  }

  const visibleBadges = totalUnlockedCount > 4 ? featuredBadges.slice(0, 4) : featuredBadges;
  const remainingCount = totalUnlockedCount - visibleBadges.length;

  return (
    <>
      <div className="mt-2.5 flex items-center gap-2">
        {/* 1~4 枚高光金属勋章 */}
        <div className="flex items-center gap-2">
          {visibleBadges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="group relative flex items-center justify-center rounded-full transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110 focus:outline-none"
              title={`${badge.name}${badge.tier ? ` · ${BADGE_TIER_LABELS[badge.tier as keyof typeof BADGE_TIER_LABELS] || badge.tier}` : ""}：${badge.description}（点击查看全部成就图鉴）`}
            >
              <BadgeIcon
                icon={badge.icon}
                tier={badge.tier}
                seriesKey={badge.seriesKey}
                size="sm"
                showGlow
                className="h-8.5 w-8.5 drop-shadow-sm transition-all"
              />
            </button>
          ))}

          {/* 若有多余徽章，在第 5 个位置放同等尺寸（34px）的圆形 +N 入口 */}
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="group flex h-8.5 w-8.5 items-center justify-center rounded-full border border-dashed border-border/80 bg-background/60 text-[11px] font-bold text-muted-foreground shadow-2xs backdrop-blur-xs transition hover:-translate-y-0.5 hover:scale-110 hover:border-primary/50 hover:bg-background hover:text-primary focus:outline-none"
              title={`查看全部 ${totalUnlockedCount} 枚成就徽章`}
            >
              <span>+{remainingCount}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 全量成就徽章图鉴弹窗 */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <DialogTitle className="text-base sm:text-lg">
                成就徽章图鉴（已解锁 {totalUnlockedCount} 枚）
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <BadgeSeriesGallery
              badges={allBadges}
              unlockedBadges={unlockedSet}
              userStats={userStats}
              showTabs={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
