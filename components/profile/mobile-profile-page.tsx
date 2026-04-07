"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { PenBox } from "lucide-react";

import { ProjectListSkeleton } from "@/components/features/profile/project-list-skeleton";
import { ProfileLibrarySkeleton } from "@/components/features/profile/profile-library-skeleton";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProjectList } from "@/components/profile/project-list";
import { Skeleton } from "@/components/ui/skeleton";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";
import { Project, Profile, type ObservationEvent } from "@/lib/mappers/types";
import type { SteamRadarWithGuidance } from "@/lib/profile/steam-radar";

const ProfileObservationsPanel = dynamic(
  () => import("@/components/features/profile/profile-observations-panel").then((mod) => mod.ProfileObservationsPanel),
  {
    loading: () => (
      <div className="surface-panel px-5 py-12 text-center text-sm text-muted-foreground">
        加载观察记录中...
      </div>
    ),
  },
);

const SteamRadarChart = dynamic(
  () => import("@/components/features/profile/steam-radar-chart").then((mod) => mod.SteamRadarChart),
  {
    loading: () => <div className="surface-panel min-h-[320px] rounded-[28px]" />,
  },
);

interface MobileProfilePageProps {
  user: User;
  profile: Profile | null;
  myProjects: Project[];
  myProjectsTotalCount: number;
  totalLikesReceived: number;
  likedProjectsList: Project[];
  collectedProjectsList: Project[];
  completedProjectsList: Project[];
  completionStatusMap?: Map<number, { status: string; rejectionReason?: string }>;
  followerCount: number;
  followingCount: number;
  likedProjectsCount: number;
  collectedProjectsCount: number;
  completedProjectsCount: number;
  steamRadar?: SteamRadarWithGuidance | null;
  isProjectsDataLoading?: boolean;
  isLoadingMoreMyProjects?: boolean;
  onLoadMoreMyProjects?: () => Promise<boolean> | boolean;
  myObservations?: ObservationEvent[];
  observationsTotal?: number;
  uniqueSpeciesCount?: number;
  isObservationsLoading?: boolean;
  observationsLoaded?: boolean;
  onTabChange?: (value: string) => void;
  showProfileHeader?: boolean;
  showSteamRadar?: boolean;
  pageTitle?: string;
  backHref?: string;
}

const PROFILE_TABS = [
  { value: "works", label: "作品" },
  { value: "collected", label: "收藏" },
  { value: "likes", label: "点赞" },
  { value: "completed", label: "已完成" },
  { value: "observations", label: "观察记录" },
] as const;

