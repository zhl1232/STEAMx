"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { User } from "@supabase/supabase-js";
import { PenBox } from "lucide-react";

import { ProjectListSkeleton } from "@/components/features/profile/project-list-skeleton";
import { ProfileLibrarySkeleton } from "@/components/features/profile/profile-library-skeleton";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProjectList } from "@/components/profile/project-list";
import { WorkCardGrid } from "@/components/features/works/work-card-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { cn } from "@/lib/utils";
import { Project, Profile, type ObservationEvent, type Work } from "@/lib/mappers/types";
import type { NaturalObservationProgressSummary } from "@/lib/observations/progress";
import type { ProfileLibraryTab } from "@/lib/profile/library-tabs";
import type { SteamRadarWithGuidance } from "@/lib/profile/steam-radar";

const ProfileObservationsPanel = dynamic(
  () => import("@/components/features/profile/profile-observations-panel").then((mod) => mod.ProfileObservationsPanel),
  {
    loading: () => (
      <div className="surface-panel px-5 py-5">
        <Skeleton className="h-5 w-28 rounded-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex gap-3 rounded-md border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.72)] p-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-28 rounded-full" />
                <Skeleton className="mt-2 h-3 w-full rounded-full" />
                <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
);

const SteamRadarChart = dynamic(
  () => import("@/components/features/profile/steam-radar-chart").then((mod) => mod.SteamRadarChart),
  {
    loading: () => (
      <div className="surface-panel min-h-[320px] rounded-xl p-5">
        <Skeleton className="h-5 w-28 rounded-full" />
        <div className="mt-6 flex justify-center">
          <Skeleton className="h-[214px] w-[214px] rounded-full" />
        </div>
      </div>
    ),
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
  worksList: Work[];
  exploringProjectsList?: Project[];
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
  naturalObservationProgress?: NaturalObservationProgressSummary | null;
  isObservationsLoading?: boolean;
  observationsLoaded?: boolean;
  onTabChange?: (value: ProfileLibraryTab) => void;
  showProfileHeader?: boolean;
  showSteamRadar?: boolean;
  pageTitle?: string;
  backHref?: string;
  initialTab?: ProfileLibraryTab;
}

const PROFILE_TABS = [
  { value: "works", label: "我的作品" },
  { value: "published", label: "发布的项目" },
  { value: "exploring", label: "探索中" },
  { value: "observations", label: "观察记录" },
  { value: "collected", label: "收藏" },
  { value: "likes", label: "点赞" },
] as const;

export function MobileProfilePage({
  user,
  profile,
  myProjects,
  myProjectsTotalCount,
  totalLikesReceived,
  likedProjectsList,
  collectedProjectsList,
  worksList,
  exploringProjectsList = [],
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
  naturalObservationProgress = null,
  isObservationsLoading = false,
  observationsLoaded = false,
  onTabChange,
  showProfileHeader = true,
  showSteamRadar = true,
  pageTitle,
  backHref = "/profile",
  initialTab = "exploring",
}: MobileProfilePageProps) {
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]["value"]>(initialTab);
  const [visibleWorksCount, setVisibleWorksCount] = useState(6);

  const myProjectsCount = myProjectsTotalCount;

  const visibleMyProjects = myProjects.slice(0, visibleWorksCount);
  const hasMoreWorks = myProjectsTotalCount > visibleWorksCount;

  const tabCounts = useMemo(
    () => ({
      works: completedProjectsCount,
      published: myProjectsCount,
      collected: collectedProjectsCount,
      likes: likedProjectsCount,
      exploring: exploringProjectsList.length,
      observations: observationsLoaded ? observationsTotal : null,
    }),
    [
      myProjectsCount,
      collectedProjectsCount,
      likedProjectsCount,
      completedProjectsCount,
      exploringProjectsList.length,
      observationsLoaded,
      observationsTotal,
    ],
  );

  useEffect(() => {
    setVisibleWorksCount(6);
  }, [user.id]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (isProjectsDataLoading) {
    if (!showProfileHeader) {
      return <ProfileLibrarySkeleton />;
    }

    return (
      <div className="flex min-h-screen flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
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
                  <Skeleton key={index} className="h-16 rounded-md" />
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
          <Skeleton className="h-72 w-full rounded-xl" />
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
    <div className="flex min-h-screen flex-col bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
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
        <>
          <MobilePageHeader title={pageTitle} fallbackHref={backHref} />
          <section className="px-4 pt-4">
            <div className="surface-panel relative overflow-hidden p-4">
              <Image
                src="/assets/profile-library-soft-blue-hero.png"
                alt=""
                fill
                className="object-cover opacity-42 dark:opacity-22"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-linear-to-r from-background/92 via-background/74 to-background/18" />
              <div className="relative">
                <p className="section-kicker">内容库</p>

                <div className="mt-10 grid grid-cols-4 gap-2">
                  {[
                    ["我的作品", completedProjectsCount],
                    ["发布项目", myProjectsCount],
                    ["收藏", collectedProjectsCount],
                    ["观察", observationsLoaded ? observationsTotal : uniqueSpeciesCount],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md border border-border/70 bg-background/76 px-2 py-2 text-center backdrop-blur-sm">
                      <p className="text-base font-semibold tabular-nums">{value}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div className={cn("mobile-subnav top-0 z-20", showProfileHeader ? "mt-4" : pageTitle ? "mt-4" : "")}>
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
                  <span>{tab.label}</span>
                  {typeof tabCounts[tab.value] === "number" ? (
                    <span className={cn(
                      "ml-1.5 min-w-5 rounded-full px-1.5 text-[10px] font-semibold leading-5",
                      activeTab === tab.value
                        ? "bg-background/20 text-current"
                        : "bg-background/80 text-muted-foreground",
                    )}>
                      {tabCounts[tab.value]?.toLocaleString()}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {activeTab === "works" ? (
          worksList.length > 0 ? (
            <WorkCardGrid works={worksList} />
          ) : (
            <div className="surface-subtle px-5 py-10 text-center">
              <h3 className="text-base font-semibold">暂无作品</h3>
              <p className="mt-2 text-sm text-muted-foreground">课程、项目、挑战和自然观察的成果都会汇总到这里。</p>
            </div>
          )
        ) : null}

        {activeTab === "published" ? (
          <>
            <ProjectList
              projects={visibleMyProjects}
              emptyState={{
                icon: <PenBox className="h-10 w-10" />,
                title: "还没有发布项目",
                desc: "把你的第一个项目整理出来",
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
                  className="h-10 rounded-full border border-border/80 bg-background/80 px-5 text-sm font-medium transition-colors hover:bg-muted"
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

        {activeTab === "exploring" ? (
          <ProjectList
            projects={exploringProjectsList}
            projectHref={(id) => `/project/${id}/records`}
            emptyState={{
              title: "暂无探索中",
              desc: "在项目详情点击「开始探索」",
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
            naturalObservationProgress={naturalObservationProgress}
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
