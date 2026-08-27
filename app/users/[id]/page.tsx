import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { Award, CalendarDays } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { RoleBadge } from "@/components/ui/role-badge";
import { BADGES, getBadgeDisplayDefinitions } from '@/lib/gamification/badges';
import { PublicProfileBadges } from "@/components/features/gamification/public-profile-badges";
import { deriveFeaturedBadges, deriveUserTitle } from "@/lib/gamification/honorifics";
import { getPublicUserProfile } from "@/lib/api/public-user-profile";
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
    notFound();
  }

  const data = await getPublicUserProfile(userId);

  if (!data) {
    notFound();
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
  const displayBadges = getBadgeDisplayDefinitions(BADGES);

  // 推导称号与主页佩戴徽章（默认与手动都最多 5 枚）
  const userTitle = deriveUserTitle({
    equippedTitle: profile.equipped_title,
    unlockedBadgeIds,
    level,
  });

  const featuredBadges = deriveFeaturedBadges({
    featuredBadgeIds: profile.featured_badge_ids,
    unlockedBadgeIds,
    allBadges: displayBadges,
  });

  return (
    <div className="page-shell pt-0 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader
          title="公开主页"
          fallbackHref="/explore"
          borderless
          className="mb-3"
        />
      </div>

      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-lg border border-border/60 bg-[hsl(var(--brand-blue)/0.04)] shadow-[0_16px_50px_-30px_hsl(var(--surface-shadow)/0.35)]">
          <div className="relative overflow-hidden px-4 pb-4 pt-5 sm:px-7 sm:pb-6 sm:pt-6 lg:px-8">
            <Image
              src="/assets/profile-library-soft-blue-hero.png"
              alt=""
              fill
              sizes="(min-width: 768px) 1100px, 100vw"
              className="pointer-events-none select-none object-cover object-[62%_45%] opacity-75 dark:opacity-25"
            />
            {/* 柔和透光遮罩：保留背景淡蓝插画的清新视觉，底部自然渐变 */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-background/35 to-background/85 dark:from-background/40 dark:via-background/60 dark:to-background" />

            <div className="relative">
              <p className="section-kicker hidden md:block">公开主页</p>
              <div className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 md:mt-4 md:grid-cols-[6rem_minmax(0,1fr)] md:gap-6">
                {/* 头像 + 底部绝对居中等级徽章 */}
                <div className="flex flex-col items-center shrink-0">
                  <UserAvatar
                    userId={profile.id}
                    name={userName}
                    src={profile.avatar_url}
                    alt={userName}
                    fallback={userName[0]?.toUpperCase() || "U"}
                    avatarFrameId={profile.equipped_avatar_frame_id}
                    href={null}
                    className="h-20 w-20 border-[3px] border-background bg-muted shadow-sm ring-1 ring-border/30 md:h-24 md:w-24"
                    avatarClassName="rounded-full object-cover"
                  />
                  <div
                    className="relative -mt-2 inline-flex h-5.5 items-center justify-center rounded-full border border-[hsl(var(--brand-blue)/0.25)] bg-background/95 px-2.5 text-[11px] font-bold text-[hsl(var(--brand-blue))] shadow-xs backdrop-blur-xs"
                    title={`等级 Lv.${level}`}
                  >
                    Lv.{level}
                  </div>
                </div>

                <div className="contents md:flex md:min-w-0 md:items-start md:justify-between md:gap-5">
                  <div className="min-w-0 md:flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {profile.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="md" /> : null}
                      <h1 className={cn("text-xl font-bold tracking-tight sm:text-2xl md:text-3xl", userNameColorClassName)}>{userName}</h1>
                      {userTitle ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--brand-blue)/0.25)] bg-[hsl(var(--brand-blue)/0.08)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--brand-blue))] shadow-2xs dark:bg-[hsl(var(--brand-blue)/0.18)]"
                          title="成就称号"
                        >
                          <Award className="h-3.5 w-3.5 text-primary" />
                          {userTitle}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{profile.bio || "这个人很神秘，还没有写个人简介。"}</span>
                      <span className="opacity-40">·</span>
                      <div className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 opacity-70" />
                        <span>加入于 {joinedAt}</span>
                      </div>
                    </div>

                    {/* 高光勋章阵列：公开主页最多露出 5 枚，另有 +N 入口查看其余已解锁徽章 */}
                    <PublicProfileBadges
                      featuredBadges={featuredBadges}
                      allBadges={displayBadges}
                      unlockedBadgeIds={badgeIds}
                      featuredBadgeIds={profile.featured_badge_ids}
                      canManageHonors={false}
                      showEmptyPlaceholder
                    />
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

              {/* 独立微卡片数据统计栏 */}
              <div className="mt-4 grid grid-cols-3 divide-x divide-border/60 rounded-md border border-border/50 bg-background/75 py-2.5 shadow-2xs backdrop-blur-sm dark:bg-background/50">
                {overviewStats.map((item) => (
                  <div key={item.label} className="px-2 text-center sm:px-3">
                    <div className="text-lg font-bold tracking-tight tabular-nums text-foreground sm:text-xl">{item.value}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="works" className="space-y-4">
          <TabsList className="segmented-control grid h-auto w-full grid-cols-2 p-1 md:max-w-[24rem]">
            <TabsTrigger value="works" className="segmented-option min-w-0 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold data-[state=active]:bg-[hsl(var(--brand-blue))] data-[state=active]:text-[hsl(var(--brand-blue-foreground))] data-[state=active]:shadow-xs sm:px-4 sm:text-sm">
              作品 ({worksTotalCount})
            </TabsTrigger>
            <TabsTrigger value="projects" className="segmented-option min-w-0 whitespace-nowrap rounded-full px-2 py-1.5 text-xs font-semibold data-[state=active]:bg-[hsl(var(--brand-blue))] data-[state=active]:text-[hsl(var(--brand-blue-foreground))] data-[state=active]:shadow-xs sm:px-4 sm:text-sm" aria-label={`项目 (${projectsTotalCount})`}>
              项目 ({projectsTotalCount})
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
        </Tabs>
      </div>
    </div>
  );
}
