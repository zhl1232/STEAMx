"use client";

import Link from "next/link";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { Button } from "@/components/ui/button";
import { Settings, Zap, Coins } from "lucide-react";
import { LevelProgress } from "@/components/features/gamification/level-progress";
import { LevelGuideDialog } from "@/components/features/gamification/level-guide-dialog";
import { BadgeGalleryDialog } from "@/components/features/gamification/badge-gallery-dialog";
import { EditProfileDialog } from "@/components/features/profile/edit-profile-dialog";
import { useGamification, BADGES } from "@/context/gamification-context";
import { getBadgesForDisplay } from "@/lib/gamification/badges";
import { Profile } from "@/lib/mappers/types";
import { User } from "@supabase/supabase-js";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";

interface ProfileHeaderProps {
  user: User;
  profile: Profile | null;
  myProjectsCount: number;
  likedProjectsCount: number;
  collectedProjectsCount: number;
  totalLikesReceived: number;
  followerCount: number;
  followingCount: number;
}

export function ProfileHeader({
  user,
  profile,
  totalLikesReceived,
  followerCount,
  followingCount,
}: ProfileHeaderProps) {
  const { unlockedBadges, userBadgeDetails, coins = 0 } = useGamification();

  const userName = profile?.display_name || user.user_metadata?.full_name || "未命名用户";
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;
  const currentXP = profile?.xp || 0;
  const level = Math.floor(Math.sqrt(currentXP / 100)) + 1;
  const nextLevelXP = 100 * Math.pow(level, 2);

  return (
    <>
      {/* 1. 顶部横幅：模糊背景 + 右侧硬币/设置 */}
      <div className="relative h-28 w-full overflow-hidden">
        <OptimizedImage
          src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2000&auto=format&fit=crop"
          alt="Cover"
          fill
          variant="cover"
          className="object-cover scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-secondary/10 to-background/80 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/60" />

        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <Link href="/coins">
            <div className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-primary-foreground shadow-md">
              <Coins className="h-4 w-4" />
              <span className="text-sm font-bold">{coins}</span>
            </div>
          </Link>
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
              asChild
            >
              <span>
                <Settings className="h-5 w-5" />
              </span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. 个人信息区：头像左 + 粉丝/关注/获赞 + 编辑资料（参考图布局） */}
      <div className="relative px-4 -mt-10 mb-4">
        <div className="flex gap-5 items-start">
          {/* 左侧：大头像 + 在线点 */}
          <div className="relative shrink-0">
            <AvatarWithFrame
              src={userAvatar}
              alt={userName}
              fallback={userName[0]?.toUpperCase()}
              avatarFrameId={profile?.equipped_avatar_frame_id}
              className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 border-4 border-background shadow-lg"
              avatarClassName="rounded-full object-cover bg-gradient-to-tr from-primary to-secondary"
            />
            <div
              className="absolute bottom-0 right-0 h-5 w-5 rounded-full bg-green-500 border-[2px] border-background"
              title="在线"
            />
          </div>

          {/* 右侧：粉丝/关注/获赞 横向三列（数字在上、标签在下）+ 编辑资料 */}
          <div className="flex flex-col justify-center gap-4 min-w-0 flex-1">
            <div className="flex items-stretch divide-x divide-border">
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-1 min-w-[4rem]">
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {followerCount}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">粉丝</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-1 min-w-[4rem]">
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {followingCount}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">关注</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-4 py-1 min-w-[4rem]">
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {totalLikesReceived}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">获赞</span>
              </div>
            </div>
            <EditProfileDialog>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg border-primary/50 text-primary hover:bg-primary/10 w-full sm:w-fit px-5 font-medium h-9"
              >
                编辑资料
              </Button>
            </EditProfileDialog>
          </div>
        </div>

        {/* 3. 用户名 + 等级（点等级进入升级说明）+ 徽章（点徽章进入全部） */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-foreground truncate">{userName}</h1>
          <LevelGuideDialog>
            <button
              type="button"
              className="flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm shrink-0 hover:opacity-90 transition-opacity"
            >
              <Zap className="h-3 w-3 fill-current" />
              Lv.{level}
            </button>
          </LevelGuideDialog>
          <BadgeGalleryDialog
            badges={BADGES}
            unlockedBadges={unlockedBadges}
            userBadgeDetails={userBadgeDetails}
          >
            <div className="flex -space-x-1.5 shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
              {(unlockedBadges.size > 0
                ? getBadgesForDisplay(BADGES, unlockedBadges, 3)
                : BADGES.slice(0, 3)
              ).map((b) => (
                <div key={b.id} className="relative z-0">
                  <BadgeIcon
                    icon={b.icon}
                    tier={b.tier}
                    size="sm"
                    className="w-7 h-7"
                    showGlow={false}
                    locked={!unlockedBadges.has(b.id)}
                  />
                </div>
              ))}
            </div>
          </BadgeGalleryDialog>
        </div>

        {/* 4. 等级进度条 */}
        <div className="mt-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-muted-foreground">等级进度</span>
            <span className="text-[10px] font-medium text-primary">
              {currentXP}/{nextLevelXP}
            </span>
          </div>
          <LevelProgress showLabel={false} className="h-1.5 rounded-full" />
        </div>

        {/* 5. 个人描述 */}
        {profile?.bio && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{profile.bio}</p>
        )}
      </div>
    </>
  );
}
