"use client";

import { useState } from "react";
import { Award, Sparkles } from "lucide-react";
import { BadgeDisplay, UserStats } from "@/lib/gamification/types";
import { BADGE_TIER_LABELS } from "@/lib/gamification/badges";
import { PROFILE_BADGE_VISIBLE_LIMIT } from "@/lib/gamification/honorifics";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeIcon } from "./badge-icon";
import { BadgeSeriesGallery } from "./badge-series-gallery";

export function PublicProfileBadges({
  featuredBadges,
  allBadges,
  unlockedBadgeIds,
  userStats,
  featuredBadgeIds,
  canManageHonors = false,
  showEmptyPlaceholder = false,
}: {
  featuredBadges: BadgeDisplay[];
  allBadges: BadgeDisplay[];
  unlockedBadgeIds: string[];
  userStats?: UserStats | null;
  featuredBadgeIds?: string[] | null;
  canManageHonors?: boolean;
  showEmptyPlaceholder?: boolean;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const unlockedSet = new Set(unlockedBadgeIds);
  const totalUnlockedCount = unlockedSet.size;
  const isExplicitlyEmpty = Array.isArray(featuredBadgeIds) && featuredBadgeIds.length === 0;

  if (isExplicitlyEmpty || (featuredBadges.length === 0 && totalUnlockedCount === 0)) {
    if (!showEmptyPlaceholder && !isExplicitlyEmpty) return null;

    return (
      <>
        <div className="mt-2.5 flex items-center">
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/80 bg-background/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-2xs backdrop-blur-xs transition hover:scale-105 hover:border-primary/50 hover:bg-background hover:text-primary focus:outline-none"
            title="点击查看徽章图鉴"
          >
            <Award className="h-3 w-3 text-muted-foreground" />
            <span>徽章图鉴</span>
          </button>
        </div>

        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden rounded-lg p-0 sm:rounded-xl">
            <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <DialogTitle className="text-base sm:text-lg">
                  徽章图鉴
                </DialogTitle>
                <DialogDescription className="sr-only">
                  浏览这个主页的徽章图鉴和解锁进度。
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <BadgeSeriesGallery
                badges={allBadges}
                unlockedBadges={unlockedSet}
                userStats={userStats}
                featuredBadgeIds={featuredBadgeIds}
                canManageHonors={canManageHonors}
                showTabs={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const visibleBadges = featuredBadges.slice(0, PROFILE_BADGE_VISIBLE_LIMIT);
  const remainingCount = Math.max(0, totalUnlockedCount - visibleBadges.length);

  return (
    <>
      <div className="mt-1.5 flex items-center gap-1.5">
        {/* 首屏只露出当前布局能容纳的主页徽章，剩余徽章通过 +N 查看 */}
        <div className="flex items-center gap-1.5">
          {visibleBadges.map((badge) => (
            <button
              key={badge.id}
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="group relative flex items-center justify-center rounded-full transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110 focus:outline-none"
              title={`${badge.name}${badge.tier ? ` · ${BADGE_TIER_LABELS[badge.tier as keyof typeof BADGE_TIER_LABELS] || badge.tier}` : ""}：${badge.description}（点击查看徽章图鉴）`}
            >
              <BadgeIcon
                icon={badge.icon}
                tier={badge.tier}
                seriesKey={badge.seriesKey}
                size="sm"
                showGlow
                className="h-8 w-8 drop-shadow-sm transition-all"
              />
            </button>
          ))}

          {/* 若还有未露出的已解锁徽章，追加同等尺寸的 +N 入口 */}
          {remainingCount > 0 ? (
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="group flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/70 text-[11px] font-extrabold text-foreground/80 shadow-2xs backdrop-blur-md transition hover:-translate-y-0.5 hover:scale-110 hover:border-primary/50 hover:bg-background hover:text-primary focus:outline-none"
              title={`查看其余 ${remainingCount} 枚已解锁徽章`}
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
                徽章图鉴（已解锁 {totalUnlockedCount} 枚）
              </DialogTitle>
              <DialogDescription className="sr-only">
                浏览这个主页的徽章图鉴和解锁进度。
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <BadgeSeriesGallery
              badges={allBadges}
              unlockedBadges={unlockedSet}
              userStats={userStats}
              featuredBadgeIds={featuredBadgeIds}
              canManageHonors={canManageHonors}
              showTabs={true}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
