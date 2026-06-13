import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";
import { CalendarDays, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { RoleBadge } from "@/components/ui/role-badge";
import { BADGES } from '@/lib/gamification/badges';
import { SERIES_ORDER } from "@/lib/gamification/badges";
import { PageStatus } from "@/components/ui/page-status";
import { getPublicUserProfile } from "@/lib/api/public-user-profile";
import { PublicProfileActions } from "./public-profile-actions";
import { PublicProfileProjects } from "./public-profile-projects";

interface PublicProfilePageProps {
  params: Promise<{ id?: string }>;
}

const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 } as const;

function groupBadgesBySeries() {
  const grouped = new Map<string, typeof BADGES>();
  for (const badge of BADGES) {
    const key = badge.seriesKey ?? "other";
    const list = grouped.get(key) ?? [];
    list.push(badge);
    grouped.set(key, list);
  }

  for (const [, list] of grouped) {
    list.sort((a, b) => {
      if (a.tier && b.tier) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      return 0;
    });
  }

  return grouped;
}

function getSeriesPanelClass(seriesKey: string) {
  if (seriesKey === "rare") {
    return "border-pink-200/70 bg-gradient-to-br from-pink-50/90 via-background to-rose-50/70 dark:border-fuchsia-400/20 dark:from-fuchsia-950/35 dark:via-slate-950 dark:to-rose-950/25";
  }
  if (seriesKey === "bird_observer" || seriesKey === "species_collector") {
    return "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-background to-teal-50/70 dark:border-emerald-400/20 dark:from-emerald-950/35 dark:via-slate-950 dark:to-teal-950/25";
  }
  if (seriesKey === "science_expert" || seriesKey === "tech_expert" || seriesKey === "life" || seriesKey === "circuit") {
    return "border-cyan-200/70 bg-gradient-to-br from-cyan-50/90 via-background to-sky-50/70 dark:border-cyan-400/20 dark:from-cyan-950/35 dark:via-slate-950 dark:to-sky-950/25";
  }
  if (seriesKey === "art_expert") {
    return "border-rose-200/70 bg-gradient-to-br from-rose-50/90 via-background to-amber-50/65 dark:border-rose-400/20 dark:from-rose-950/35 dark:via-slate-950 dark:to-amber-950/20";
  }
  if (seriesKey === "challenge" || seriesKey === "streak" || seriesKey === "minesweeper") {
    return "border-orange-200/70 bg-gradient-to-br from-orange-50/90 via-background to-red-50/65 dark:border-orange-400/20 dark:from-orange-950/35 dark:via-slate-950 dark:to-red-950/20";
  }
  if (seriesKey === "game24" || seriesKey === "game2048" || seriesKey === "sudoku" || seriesKey === "gomoku" || seriesKey === "hanoi" || seriesKey === "nqueens") {
    return "border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-background to-indigo-50/70 dark:border-violet-400/20 dark:from-violet-950/35 dark:via-slate-950 dark:to-indigo-950/25";
  }
  return "border-border/60 bg-gradient-to-br from-background via-background to-muted/40 dark:border-white/10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900/80";
}

function getSeriesStatusClass(isComplete: boolean) {
  if (isComplete) {
    return "border-emerald-200/80 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200";
  }

  return "border-white/60 bg-background/70 text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/70";
}

function getBadgeCardClass(isUnlocked: boolean) {
  if (isUnlocked) {
    return "border-primary/20 bg-white/85 shadow-[0_20px_40px_-28px_rgba(59,130,246,0.32)] dark:border-primary/30 dark:bg-white/[0.07] dark:shadow-[0_20px_40px_-28px_rgba(96,165,250,0.28)]";
  }

  return "bg-background/82 dark:bg-slate-950/65";
}