export function MobileProfilePage({
  user,
  profile,
  myProjects,
  myProjectsTotalCount,
  totalLikesReceived,
  likedProjectsList,
  collectedProjectsList,
  completedProjectsList,
  completionStatusMap,
  followerCount,
  followingCount,
  likedProjectsCount,
  collectedProjectsCount,
  completedProjectsCount,
  steamRadar = null,
  isProjectsDataLoading = false,
  isLoadingMoreMyProjects = false,
  onLoadMoreMyProjects,
  myObservations = [],
  observationsTotal = 0,
  uniqueSpeciesCount = 0,
  isObservationsLoading = false,
  observationsLoaded = false,
  onTabChange,
  showProfileHeader = true,
  showSteamRadar = true,
  pageTitle,
  backHref = "/profile",
}: MobileProfilePageProps) {
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]["value"]>("works");
  const [visibleWorksCount, setVisibleWorksCount] = useState(6);

  const myProjectsCount = myProjectsTotalCount;
  const visibleMyProjects = myProjects.slice(0, visibleWorksCount);
  const hasMoreWorks = myProjectsTotalCount > visibleWorksCount;

  const tabCounts = useMemo(
    () => ({
      works: myProjectsCount,
      collected: collectedProjectsCount,
      likes: likedProjectsCount,
      completed: completedProjectsCount,
      observations: observationsLoaded ? observationsTotal : null,
    }),
    [
      myProjectsCount,
      collectedProjectsCount,
      likedProjectsCount,
      completedProjectsCount,
      observationsLoaded,
      observationsTotal,
    ],
  );

  useEffect(() => {
    setVisibleWorksCount(6);
  }, [user.id]);

  if (isProjectsDataLoading) {
    if (!showProfileHeader) {
      return <ProfileLibrarySkeleton />;
    }

    return (
      <div className="flex min-h-screen flex-col bg-background pb-24">
        <div className="px-4 pt-4">
          <div className="surface-panel overflow-hidden">
            <div className="h-36 bg-muted/70" />
            <div className="space-y-4 px-4 py-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 rounded-full border-4 border-background" />
                <div className="flex-1 space-y-3 pt-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mobile-subnav top-0 z-20 mt-4">
          <div className="px-4 py-3">
            <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
              <div className="segmented-control inline-flex min-w-max gap-1">
                {PROFILE_TABS.map((tab) => (
                  <Skeleton key={tab.value} className="h-10 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="sr-only">加载个人主页中...</p>
          <div className="space-y-4">
            <ProjectListSkeleton />
          </div>
        </div>

        <div className="px-4 pb-4">
          <Skeleton className="h-72 w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  const handleTabChange = (value: (typeof PROFILE_TABS)[number]["value"]) => {
    setActiveTab(value);
    onTabChange?.(value);
  };

  const handleLoadMoreWorks = async () => {
    if (visibleWorksCount < myProjects.length) {
      setVisibleWorksCount((count) => Math.min(count + 6, myProjects.length));
      return;
    }

    const didLoadMore = await onLoadMoreMyProjects?.();
    if (didLoadMore) {
      setVisibleWorksCount((count) => count + 6);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {showProfileHeader ? (
        <div className="px-4 pt-4">
          <ProfileHeader
            user={user}
            profile={profile}
            myProjectsCount={myProjectsCount}
            totalLikesReceived={totalLikesReceived}
            followerCount={followerCount}
            followingCount={followingCount}
          />
        </div>
      ) : pageTitle ? (
        <MobilePageHeader title={pageTitle} fallbackHref={backHref} />
      ) : null}

      <div className={cn("mobile-subnav top-0 z-20", showProfileHeader ? "mt-4" : "")}>
        <div className="px-4 py-3">
          <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
            <div className="segmented-control inline-flex min-w-max gap-1">
              {PROFILE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleTabChange(tab.value)}
                  className={cn(
                    "segmented-option shrink-0 whitespace-nowrap px-4",
                    activeTab === tab.value && "segmented-option-active",
                  )}
                >
                  <span>
                    {tab.label}
                    {tabCounts[tab.value] !== null ? (
                      <span className="ml-1.5 text-[11px] opacity-75">{tabCounts[tab.value]}</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {activeTab === "works" ? (
          <>
            <ProjectList
              projects={visibleMyProjects}
              emptyState={{
                icon: <PenBox className="h-10 w-10" />,
                title: "暂无作品",
                desc: "分享你的第一个创意作品",
                btnText: "去分享",
                href: "/share",
              }}
            />
            {hasMoreWorks ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleLoadMoreWorks()}
                  disabled={isLoadingMoreMyProjects}
                  className="rounded-full border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {isLoadingMoreMyProjects ? "加载中..." : "加载更多作品"}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === "collected" ? (
          <ProjectList
            projects={collectedProjectsList}
            emptyState={{
              title: "暂无收藏",
              desc: "收藏你喜欢的项目",
              btnText: "去探索",
              href: "/explore",
            }}
          />
        ) : null}

        {activeTab === "likes" ? (
          <ProjectList
            projects={likedProjectsList}
            emptyState={{
              title: "暂无喜欢",
              desc: "去发现更多有趣的项目",
              btnText: "去探索",
              href: "/explore",
            }}
          />
        ) : null}

        {activeTab === "completed" ? (
          <ProjectList
            projects={completedProjectsList}
            completionStatusMap={completionStatusMap}
            emptyState={{
              title: "暂无完成",
              desc: "动手完成一个项目吧",
              btnText: "去探索",
              href: "/explore",
            }}
          />
        ) : null}

        {activeTab === "observations" ? (
          <ProfileObservationsPanel
            observations={myObservations}
            observationsTotal={observationsTotal}
            uniqueSpeciesCount={uniqueSpeciesCount}
            isLoading={isObservationsLoading}
            isLoaded={observationsLoaded}
          />
        ) : null}

        {showSteamRadar && steamRadar ? (
          <div className="mt-6">
            <SteamRadarChart userId={user?.id} initialRadar={steamRadar} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
