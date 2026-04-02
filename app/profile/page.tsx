'use client'
import Link from 'next/link'
import { useAuth } from '@/context/auth-context'
import { useProjects } from '@/context/project-context'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { ProjectListSkeleton } from '@/components/features/profile/project-list-skeleton'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Zap, Coins } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useGamification, BADGES } from '@/context/gamification-context'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { createClient } from '@/lib/supabase/client'

import type { Project } from '@/lib/types'
import { mapProject, type DbProject } from '@/lib/mappers/project'
import { MobileProfilePage } from '@/components/profile/mobile-profile-page'
import React from 'react'
import { BadgeIcon } from "@/components/features/gamification/badge-icon"
import { cn } from '@/lib/utils'
import { getNameColorClassName } from '@/lib/shop/items'
import { getDisplayName } from '@/lib/utils/user'
import { logger } from '@/lib/logger'
import { useProfileObservations } from '@/hooks/profile/use-profile-observations'
import { ProfileObservationsPanel } from '@/components/features/profile/profile-observations-panel'
import { useToast } from '@/hooks/use-toast'
import { useGamificationData } from "@/hooks/gamification/use-gamification-data"
import { SteamRadarChart } from "@/components/features/profile/steam-radar-chart"
import { getLatestCompletionStatusMap } from '@/lib/completion-records'
import { RoleBadge } from '@/components/ui/role-badge'

