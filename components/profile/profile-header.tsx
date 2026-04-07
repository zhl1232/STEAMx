"use client";

import Link from "next/link";
import { User } from "@supabase/supabase-js";
import { ArrowUpRight, Bell, LayoutDashboard, Settings, ShieldCheck, Zap } from "lucide-react";

import { BadgeGalleryDialog } from "@/components/features/gamification/badge-gallery-dialog";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { EditProfileDialog } from "@/components/features/profile/edit-profile-dialog";
import { LevelGuideDialog } from "@/components/features/gamification/level-guide-dialog";
import { LevelProgress } from "@/components/features/gamification/level-progress";
import { CoinIcon } from "@/components/icons/coin-icon";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/role-badge";
import { useGamification, BADGES } from "@/context/gamification-context";
import { useNotifications } from "@/context/notification-context";
import { getBadgesForDisplay } from "@/lib/gamification/badges";
import { Profile } from "@/lib/mappers/types";

interface ProfileHeaderProps {
  user: User;
  profile: Profile | null;
  myProjectsCount: number;
  totalLikesReceived: number;
  followerCount: number;
  followingCount: number;
  worksEntryHref?: string;
  worksEntryLabel?: string;
  statLinks?: {
    works?: string;
    followers?: string;
    following?: string;
    likes?: string;
  };
}

