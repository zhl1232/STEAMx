import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";
import { CalendarDays, UserRound } from "lucide-react";
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame";
import { RoleBadge } from "@/components/ui/role-badge";
import { BADGES } from '@/lib/gamification/badges';
import { BadgeSeriesGallery } from "@/components/features/gamification/badge-series-gallery";
import { PageStatus } from "@/components/ui/page-status";
import { getPublicUserProfile } from "@/lib/api/public-user-profile";
import { getDefaultAvatarPath } from "@/lib/profile/avatar-options";
import { getNameColorClassName } from "@/lib/shop/items";
import { PublicProfileActions } from "./public-profile-actions";
import { PublicProfileProjects } from "./public-profile-projects";
import { PublicProfileWorks } from "./public-profile-works";

interface PublicProfilePageProps {
  params: Promise<{ id?: string }>;
}

function formatJoinDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "未知";

  return parsed.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { id: userId } = await params;
  if (!userId) {
    return (
      <PageStatus
        kicker="主页地址"
        title="链接无效"
        description="这个用户主页链接不完整，无法继续访问。"
        icon={<UserRound className="h-8 w-8" />}
        actions={
          <Button asChild variant="outline" className="px-5">
            <Link href="/create">返回创造营</Link>
          </Button>
        }
      />
    );
  }

  const data = await getPublicUserProfile(userId);

  if (!data) {
    return (
      <PageStatus
        kicker="公开主页"
        title="没有找到这个用户"
        description="这个主页可能不存在，或者当前不可见。"
        icon={<UserRound className="h-8 w-8" />}
        actions={
          <Button asChild variant="outline" className="px-5">
            <Link href="/create">返回创造营</Link>
          </Button>
        }
      />
    );
  }

  const {
    profile,
    projects,
    projectsTotalCount,
    works,
    worksTotalCount,
    followerCount,
    followingCount,
    badgeIds,
    hasMoreProjects,
    hasMoreWorks,
  } = data;
  const level = Math.floor(Math.sqrt((profile.xp || 0) / 100)) + 1;
  const userName = profile.display_name || "匿名用户";
  const userNameColorClassName = getNameColorClassName(profile.equipped_name_color_id);
  const joinedAt = formatJoinDate(profile.created_at);
  const overviewStats = [
    { label: "作品", value: worksTotalCount },
    { label: "粉丝", value: followerCount },
    { label: "关注", value: followingCount },
  ];
  const unlockedBadgeIds = new Set(badgeIds);

  return (
    <div className="page-shell pt-0 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="公开主页"
          fallbackHref="/create"
          borderless
          className="mb-4"
        />
      </div>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-lg shadow-[0_24px_70px_-46px_hsl(var(--surface-shadow)/0.42)]">
          <div className="relative overflow-hidden bg-[hsl(var(--brand-blue)/0.04)] px-4 pb-4 pt-5 sm:px-7 sm:pb-6 sm:pt-6 lg:px-8">
            <Image
              src="/assets/profile-library-soft-blue-hero.png"
              alt=""
              fill
              sizes="(min-width: 768px) 1100px, 100vw"
              className="object-cover object-[62%_50%] opacity-85 dark:opacity-25"
            />
            <div className="absolute inset-0 bg-background/55 dark:bg-background/78" />
            <div className="relative">
              <p className="section-kicker hidden md:block">公开主页</p>
              <div className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 md:mt-4 md:grid-cols-[7rem_minmax(0,1fr)] md:gap-7">
                <div className="flex flex-col items-center md:items-start">
                  <div className="flex flex-col items-center">
                    <AvatarWithFrame
                      src={profile.avatar_url || getDefaultAvatarPath(profile.id)}
                      alt={userName}
                      fallback={userName[0]?.toUpperCase() || "U"}
                      avatarFrameId={profile.equipped_avatar_frame_id}
                      className="h-20 w-20 border-4 border-background bg-muted shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] md:h-28 md:w-28"
                      avatarClassName="rounded-full object-cover"
                    />
                    <div className="relative mt-1.5 rounded-full border border-[hsl(var(--brand-blue)/0.2)] bg-background/95 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-xs">
                      Lv.{level}
                    </div>
                  </div>
                </div>

                <div className="contents md:flex md:min-w-0 md:items-start md:justify-between md:gap-5">
                  <div className="min-w-0 md:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {profile.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="md" /> : null}
                      <h1 className={cn("text-2xl font-semibold tracking-tight md:text-3xl", userNameColorClassName)}>{userName}</h1>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--brand-blue)/0.16)] bg-[hsl(var(--brand-blue)/0.05)] px-3 py-1.5 text-xs font-medium text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        加入于 {joinedAt}
                      </div>
                    </div>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {profile.bio || "暂未填写个人简介。"}
                    </p>
                  </div>

                  <div className="col-span-2 flex min-w-0 justify-center md:col-span-1 md:shrink-0 md:justify-end">
                    <PublicProfileActions
                      targetUserId={profile.id}
                      messagePrivacy={profile.message_privacy}
                      className="w-full md:w-auto"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 divide-x divide-border/60 border-t border-border/70">
                {overviewStats.map((item) => (
                  <div key={item.label} className="px-2 pb-1 pt-3 text-center sm:px-3">
                    <div className="text-lg font-semibold tabular-nums">{item.value}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="works" className="space-y-4">
          <TabsList className="segmented-control grid h-auto w-full grid-cols-3 p-1 md:max-w-[42rem]">
            <TabsTrigger value="works" className="segmented-option min-w-0 whitespace-nowrap rounded-full px-1 text-xs data-[state=active]:bg-[hsl(var(--brand-blue))] data-[state=active]:text-[hsl(var(--brand-blue-foreground))] data-[state=active]:shadow-xs sm:px-4 sm:text-sm">
              作品 ({worksTotalCount})
            </TabsTrigger>
            <TabsTrigger value="projects" className="segmented-option min-w-0 whitespace-nowrap rounded-full px-1 text-xs data-[state=active]:bg-[hsl(var(--brand-blue))] data-[state=active]:text-[hsl(var(--brand-blue-foreground))] data-[state=active]:shadow-xs sm:px-4 sm:text-sm" aria-label={`发布的项目 (${projectsTotalCount})`}>
              <span className="min-[360px]:hidden">项目</span>
              <span className="hidden min-[360px]:inline">发布的项目</span> ({projectsTotalCount})
            </TabsTrigger>
            <TabsTrigger value="badges" className="segmented-option min-w-0 whitespace-nowrap rounded-full px-1 text-xs data-[state=active]:bg-[hsl(var(--brand-blue))] data-[state=active]:text-[hsl(var(--brand-blue-foreground))] data-[state=active]:shadow-xs sm:px-4 sm:text-sm">
              徽章 ({unlockedBadgeIds.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="works" className="space-y-6">
            <PublicProfileWorks userId={userId} initialWorks={works} initialHasMore={hasMoreWorks} />
          </TabsContent>

          <TabsContent value="projects" className="space-y-6">
            <PublicProfileProjects
              userId={userId}
              initialProjects={projects}
              initialHasMore={hasMoreProjects}
            />
          </TabsContent>

          <TabsContent value="badges">
            <BadgeSeriesGallery
              badges={BADGES}
              unlockedBadges={unlockedBadgeIds}
              showTabs={false}
              onlyUnlocked
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