function throwIfSupabaseError(
  result: { error: { message?: string | null } | null },
  label: string,
) {
  if (!result.error) return
  const detail = result.error.message ? `：${result.error.message}` : ''
  throw new Error(`${label}加载失败${detail}`)
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const { likedProjects, collectedProjects, isLoading: projectsLoading } = useProjects()
  const [activeTab, setActiveTab] = useState<'my-projects' | 'liked' | 'collected' | 'completed' | 'observations'>('my-projects')
  const [mobileProfileTab, setMobileProfileTab] = useState<string>('works')
  const { unlockedBadges, userBadgeDetails, coins } = useGamification()
  const { userStats } = useGamificationData()
  const supabase = useMemo(() => createClient(), [])

  // 独立加载的项目列表
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [likedProjectsList, setLikedProjectsList] = useState<Project[]>([])
  const [collectedProjectsList, setCollectedProjectsList] = useState<Project[]>([])
  const [completedProjectsList, setCompletedProjectsList] = useState<Project[]>([])
  const [completionStatusMap, setCompletionStatusMap] = useState<Map<number, { status: string; rejectionReason?: string }>>(new Map())
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isProjectsDataLoading, setIsProjectsDataLoading] = useState(true)
  const {
    myObservations,
    observationsTotal,
    uniqueSpeciesCount,
    isObservationsLoading,
    observationsLoaded,
  } = useProfileObservations(
    activeTab === 'observations' || mobileProfileTab === 'observations',
    user?.id,
  )

  const likedProjectIds = React.useMemo(
    () => Array.from(likedProjects).map((id) => Number(id)).sort((a, b) => a - b),
    [likedProjects]
  )
  const collectedProjectIds = React.useMemo(
    () => Array.from(collectedProjects).map((id) => Number(id)).sort((a, b) => a - b),
    [collectedProjects]
  )
  // 加载用户的项目数据
  useEffect(() => {
    // Wait for both user authentication and project context (interactions) to be ready
    if (!user || projectsLoading) return

    setIsProjectsDataLoading(true)
    let cancelled = false

    const loadUserProjects = async () => {
      try {
        // 并行执行所有查询，提升性能
        const [myProjectsResponse, likedResponse, collectedResponse, followersResponse, followingResponse, completionStatusResponse] = await Promise.all([
          // 查询用户发布的项目
          supabase
            .from('projects')
            .select('*')
            .eq('author_id', user.id)
            .order('created_at', { ascending: false }),

          // 查询用户点赞的项目
          likedProjectIds.length > 0
            ? supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', likedProjectIds)
              .order('created_at', { ascending: false })
            : Promise.resolve({ data: null, error: null }),

          // 查询用户收藏的项目
          collectedProjectIds.length > 0
            ? supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', collectedProjectIds)
              .order('created_at', { ascending: false })
            : Promise.resolve({ data: null, error: null }),

          // 查询粉丝数
          supabase
            .from('follows')
            .select('follower_id', { count: 'exact', head: true })
            .eq('following_id', user.id),

          // 查询关注数
          supabase
            .from('follows')
            .select('following_id', { count: 'exact', head: true })
            .eq('follower_id', user.id),

          // 查询用户完成记录的审核状态（按时间倒序，同一项目取最新记录）
          supabase
            .from('completed_projects')
            .select('project_id, status, rejection_reason, completed_at')
            .eq('user_id', user.id)
            .order('completed_at', { ascending: false })
        ])

        throwIfSupabaseError(myProjectsResponse, '我的项目')
        throwIfSupabaseError(likedResponse, '点赞项目')
        throwIfSupabaseError(collectedResponse, '收藏项目')
        throwIfSupabaseError(followersResponse, '粉丝数据')
        throwIfSupabaseError(followingResponse, '关注数据')
        throwIfSupabaseError(completionStatusResponse, '完成记录')

        if (cancelled) return

        const myProjectsData = myProjectsResponse.data as DbProject[] | null
        const likedData = likedResponse.data as DbProject[] | null
        const collectedData = collectedResponse.data as DbProject[] | null
        const completionStatusData = completionStatusResponse.data as {
          project_id: number
          status?: string | null
          rejection_reason?: string | null
        }[] | null

        // 使用统一的映射函数处理数据
        if (myProjectsData) {
          setMyProjects(myProjectsData.map(p => mapProject(p as DbProject, profile?.display_name || undefined)))
        }

        setFollowerCount(followersResponse.count || 0)
        setFollowingCount(followingResponse.count || 0)

        if (likedData) {
          setLikedProjectsList(likedData.map((p) => mapProject(p as DbProject)))
        } else {
          setLikedProjectsList([])
        }

        if (collectedData) {
          setCollectedProjectsList(collectedData.map((p) => mapProject(p as DbProject)))
        } else {
          setCollectedProjectsList([])
        }

        if (completionStatusData) {
          const statusMap = getLatestCompletionStatusMap(completionStatusData)
          setCompletionStatusMap(statusMap)

          const completedProjectIds = Array.from(statusMap.keys())
          if (completedProjectIds.length > 0) {
            const completedProjectsResponse = await supabase
              .from('projects')
              .select(`
                  *,
                  profiles:author_id (display_name)
                `)
              .in('id', completedProjectIds)

            throwIfSupabaseError(completedProjectsResponse, '已完成项目')

            if (cancelled) return

            const completedData = completedProjectsResponse.data as DbProject[] | null
            const projectMap = new Map(
              (completedData || []).map((project) => [Number(project.id), project])
            )
            setCompletedProjectsList(
              completedProjectIds
                .map((projectId) => projectMap.get(projectId))
                .filter((project): project is DbProject => Boolean(project))
                .map((project) => mapProject(project))
            )
          } else {
            setCompletedProjectsList([])
          }
        } else {
          setCompletionStatusMap(new Map())
          setCompletedProjectsList([])
        }
      } catch (err) {
        if (cancelled) return
        logger.error('Exception in loadUserProjects', { error: err })
        toast({ title: '加载失败', description: '无法加载个人资料数据，请稍后重试', variant: 'destructive' })
      } finally {
        if (!cancelled) {
          setIsProjectsDataLoading(false)
        }
      }
    }

    loadUserProjects()

    return () => {
      cancelled = true
    }
  }, [
    user,
    supabase,
    likedProjectIds,
    collectedProjectIds,
    profile?.display_name,
    projectsLoading,
    toast,
  ])


  if (authLoading) {
    return <ProfileSkeleton />
  }

  if (!user) {
    return null
  }

  // 获取用户信息
  const userName = getDisplayName({
    profileName: profile?.display_name,
    metadataFullName: user.user_metadata?.full_name,
    metadataName: user.user_metadata?.name,
    phone: user.phone ?? null,
    email: user.email,
    fallback: '未命名用户',
  })
  const userAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null
  const level = Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1
  const totalLikesReceived = myProjects.reduce((acc, project) => acc + project.likes, 0)
  const featuredBadges =
    unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 5) : BADGES.slice(0, 5)
  const desktopQuickFacts = [
    { label: '收藏', value: collectedProjects.size },
    { label: '喜欢', value: likedProjects.size },
    { label: '完成', value: completionStatusMap.size },
    ...(observationsLoaded ? [{ label: '观察', value: observationsTotal }] : []),
  ]
  const desktopStats = [
    { label: '作品', value: myProjects.length },
    { label: '粉丝', value: followerCount },
    { label: '关注', value: followingCount },
    { label: '获赞', value: totalLikesReceived },
  ]
  const desktopTabs = [
    { key: 'my-projects' as const, label: '发布', count: myProjects.length },
    { key: 'collected' as const, label: '收藏', count: collectedProjects.size },
    { key: 'liked' as const, label: '喜欢', count: likedProjects.size },
    { key: 'completed' as const, label: '完成', count: completionStatusMap.size },
    {
      key: 'observations' as const,
      label: '观察',
      count: observationsLoaded ? observationsTotal : null,
    },
  ]
  const showDesktopProjectSkeleton =
    (isProjectsDataLoading && activeTab === 'my-projects') ||
    (activeTab === 'collected' && collectedProjects.size > 0 && collectedProjectsList.length === 0) ||
    (activeTab === 'liked' && likedProjects.size > 0 && likedProjectsList.length === 0) ||
    (activeTab === 'completed' && isProjectsDataLoading)


  return (
    <>
      <div className="md:hidden">
        <MobileProfilePage
          user={user}
          profile={profile}
          myProjects={myProjects}
          likedProjectsList={likedProjectsList}
          collectedProjectsList={collectedProjectsList}
          completedProjectsList={completedProjectsList}
          completionStatusMap={completionStatusMap}
          followerCount={followerCount}
          followingCount={followingCount}
          userStats={userStats}
          isProjectsDataLoading={isProjectsDataLoading}
          myObservations={myObservations}
          observationsTotal={observationsTotal}
          uniqueSpeciesCount={uniqueSpeciesCount}
          isObservationsLoading={isObservationsLoading}
          observationsLoaded={observationsLoaded}
          onTabChange={setMobileProfileTab}
        />
      </div>

      <div className="page-shell hidden py-8 md:block">
        <div className="space-y-6">
          <section className="surface-panel overflow-hidden">
            <div className="bg-gradient-to-r from-background/95 via-background/90 to-primary/[0.08] px-6 py-7 sm:px-7 sm:py-8 lg:px-8">
              <p className="section-kicker">我的主页</p>
              <div className="mt-4 flex flex-col gap-6 xl:flex-row xl:items-center">
                <div className="relative mx-auto shrink-0 xl:mx-0">
                  <AvatarWithFrame
                    src={userAvatar}
                    alt={userName}
                    fallback={userName[0]?.toUpperCase()}
                    avatarFrameId={profile?.equipped_avatar_frame_id}
                    className="h-28 w-28 shrink-0 border-4 border-background shadow-[0_24px_60px_-34px_rgba(15,23,42,0.38)] md:h-32 md:w-32"
                    avatarClassName="rounded-full object-cover"
                  />
                  <LevelGuideDialog>
                    <button
                      type="button"
                      className="absolute -bottom-2 -right-1 inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/92 px-3 py-1 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-background"
                    >
                      <Zap className="h-3.5 w-3.5 text-primary" />
                      Lv.{level}
                    </button>
                  </LevelGuideDialog>
                </div>

                <div className="min-w-0 flex-1 space-y-5">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {profile?.role && profile.role !== 'user' ? <RoleBadge role={profile.role} size="md" /> : null}
                        <h1
                          className={cn(
                            "text-3xl font-semibold tracking-tight",
                            getNameColorClassName(profile?.equipped_name_color_id ?? null) || "text-foreground",
                          )}
                        >
                          {userName}
                        </h1>
                      </div>

                      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                        {profile?.bio || "在这里整理你的作品、收藏、完成记录和自然观察，把个人主页真正养起来。"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" className="h-11 rounded-2xl px-5 text-sm font-semibold">
                        <Link href="/coins">
                          <Coins className="mr-2 h-4 w-4 text-primary" />
                          我的硬币 {coins.toLocaleString()}
                        </Link>
                      </Button>
                      <EditProfileDialog>
                        <Button variant="outline" className="h-11 rounded-2xl px-5 text-sm font-semibold">
                          编辑资料
                        </Button>
                      </EditProfileDialog>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {desktopQuickFacts.map((fact) => (
                      <span
                        key={fact.label}
                        className="inline-flex items-center rounded-full border border-border/70 bg-background/78 px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        {fact.label}
                        <span className="ml-1.5 font-semibold text-foreground">{fact.value}</span>
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {desktopStats.map((stat) => (
                      <div key={stat.label} className="surface-subtle px-4 py-4 text-center md:text-left">
                        <div className="text-lg font-semibold tabular-nums text-foreground">{stat.value}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_340px]">
            <div className="min-w-0">
              <section className="surface-panel overflow-hidden">
                <div className="border-b border-border/60 px-6 py-5">
                  <p className="section-kicker">内容归档</p>
                  <div className="mt-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">先看内容，再看成长面板</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      把最常用的作品、收藏、完成和观察入口放到主列，减少切页后的视线跳动。
                    </p>
                  </div>

                  <div className="mt-4 -mx-1 overflow-x-auto px-1 no-scrollbar">
                    <div className="segmented-control inline-flex min-w-max gap-1">
                      {desktopTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={cn("segmented-option shrink-0 gap-2 whitespace-nowrap", activeTab === tab.key && "segmented-option-active")}
                        >
                          <span>{tab.label}</span>
                          {tab.count !== null ? <span className="text-xs opacity-75">{tab.count}</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {showDesktopProjectSkeleton ? (
                      <ProjectListSkeleton />
                    ) : (
                      <>
                        {activeTab === 'my-projects' && myProjects.length === 0 ? (
                          <DesktopProfileEmptyState
                            title="还没有发布作品"
                            description="把你的第一个项目整理出来，让个人主页真正开始生长。"
                            href="/share"
                            actionLabel="去分享"
                          />
                        ) : null}
                        {activeTab === 'my-projects' &&
                          myProjects.map((project) => <ProjectCard key={project.id} project={project} showStatus={true} />)}

                        {activeTab === 'collected' && collectedProjectsList.length === 0 ? (
                          <DesktopProfileEmptyState
                            title="还没有收藏项目"
                            description="去探索页面保存感兴趣的项目，后续回看会更方便。"
                            href="/explore"
                            actionLabel="去探索"
                          />
                        ) : null}
                        {activeTab === 'collected' &&
                          collectedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

                        {activeTab === 'liked' && likedProjectsList.length === 0 ? (
                          <DesktopProfileEmptyState
                            title="还没有喜欢记录"
                            description="去发现更多有趣项目，给你真正认可的作品点个喜欢。"
                            href="/explore"
                            actionLabel="去探索"
                          />
                        ) : null}
                        {activeTab === 'liked' &&
                          likedProjectsList.map((project) => <ProjectCard key={project.id} project={project} />)}

                        {activeTab === 'completed' && completedProjectsList.length === 0 ? (
                          <DesktopProfileEmptyState
                            title="还没有完成项目"
                            description="从一个小项目开始，把完成记录慢慢积累起来。"
                            href="/explore"
                            actionLabel="开始项目"
                          />
                        ) : null}
                        {activeTab === 'completed' &&
                          completedProjectsList.map((project) => {
                            const completionStatus = completionStatusMap.get(Number(project.id))
                            return (
                              <div key={project.id} className="relative">
                                {completionStatus?.status === 'pending' ? (
                                  <div className="absolute left-2 top-2 z-10">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300 bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800 shadow-sm dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                      作品待审核
                                    </span>
                                  </div>
                                ) : null}
                                {completionStatus?.status === 'rejected' ? (
                                  <div className="absolute left-2 top-2 z-10">
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      title={completionStatus.rejectionReason}
                                    >
                                      作品未通过
                                    </span>
                                  </div>
                                ) : null}
                                <ProjectCard project={project} />
                              </div>
                            )
                          })}

                        {activeTab === 'observations' ? (
                          <ProfileObservationsPanel
                            observations={myObservations}
                            observationsTotal={observationsTotal}
                            uniqueSpeciesCount={uniqueSpeciesCount}
                            isLoading={isObservationsLoading}
                            isLoaded={observationsLoaded}
                          />
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <aside className="self-start space-y-6 xl:sticky xl:top-24">
              <section className="surface-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-kicker">成长进度</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">当前等级与经验</h2>
                  </div>
                  <LevelGuideDialog>
                    <button className="text-sm text-primary transition-colors hover:text-primary/80 hover:underline">
                      如何升级
                    </button>
                  </LevelGuideDialog>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  成长面板保留在辅助列里，方便查看，但不会再压过主要内容入口。
                </p>
                <div className="mt-6">
                  <LevelProgress className="w-full" />
                </div>
              </section>

              <section className="surface-panel p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="section-kicker">成就陈列</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">最近展示的徽章</h2>
                  </div>
                  <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
                    <button type="button" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
                      查看全部
                    </button>
                  </BadgeGalleryDialog>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
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

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  保持稳定产出和完成记录，个人主页的成就感会自然往上长。
                </p>
              </section>

              <SteamRadarChart userId={user.id} stats={userStats ?? null} />
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}

function DesktopProfileEmptyState({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string
  description: string
  href: string
  actionLabel: string
}) {
  return (
    <div className="surface-subtle col-span-full px-6 py-12 text-center">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild className="mt-6">
        <Link href={href}>{actionLabel}</Link>
      </Button>
    </div>
  )
}