export function ProfileHeader({
  user,
  profile,
  myProjectsCount,
  totalLikesReceived,
  followerCount,
  followingCount,
  worksEntryHref,
  worksEntryLabel,
  statLinks,
}: ProfileHeaderProps) {
  const { unlockedBadges, userBadgeDetails, coins = 0 } = useGamification();
  const { unreadCount } = useNotifications();

  const userName = profile?.display_name || user.user_metadata?.full_name || "未命名用户";
  const userAvatar = profile?.avatar_url || getDefaultAvatarPath(user.id);
  const currentXP = profile?.xp || 0;
  const level = Math.floor(Math.sqrt(currentXP / 100)) + 1;
  const nextLevelXP = 100 * Math.pow(level, 2);
  const featuredBadges =
    unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 5) : BADGES.slice(0, 5);
  const canReview = profile?.role === "admin" || profile?.role === "moderator";
  const canApplyModerator = !canReview && level >= 5;

  const stats = [
    { key: "works", label: "作品", value: myProjectsCount, href: statLinks?.works },
    { key: "followers", label: "粉丝", value: followerCount, href: statLinks?.followers },
    { key: "following", label: "关注", value: followingCount, href: statLinks?.following },
    { key: "likes", label: "获赞", value: totalLikesReceived, href: statLinks?.likes },
  ];

  return (
    <section className="surface-panel overflow-hidden">
      <div className="relative overflow-hidden px-4 pb-4 pt-4">
        {/* 多层渐变背景 - 更丰富的视觉层次 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_center,rgba(166,193,238,0.32),transparent_60%),radial-gradient(circle_at_80%_20%,rgba(251,194,235,0.24),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(166,193,238,0.12),transparent_50%)]" />
        {/* 顶部装饰光斑 */}
        <div className="absolute -top-12 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />

        <div className="relative">
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/coins"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3.5 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-all hover:bg-background/90 hover:shadow-md"
            >
              <CoinIcon className="h-[18px] w-[18px] text-amber-500" />
              <span className="tabular-nums">{coins}</span>
            </Link>

            <div className="flex items-center gap-1.5">
              <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 rounded-full border border-border/50 bg-background/70 backdrop-blur-md transition-all hover:bg-background/90 hover:shadow-md">
                <Link href="/messages">
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-5 text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                  <span className="sr-only">消息通知</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/50 bg-background/70 backdrop-blur-md transition-all hover:bg-background/90 hover:shadow-md">
                <Link href="/settings">
                  <Settings className="h-4.5 w-4.5" />
                  <span className="sr-only">设置</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* 居中式个人信息 */}
          <div className="mt-7 flex flex-col items-center">
            <div className="relative">
              <AvatarWithFrame
                src={userAvatar}
                alt={userName}
                fallback={userName[0]?.toUpperCase()}
                avatarFrameId={profile?.equipped_avatar_frame_id}
                className="h-[88px] w-[88px] shrink-0 border-[3px] border-background shadow-[0_16px_40px_-20px_rgba(15,23,42,0.3)]"
                avatarClassName="rounded-full object-cover"
              />
              <LevelGuideDialog>
                <button
                  type="button"
                  className="absolute -bottom-1.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-primary/20 bg-background/95 px-2.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm ring-1 ring-primary/10 transition-all hover:-translate-y-0.5 hover:-translate-x-1/2 hover:border-primary/35 hover:bg-background hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Zap className="h-3 w-3 text-primary" />
                  Lv.{level}
                  <ArrowUpRight className="h-2.5 w-2.5 text-primary/65" />
                </button>
              </LevelGuideDialog>
            </div>

            <div className="mt-4 flex flex-col items-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {profile?.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="md" /> : null}
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{userName}</h1>
              </div>

              <p className="mt-2 max-w-[260px] text-center text-[13px] leading-5 text-muted-foreground">
                {profile?.bio || "在这里整理作品、收藏、完成记录和自然观察。"}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {worksEntryHref && worksEntryLabel ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-full border-border/60 bg-background/70 px-5 text-xs font-medium backdrop-blur-sm">
                    <Link href={worksEntryHref}>{worksEntryLabel}</Link>
                  </Button>
                ) : null}

                <EditProfileDialog>
                  <Button variant="outline" size="sm" className="h-8 rounded-full border-border/60 bg-background/70 px-5 text-xs font-medium backdrop-blur-sm">
                    编辑资料
                  </Button>
                </EditProfileDialog>

                {canReview ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-full border-border/60 bg-background/70 px-4 text-xs font-medium backdrop-blur-sm">
                    <Link href="/admin">
                      <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                      管理后台
                    </Link>
                  </Button>
                ) : canApplyModerator ? (
                  <Button asChild variant="outline" size="sm" className="h-8 rounded-full border-border/60 bg-background/70 px-4 text-xs font-medium backdrop-blur-sm">
                    <Link href="/moderator/apply">
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      申请审核员
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* 统计数据 - 更紧凑的圆角卡片 */}
            <div className="mt-5 w-full overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm">
              <div className="grid grid-cols-4 divide-x divide-border/40">
                {stats.map((stat) => (
                  stat.href ? (
                    <Link
                      key={stat.key}
                      href={stat.href}
                      className="group px-2 py-3 text-center transition-all hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                    >
                      <div className="text-[15px] font-semibold tabular-nums text-foreground">{stat.value}</div>
                      <div className="mt-0.5 inline-flex items-center justify-center gap-1 text-[10px] text-muted-foreground/80">
                        <span>{stat.label}</span>
                        <ArrowUpRight className="h-2.5 w-2.5 text-primary/55 transition-colors group-hover:text-primary" />
                      </div>
                    </Link>
                  ) : (
                    <div key={stat.key} className="px-2 py-3 text-center">
                      <div className="text-[15px] font-semibold tabular-nums text-foreground">{stat.value}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground/80">{stat.label}</div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="surface-subtle p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">最近徽章与成长</p>
            <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
              <button type="button" className="text-xs font-medium text-primary transition-colors hover:text-primary/80">
                查看全部
              </button>
            </BadgeGalleryDialog>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {featuredBadges.map((badge) => (
              <BadgeIcon
                key={badge.id}
                icon={badge.icon}
                tier={badge.tier}
                size="sm"
                className="h-8 w-8"
                showGlow={false}
                locked={!unlockedBadges.has(badge.id)}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-border/60 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">成长进度</span>
              <span className="font-medium text-foreground/80">
                {currentXP}/{nextLevelXP}
              </span>
            </div>
            <LevelProgress showLabel={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
