'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useAuth } from '@/lib/context/auth-context'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/features/project-card'
import { ProfileLibrarySkeleton } from '@/components/features/profile/profile-library-skeleton'
import { ProjectListSkeleton } from '@/components/features/profile/project-list-skeleton'
import { CheckCircle2, ChevronLeft, Feather, FolderOpen, Heart, Rocket } from 'lucide-react'
import { useState, useEffect, useEffectEvent } from 'react'
import { useProfileSummary } from '@/hooks/profile/use-profile-summary'

import type { Project } from '@/lib/mappers/types'
import { MobileProfilePage } from '@/components/profile/mobile-profile-page'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'
import { useProfileObservations } from '@/hooks/profile/use-profile-observations'
import { useToast } from '@/hooks/use-toast'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

const ProfileObservationsPanel = dynamic(
  () => import('@/components/features/profile/profile-observations-panel').then((mod) => mod.ProfileObservationsPanel),
  {
    loading: () => (
      <div className="surface-panel col-span-full px-5 py-12 text-center text-sm text-muted-foreground">
        加载观察记录中...
      </div>
    ),
  },
)

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function ProfileLibraryPage() {
  const WORKS_PAGE_SIZE = 8
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<
    'my-projects' | 'liked' | 'collected' | 'completed' | 'exploring' | 'observations'
  >('my-projects')
  const [mobileProfileTab, setMobileProfileTab] = useState<string>('works')
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null)
  const [visibleDesktopWorksCount, setVisibleDesktopWorksCount] = useState(WORKS_PAGE_SIZE)

  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [myProjectsTotalCount, setMyProjectsTotalCount] = useState(0)
  const [likedProjectsList, setLikedProjectsList] = useState<Project[]>([])
  const [collectedProjectsList, setCollectedProjectsList] = useState<Project[]>([])
  const [completedProjectsList, setCompletedProjectsList] = useState<Project[]>([])
  const [exploringProjectsList, setExploringProjectsList] = useState<Project[]>([])
  const [completionStatusMap, setCompletionStatusMap] = useState<Map<number, { status: string; rejectionReason?: string }>>(new Map())
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [likedProjectsCount, setLikedProjectsCount] = useState(0)
  const [collectedProjectsCount, setCollectedProjectsCount] = useState(0)
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0)
  const [totalLikesReceived, setTotalLikesReceived] = useState(0)
  const [steamRadar, setSteamRadar] = useState<SteamRadarWithGuidance | null>(null)
  const {
    data: profileSummary,
    isLoading: isProfileSummaryLoading,
    isError: isProfileSummaryError,
    error: profileSummaryError,
  } = useProfileSummary(user?.id)
  const isProjectsDataLoading = isProfileSummaryLoading
  const [isLoadingMoreMyProjects, setIsLoadingMoreMyProjects] = useState(false)
  const [isLikedProjectsLoading, setIsLikedProjectsLoading] = useState(false)
  const [isCollectedProjectsLoading, setIsCollectedProjectsLoading] = useState(false)
  const [isCompletedProjectsLoading, setIsCompletedProjectsLoading] = useState(false)
  const [likedProjectsLoaded, setLikedProjectsLoaded] = useState(false)
  const [collectedProjectsLoaded, setCollectedProjectsLoaded] = useState(false)
  const [completedProjectsLoaded, setCompletedProjectsLoaded] = useState(false)
  const [exploringProjectsLoaded, setExploringProjectsLoaded] = useState(false)
  const [isExploringProjectsLoading, setIsExploringProjectsLoading] = useState(false)
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
  const shouldLoadLikedProjects = activeTab === 'liked' || mobileProfileTab === 'likes'
  const shouldLoadCollectedProjects = activeTab === 'collected' || mobileProfileTab === 'collected'
  const shouldLoadCompletedProjects = activeTab === 'completed' || mobileProfileTab === 'completed'
  const shouldLoadExploringProjects = activeTab === 'exploring' || mobileProfileTab === 'exploring'
  const showLoadError = useEffectEvent((description: string) => {
    toast({
      title: '加载失败',
      description,
      variant: 'destructive',
    })
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  useEffect(() => {
    if (!profileSummary) return

    setMyProjects(profileSummary.myProjects)
    setMyProjectsTotalCount(profileSummary.myProjectsTotalCount)
    setFollowerCount(profileSummary.followerCount)
    setFollowingCount(profileSummary.followingCount)
    setLikedProjectsCount(profileSummary.likedProjectsCount)
    setCollectedProjectsCount(profileSummary.collectedProjectsCount)
    setCompletedProjectsCount(profileSummary.completedProjectsCount)
    setTotalLikesReceived(profileSummary.totalLikesReceived)
    setSteamRadar(profileSummary.steamRadar)
    setLikedProjectsList([])
    setCollectedProjectsList([])
    setCompletedProjectsList([])
    setCompletionStatusMap(new Map())
    setLikedProjectsLoaded(false)
    setCollectedProjectsLoaded(false)
    setCompletedProjectsLoaded(false)
    setExploringProjectsLoaded(false)
    setExploringProjectsList([])
  }, [profileSummary])

  useEffect(() => {
    if (!isProfileSummaryError) return
    logger.error('Exception in loadProfileSummary', { error: profileSummaryError })
    showLoadError(getErrorMessage(profileSummaryError, '无法加载个人资料数据，请稍后重试'))
  }, [isProfileSummaryError, profileSummaryError, showLoadError])

  useEffect(() => {
    setVisibleDesktopWorksCount(WORKS_PAGE_SIZE)
  }, [user?.id])

  const loadMoreMyProjects = async () => {
    if (!user?.id || isLoadingMoreMyProjects || myProjects.length >= myProjectsTotalCount) return false

    const nextPage = Math.floor(myProjects.length / WORKS_PAGE_SIZE) + 1
    setIsLoadingMoreMyProjects(true)

    try {
      const response = await fetch(`/api/profile/projects?type=my-projects&page=${nextPage}&pageSize=${WORKS_PAGE_SIZE}`)
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || '作品加载失败')
      }

      const nextProjects = (payload?.projects as Project[]) || []
      setMyProjects((prev) => [...prev, ...nextProjects])
      setVisibleDesktopWorksCount((count) => count + WORKS_PAGE_SIZE)
      return nextProjects.length > 0
    } catch (err) {
      logger.error('Exception in loadMoreMyProjects', { error: err })
      toast({
        title: '加载失败',
        description: getErrorMessage(err, '无法加载更多作品，请稍后重试'),
        variant: 'destructive',
      })
      return false
    } finally {
      setIsLoadingMoreMyProjects(false)
    }
  }

  useEffect(() => {
    if (!user || isProjectsDataLoading || !shouldLoadLikedProjects || likedProjectsLoaded) return
    if (likedProjectsCount === 0) {
      setLikedProjectsLoaded(true)
      return
    }

    let cancelled = false
    setIsLikedProjectsLoading(true)

    const loadLikedProjects = async () => {
      try {
        const response = await fetch('/api/profile/projects?type=liked')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '点赞项目加载失败')
        }

        if (cancelled) return

        setLikedProjectsList((payload?.projects as Project[]) || [])
        setLikedProjectsLoaded(true)
      } catch (err) {
        if (cancelled) return
        logger.error('Exception in loadLikedProjects', { error: err })
        showLoadError(getErrorMessage(err, '无法加载点赞项目，请稍后重试'))
      } finally {
        if (!cancelled) {
          setIsLikedProjectsLoading(false)
        }
      }
    }

    loadLikedProjects()

    return () => {
      cancelled = true
    }
  }, [
    user,
    likedProjectsCount,
    likedProjectsLoaded,
    isProjectsDataLoading,
    shouldLoadLikedProjects,
  ])

  useEffect(() => {
    if (!user || isProjectsDataLoading || !shouldLoadCollectedProjects || collectedProjectsLoaded) return
    if (collectedProjectsCount === 0) {
      setCollectedProjectsLoaded(true)
      return
    }

    let cancelled = false
    setIsCollectedProjectsLoading(true)

    const loadCollectedProjects = async () => {
      try {
        const response = await fetch('/api/profile/projects?type=collected')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '收藏项目加载失败')
        }

        if (cancelled) return

        setCollectedProjectsList((payload?.projects as Project[]) || [])
        setCollectedProjectsLoaded(true)
      } catch (err) {
        if (cancelled) return
        logger.error('Exception in loadCollectedProjects', { error: err })
        showLoadError(getErrorMessage(err, '无法加载收藏项目，请稍后重试'))
      } finally {
        if (!cancelled) {
          setIsCollectedProjectsLoading(false)
        }
      }
    }

    loadCollectedProjects()

    return () => {
      cancelled = true
    }
  }, [
    user,
    collectedProjectsCount,
    collectedProjectsLoaded,
    isProjectsDataLoading,
    shouldLoadCollectedProjects,
  ])

  useEffect(() => {
    if (!user || isProjectsDataLoading || !shouldLoadCompletedProjects || completedProjectsLoaded) return
    if (completedProjectsCount === 0) {
      setCompletionStatusMap(new Map())
      setCompletedProjectsList([])
      setCompletedProjectsLoaded(true)
      return
    }

    let cancelled = false
    setIsCompletedProjectsLoading(true)

    const loadCompletedProjects = async () => {
      try {
        const response = await fetch('/api/profile/projects?type=completed')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '完成项目加载失败')
        }

        if (cancelled) return

        setCompletedProjectsList((payload?.projects as Project[]) || [])
        setCompletionStatusMap(
          new Map(
            ((payload?.completionStatusEntries as [number, { status: string; rejectionReason?: string }][] | undefined) || []),
          ),
        )
        setCompletedProjectsLoaded(true)
      } catch (err) {
        if (cancelled) return
        logger.error('Exception in loadCompletedProjects', { error: err })
        showLoadError(getErrorMessage(err, '无法加载完成项目，请稍后重试'))
      } finally {
        if (!cancelled) {
          setIsCompletedProjectsLoading(false)
        }
      }
    }

    loadCompletedProjects()

    return () => {
      cancelled = true
    }
  }, [
    user,
    completedProjectsCount,
    completedProjectsLoaded,
    isProjectsDataLoading,
    shouldLoadCompletedProjects,
  ])

  useEffect(() => {
    if (!user || isProjectsDataLoading || !shouldLoadExploringProjects || exploringProjectsLoaded) return

    let cancelled = false
    setIsExploringProjectsLoading(true)

    const loadExploring = async () => {
      try {
        const response = await fetch('/api/profile/projects?type=exploring')
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || '探索中列表加载失败')
        }
        if (!cancelled) {
          setExploringProjectsList((payload?.projects as Project[]) || [])
          setExploringProjectsLoaded(true)
        }
      } catch (error) {
        if (!cancelled) {
          showLoadError(getErrorMessage(error, '探索中列表加载失败'))
        }
      } finally {
        if (!cancelled) setIsExploringProjectsLoading(false)
      }
    }

    void loadExploring()
    return () => {
      cancelled = true
    }
  }, [
    user,
    isProjectsDataLoading,
    shouldLoadExploringProjects,
    exploringProjectsLoaded,
    showLoadError,
  ])

  if (authLoading) {
    return <ProfileLibrarySkeleton />
  }

  if (!user) {
    return null
  }

  const desktopTabs = [
    { key: 'my-projects' as const, label: '作品', count: myProjectsTotalCount },
    { key: 'collected' as const, label: '收藏', count: collectedProjectsCount },
    { key: 'liked' as const, label: '点赞', count: likedProjectsCount },
    { key: 'exploring' as const, label: '探索中', count: exploringProjectsList.length || null },
    { key: 'completed' as const, label: '已完成', count: completedProjectsCount },
    {
      key: 'observations' as const,
      label: '观察记录',
      count: observationsLoaded ? observationsTotal : null,
    },
  ]
  const showDesktopProjectSkeleton =
    (isProjectsDataLoading && activeTab === 'my-projects') ||
    (activeTab === 'collected' && isCollectedProjectsLoading) ||
    (activeTab === 'liked' && isLikedProjectsLoading) ||
    (activeTab === 'completed' && isCompletedProjectsLoading) ||
    (activeTab === 'exploring' && isExploringProjectsLoading)
  const visibleDesktopProjects = myProjects.slice(0, visibleDesktopWorksCount)
  const hasMoreDesktopWorks = myProjectsTotalCount > visibleDesktopWorksCount

  if (isProjectsDataLoading) {
    return <ProfileLibrarySkeleton />
  }

  if (isDesktopViewport === null) {
    return <ProfileLibrarySkeleton />
  }

  return isDesktopViewport ? (
    <div className="mx-auto hidden w-full max-w-[1840px] px-4 py-8 min-[390px]:px-5 md:block md:px-8">
      <div className="space-y-6">
        <section className="surface-panel relative min-h-[254px] overflow-hidden">
          <div className="absolute inset-0">
            <Image
              src="/assets/profile-library-soft-blue-hero.png"
              alt=""
              fill
              priority
              className="object-cover opacity-70 dark:opacity-34"
              sizes="(min-width: 1840px) 1776px, (min-width: 768px) calc(100vw - 4rem), 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/94 via-background/78 to-background/32" />
          </div>
          <div className="relative grid min-h-[254px] gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:items-end xl:px-8">
            <div className="flex items-start gap-3">
              <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-xl bg-background/62">
                <Link href="/profile" aria-label="返回个人主页">
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="min-w-0 pt-1">
                <p className="section-kicker">个人空间</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">我的内容库</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  统一查看作品、收藏、点赞、完成记录和自然观察，把你的探索证据集中保存。
                </p>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 lg:justify-self-end">
              {[
                { label: '作品', value: myProjectsTotalCount, icon: FolderOpen },
                { label: '收藏', value: collectedProjectsCount, icon: Heart },
                { label: '已完成', value: completedProjectsCount, icon: CheckCircle2 },
                { label: '观察记录', value: observationsLoaded ? observationsTotal : uniqueSpeciesCount, icon: Feather },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border/70 bg-background/78 px-4 py-3 backdrop-blur">
                  <item.icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-xl font-semibold tabular-nums">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel overflow-hidden">
          <div className="border-b border-border/60 px-6 py-5">
            <div className="mt-1 -mx-1 overflow-x-auto px-1 no-scrollbar">
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
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {showDesktopProjectSkeleton ? (
                <ProjectListSkeleton />
              ) : (
                <>
                  {activeTab === 'my-projects' && myProjects.length === 0 ? (
                    <DesktopProfileEmptyState
                      title="还没有发布作品"
                      description="把你的第一个项目整理出来。"
                      href="/project"
                      actionLabel="去分享"
                    />
                  ) : null}
                  {activeTab === 'my-projects' &&
                    visibleDesktopProjects.map((project, index) => (
                      <div
                        key={project.id}
                        style={
                          index >= 4
                            ? { contentVisibility: 'auto', containIntrinsicSize: '360px 420px' }
                            : undefined
                        }
                      >
                        <ProjectCard project={project} showStatus={true} />
                      </div>
                    ))}

                  {activeTab === 'collected' && collectedProjectsList.length === 0 ? (
                    <DesktopProfileEmptyState
                      title="还没有收藏项目"
                      description="去探索页面保存感兴趣的项目。"
                      href="/explore"
                      actionLabel="去探索"
                    />
                  ) : null}
                  {activeTab === 'collected' &&
                    collectedProjectsList.map((project, index) => (
                      <div
                        key={project.id}
                        style={
                          index >= 4
                            ? { contentVisibility: 'auto', containIntrinsicSize: '360px 420px' }
                            : undefined
                        }
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}

                  {activeTab === 'liked' && likedProjectsList.length === 0 ? (
                    <DesktopProfileEmptyState
                      title="还没有喜欢记录"
                      description="去发现更多有趣项目。"
                      href="/explore"
                      actionLabel="去探索"
                    />
                  ) : null}
                  {activeTab === 'liked' &&
                    likedProjectsList.map((project, index) => (
                      <div
                        key={project.id}
                        style={
                          index >= 4
                            ? { contentVisibility: 'auto', containIntrinsicSize: '360px 420px' }
                            : undefined
                        }
                      >
                        <ProjectCard project={project} />
                      </div>
                    ))}

                  {activeTab === 'exploring' && exploringProjectsList.length === 0 ? (
                    <DesktopProfileEmptyState
                      title="暂无探索中的项目"
                      description="在项目详情点击「开始探索」后，会出现在这里。"
                      href="/explore"
                      actionLabel="去探索"
                    />
                  ) : null}
                  {activeTab === 'exploring' &&
                    exploringProjectsList.map((project, index) => (
                      <div
                        key={project.id}
                        className="relative"
                        style={
                          index >= 4
                            ? { contentVisibility: 'auto', containIntrinsicSize: '360px 420px' }
                            : undefined
                        }
                      >
                        <ExploringBadge />
                        <ProjectCard project={project} href={`/project/${project.id}/records`} />
                      </div>
                    ))}

                  {activeTab === 'completed' && completedProjectsList.length === 0 ? (
                    <DesktopProfileEmptyState
                      title="还没有完成项目"
                      description="从一个小项目开始。"
                      href="/explore"
                      actionLabel="开始项目"
                    />
                  ) : null}
                  {activeTab === 'completed' &&
                    completedProjectsList.map((project, index) => {
                      const completionStatus = completionStatusMap.get(Number(project.id))
                      return (
                        <div
                          key={project.id}
                          className="relative"
                          style={
                            index >= 4
                              ? { contentVisibility: 'auto', containIntrinsicSize: '360px 420px' }
                              : undefined
                          }
                        >
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

            {activeTab === 'my-projects' && hasMoreDesktopWorks ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMoreMyProjects}
                  disabled={isLoadingMoreMyProjects}
                  className="rounded-full border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {isLoadingMoreMyProjects ? '加载中...' : '加载更多作品'}
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  ) : (
    <MobileProfilePage
      user={user}
      profile={profile}
      myProjects={myProjects}
      myProjectsTotalCount={myProjectsTotalCount}
      totalLikesReceived={totalLikesReceived}
      likedProjectsList={likedProjectsList}
      collectedProjectsList={collectedProjectsList}
      completedProjectsList={completedProjectsList}
      exploringProjectsList={exploringProjectsList}
      completionStatusMap={completionStatusMap}
      followerCount={followerCount}
      followingCount={followingCount}
      likedProjectsCount={likedProjectsCount}
      collectedProjectsCount={collectedProjectsCount}
      completedProjectsCount={completedProjectsCount}
      steamRadar={steamRadar}
      isProjectsDataLoading={isProjectsDataLoading}
      isLoadingMoreMyProjects={isLoadingMoreMyProjects}
      onLoadMoreMyProjects={loadMoreMyProjects}
      myObservations={myObservations}
      observationsTotal={observationsTotal}
      uniqueSpeciesCount={uniqueSpeciesCount}
      isObservationsLoading={isObservationsLoading}
      observationsLoaded={observationsLoaded}
      onTabChange={setMobileProfileTab}
      showProfileHeader={false}
      showSteamRadar={false}
      pageTitle="内容库"
      backHref="/profile"
    />
  )
}


function ExploringBadge() {
  return (
    <div className="absolute left-2 top-2 z-10">
      <span className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--brand-green)/0.35)] bg-[hsl(var(--brand-green)/0.12)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand-green))]">
        <Rocket className="h-3 w-3" />
        继续记录
      </span>
    </div>
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
