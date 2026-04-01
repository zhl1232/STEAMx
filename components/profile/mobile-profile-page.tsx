"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenBox } from "lucide-react";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProjectList } from "@/components/profile/project-list";
import { SteamRadarChart } from "@/components/features/profile/steam-radar-chart";
import { Project, Profile, type ObservationEvent } from "@/lib/mappers/types";
import { ProfileObservationsPanel } from "@/components/features/profile/profile-observations-panel";
import { User } from "@supabase/supabase-js";
import type { UserStats } from "@/lib/gamification/types";
import { ProjectListSkeleton } from "@/components/features/profile/project-list-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileProfilePageProps {
  user: User;
  profile: Profile | null;
  myProjects: Project[];
  likedProjectsList: Project[];
  collectedProjectsList: Project[];
  completedProjectsList: Project[];
  completionStatusMap?: Map<number, { status: string; rejectionReason?: string }>;
  followerCount: number;
  followingCount: number;
  userStats?: UserStats | null;
  isProjectsDataLoading?: boolean;
  myObservations?: ObservationEvent[];
  observationsTotal?: number;
  uniqueSpeciesCount?: number;
  isObservationsLoading?: boolean;
  observationsLoaded?: boolean;
  onTabChange?: (value: string) => void;
}

export function MobileProfilePage({
  user,
  profile,
  myProjects,
  likedProjectsList,
  collectedProjectsList,
  completedProjectsList,
  completionStatusMap,
  followerCount,
  followingCount,
  userStats,
  isProjectsDataLoading = false,
  myObservations = [],
  observationsTotal = 0,
  uniqueSpeciesCount = 0,
  isObservationsLoading = false,
  observationsLoaded = false,
  onTabChange,
}: MobileProfilePageProps) {
  const [_activeTab, setActiveTab] = useState("works");

  const myProjectsCount = myProjects.length;
  const likedProjectsCount = likedProjectsList.length;
  const collectedProjectsCount = collectedProjectsList.length;
  const completedProjectsCount = completedProjectsList.length;
  const totalLikesReceived = myProjects.reduce((acc, p) => acc + p.likes, 0);

  if (isProjectsDataLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background pb-24">
        <div className="h-28 bg-muted" />

        <div className="px-4 -mt-10 mb-4">
          <div className="flex gap-5 items-start">
            <Skeleton className="h-24 w-24 rounded-full border-4 border-background" />
            <div className="flex-1 space-y-3 pt-3">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        <div className="px-4 pt-3">
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>

        <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b px-4 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="mb-4 text-sm text-muted-foreground">加载个人主页中...</p>
          <div className="space-y-4">
            <ProjectListSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-24">
      
      <ProfileHeader 
        user={user}
        profile={profile}
        myProjectsCount={myProjectsCount}
        likedProjectsCount={likedProjectsCount}
        collectedProjectsCount={collectedProjectsCount}
        totalLikesReceived={totalLikesReceived}
        followerCount={followerCount}
        followingCount={followingCount}
      />

      {/* STEAM 雷达图 */}
      <div className="px-4 pt-3">
        <SteamRadarChart userId={user?.id} stats={userStats ?? null} />
      </div>

      {/* Tabs Content */}
      <Tabs
        defaultValue="works"
        className="w-full flex-1"
        onValueChange={(v) => {
          setActiveTab(v);
          onTabChange?.(v);
        }}
      >
        <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-sm border-b px-4">
            <TabsList className="w-full h-11 bg-transparent p-0 justify-start gap-4 overflow-x-auto scrollbar-none">
                <TabsTrigger 
                    value="works" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-extrabold data-[state=active]:text-foreground font-medium text-sm shrink-0 transition-all duration-200"
                >
                    作品 <span className="ml-1 text-xs text-muted-foreground font-normal">{myProjectsCount}</span>
                </TabsTrigger>
                <TabsTrigger 
                    value="collected" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-extrabold data-[state=active]:text-foreground font-medium text-sm shrink-0 transition-all duration-200"
                >
                    收藏 <span className="ml-1 text-xs text-muted-foreground font-normal">{collectedProjectsCount}</span>
                </TabsTrigger>
                <TabsTrigger 
                    value="likes" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-extrabold data-[state=active]:text-foreground font-medium text-sm shrink-0 transition-all duration-200"
                >
                    喜欢 <span className="ml-1 text-xs text-muted-foreground font-normal">{likedProjectsCount}</span>
                </TabsTrigger>
                 <TabsTrigger 
                    value="completed" 
                    className="h-full rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-extrabold data-[state=active]:text-foreground font-medium text-sm shrink-0 transition-all duration-200"
                >
                    完成 <span className="ml-1 text-xs text-muted-foreground font-normal">{completedProjectsCount}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="observations"
                  className="h-full rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-extrabold data-[state=active]:text-foreground font-medium text-sm shrink-0 transition-all duration-200"
                >
                  观察{" "}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {observationsLoaded ? observationsTotal : ""}
                  </span>
                </TabsTrigger>
            </TabsList>
        </div>

        <div className="px-4 py-4 min-h-[300px]">
            <TabsContent value="works" className="mt-0 space-y-4">
               <ProjectList 
                  projects={myProjects} 
                  emptyState={{
                      icon: <PenBox className="h-10 w-10" />,
                      title: "暂无作品",
                      desc: "分享你的第一个创意作品",
                      btnText: "去分享",
                      href: "/share"
                  }}
               />
            </TabsContent>
            <TabsContent value="collected" className="mt-0 space-y-4">
                <ProjectList 
                  projects={collectedProjectsList} 
                  emptyState={{
                      title: "暂无收藏",
                      desc: "收藏你喜欢的项目",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
            <TabsContent value="likes" className="mt-0 space-y-4">
                <ProjectList 
                  projects={likedProjectsList} 
                  emptyState={{
                      title: "暂无喜欢",
                      desc: "去发现更多有趣的项目",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
            <TabsContent value="completed" className="mt-0 space-y-4">
                 <ProjectList 
                  projects={completedProjectsList}
                  completionStatusMap={completionStatusMap}
                  emptyState={{
                      title: "暂无完成",
                      desc: "动手完成一个项目吧",
                      btnText: "去探索",
                      href: "/explore"
                  }}
               />
            </TabsContent>
            <TabsContent value="observations" className="mt-0 space-y-4">
              <ProfileObservationsPanel
                observations={myObservations}
                observationsTotal={observationsTotal}
                uniqueSpeciesCount={uniqueSpeciesCount}
                isLoading={isObservationsLoading}
                isLoaded={observationsLoaded}
              />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
