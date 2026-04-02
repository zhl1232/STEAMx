"use client";

import { useEffect, useState } from "react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ProfileSkeleton } from "@/components/features/profile/profile-skeleton";
import { ProjectCard } from "@/components/features/project-card";
import { FollowButton } from "@/components/features/social/follow-button";
// Note: removed useFollow import as we now query follower count directly
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { FolderOpen, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BadgeIcon } from "@/components/features/gamification/badge-icon";
import { RoleBadge } from "@/components/ui/role-badge";
import { BADGES } from "@/context/gamification-context";
import { logger } from "@/lib/logger";

interface PublicProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  xp: number;
  role?: 'user' | 'teacher' | 'moderator' | 'admin';
  created_at: string;
}

export default function PublicProfilePage() {
  const params = useParams();
  // params.id can be string | string[] | undefined in Next.js
  const rawId = params?.id;
  const userId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [unlockedBadgeIds, setUnlockedBadgeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();
    const fetchProfileData = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        const response = await fetch(`/api/users/${userId}`, { signal: controller.signal });
        if (response.status === 404) {
          setProfile(null);
          return;
        }
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();

        setProfile((payload?.profile as PublicProfile) || null);
        setProjects((payload?.projects as Project[]) || []);
        setFollowerCount(payload?.followerCount || 0);
        setFollowingCount(payload?.followingCount || 0);
        setUnlockedBadgeIds(new Set((payload?.badgeIds as string[]) || []));
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        logger.error("Error fetching profile", { error: err });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchProfileData();
    return () => controller.abort();
  }, [userId]);

  if (isLoading) return <ProfileSkeleton />;
  if (!profile) return <div className="page-shell py-20 text-center">用户不存在</div>;

  // Redirect to own profile if viewing self
  if (currentUser?.id === userId) {
    // Optionally redirect or just render this view (this view is public, so it's fine)
  }

  const level = Math.floor(Math.sqrt((profile.xp || 0) / 100)) + 1;
  const userName = profile.display_name || "匿名用户";

  return (
    <div className="page-shell pt-6 pb-24 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title={userName} fallbackHref="/community" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_320px]">
        <div className="space-y-6">
          <section className="surface-panel overflow-hidden">
            <div className="bg-gradient-to-r from-background/95 via-background/90 to-primary/[0.06] px-5 py-6 sm:px-7 sm:py-7 lg:px-8">
              <p className="section-kicker">公开主页</p>
              <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-center">
                <div className="relative">
                  <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-muted shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] md:h-32 md:w-32">
                    {profile.avatar_url ? (
                      <OptimizedImage src={profile.avatar_url} alt={userName} fill variant="avatar" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/18 to-secondary/18 text-4xl font-bold text-primary">
                        {userName[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-1 rounded-full border border-border/70 bg-background/92 px-3 py-1 text-sm font-bold shadow-sm">
                    Lv.{level}
                  </div>
                </div>

                <div className="flex-1 space-y-4 text-center md:text-left">
                  <div>
                    <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                      {profile.role && profile.role !== "user" ? <RoleBadge role={profile.role} size="md" /> : null}
                      <h1 className="text-3xl font-semibold tracking-tight">{userName}</h1>
                    </div>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:mx-0">
                      {profile.bio || "这个人还没有补充个人简介。"}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "项目", value: projects.length },
                      { label: "粉丝", value: followerCount },
                      { label: "关注", value: followingCount },
                    ].map((item) => (
                      <div key={item.label} className="surface-subtle px-4 py-3 text-center md:text-left">
                        <div className="text-lg font-semibold">{item.value}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <FollowButton
                      targetUserId={profile.id}
                      showCount={false}
                      className="h-11 rounded-2xl px-6 text-sm font-semibold"
                    />
                    {currentUser && currentUser.id !== userId ? (
                      <Button variant="outline" className="h-11 rounded-2xl px-6 text-sm font-semibold" asChild>
                        <Link href={`/messages/${userId}`}>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          发私信
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Tabs defaultValue="projects" className="space-y-6">
            <TabsList className="segmented-control grid h-auto w-full max-w-[420px] grid-cols-2 rounded-full bg-transparent p-1">
              <TabsTrigger value="projects" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">
                项目 ({projects.length})
              </TabsTrigger>
              <TabsTrigger value="badges" className="segmented-option rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-sm">
                徽章 ({unlockedBadgeIds.size})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="space-y-6">
              {projects.length === 0 ? (
                <div className="surface-panel px-6 py-16 text-center">
                  <FolderOpen className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">暂无发布项目</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="badges">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
                {BADGES.map((badge) => {
                  const isUnlocked = unlockedBadgeIds.has(badge.id);
                  return (
                    <div
                      key={badge.id}
                      className={cn(
                        "surface-subtle flex flex-col items-center justify-center gap-3 p-6 text-center",
                        isUnlocked && "border-primary/25 bg-primary/[0.06]",
                      )}
                    >
                      <BadgeIcon
                        icon={badge.icon}
                        tier={badge.tier}
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
                          className="h-5 border-green-200 bg-green-500/10 text-[10px] text-green-700"
                        >
                          已解锁
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 text-[10px]">
                          未解锁
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-6">
          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">主页说明</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">这是对外公开的个人主页</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              这里主要展示这个用户已发布的项目和已解锁徽章，不直接承担完整账号设置功能。
            </p>
          </section>

          <section className="surface-panel p-5 sm:p-6">
            <p className="section-kicker">加入互动</p>
            <div className="mt-4 space-y-3">
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                先通过主页了解对方做过什么项目，再决定是否关注。
              </div>
              <div className="surface-subtle px-4 py-3 text-sm leading-6 text-foreground/90">
                如果双方允许私信，可从这里直接进入消息页继续交流。
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