function getUnlockBadgeClass(isUnlocked: boolean) {
  if (isUnlocked) {
    return "h-5 border-emerald-200/80 bg-emerald-500/10 text-[10px] text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/12 dark:text-emerald-200";
  }

  return "h-5 border-border/70 bg-background/65 text-[10px] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04] dark:text-white/65";
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
    followerCount,
    followingCount,
    badgeIds,
    hasMoreProjects,
  } = data;
  const level = Math.floor(Math.sqrt((profile.xp || 0) / 100)) + 1;
  const userName = profile.display_name || "匿名用户";
  const joinedAt = formatJoinDate(profile.created_at);
  const overviewStats = [
    { label: "项目", value: projectsTotalCount },
    { label: "粉丝", value: followerCount },
    { label: "关注", value: followingCount },
  ];
  const groupedBadges = groupBadgesBySeries();
  const unlockedBadgeIds = new Set(badgeIds);

  return (
    <div className="page-shell pt-0 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader
          title={userName}
          fallbackHref="/create"
          className="-mx-4 mb-4"
        />
      </div>

      <div className="space-y-6">
        <section className="surface-panel overflow-hidden">
          <div className="relative overflow-hidden bg-gradient-to-r from-background via-background/95 to-primary/[0.08] px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
            <div className="absolute inset-y-0 right-0 hidden w-44 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_68%)] lg:block" />
            <div className="relative">
              <p className="section-kicker">公开主页</p>
              <div className="mt-4 flex flex-col gap-8 md:flex-row md:items-center">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-muted shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] md:h-32 md:w-32">
                    {profile.avatar_url ? (
                      <OptimizedImage src={profile.avatar_url} alt={userName} fill variant="avatar" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/18 to-secondary/18 text-4xl font-bold text-primary">
                        {userName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 rounded-full border border-border/70 bg-background/92 px-3 py-1 text-sm font-bold shadow-sm">
                    Lv.{level}
                  </div>
                </div>

                <div className="flex-1 space-y-5 text-center md:text-left">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                        {profile.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="md" /> : null}
                        <h1 className="text-3xl font-semibold tracking-tight">{userName}</h1>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          加入于 {joinedAt}
                        </div>
                      </div>
                      <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0">
                        {profile.bio || "暂未填写个人简介。"}
                      </p>
                    </div>

                    <PublicProfileActions
                      targetUserId={profile.id}
                      messagePrivacy={profile.message_privacy}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {overviewStats.map((item) => (
                      <div key={item.label} className="surface-subtle px-4 py-3 text-center md:text-left">
                        <div className="text-lg font-semibold">{item.value}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="segmented-control grid h-auto w-full max-w-[420px] grid-cols-2 rounded-full bg-transparent p-1">
            <TabsTrigger value="projects" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">
              项目 ({projectsTotalCount})
            </TabsTrigger>
            <TabsTrigger value="badges" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">
              徽章 ({unlockedBadgeIds.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-6">
            <PublicProfileProjects
              userId={userId}
              initialProjects={projects}
              initialHasMore={hasMoreProjects}
            />
          </TabsContent>

          <TabsContent value="badges">
            <div className="space-y-5">
              {SERIES_ORDER.map(({ key, label }) => {
                const badgesInSeries = groupedBadges.get(key) ?? [];
                if (badgesInSeries.length === 0) return null;
                const unlockedCount = badgesInSeries.filter((badge) => unlockedBadgeIds.has(badge.id)).length;

                return (
                  <section
                    key={key}
                    className={cn("rounded-xl border p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)] sm:p-5", getSeriesPanelClass(key))}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight sm:text-base">{label}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {unlockedCount}/{badgesInSeries.length} 枚已解锁
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-6 rounded-full px-2.5 text-[10px] shadow-sm",
                          getSeriesStatusClass(unlockedCount === badgesInSeries.length),
                        )}
                      >
                        {unlockedCount === badgesInSeries.length ? "已完成" : "进行中"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                      {badgesInSeries.map((badge) => {
                        const isUnlocked = unlockedBadgeIds.has(badge.id);
                        return (
                          <div
                            key={badge.id}
                            className={cn(
                              "surface-subtle flex flex-col items-center justify-center gap-3 p-6 text-center",
                              getBadgeCardClass(isUnlocked),
                            )}
                          >
                            <BadgeIcon
                              icon={badge.icon}
                              tier={badge.tier}
                              seriesKey={badge.seriesKey}
                              size="lg"
                              locked={!isUnlocked}
                            />
                            <div>
                              <div className="text-sm font-bold">{badge.name}</div>
                              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {badge.description}
                              </div>
                            </div>
                            {isUnlocked ? (
                              <Badge
                                variant="secondary"
                                className={getUnlockBadgeClass(true)}
                              >
                                已解锁
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={getUnlockBadgeClass(false)}>
                                未解锁
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
