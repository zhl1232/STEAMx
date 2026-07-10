'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Award,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Edit3,
  Eye,
  FolderOpen,
  Heart,
  Leaf,
  MessageCircle,
  Radar,
  Rocket,
  Settings,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { BadgeIcon } from '@/components/features/gamification/badge-icon'
import { GrowthTaskRow } from '@/components/features/profile/growth-task-row'
import { ProfileNextActionCard } from '@/components/features/profile/profile-next-action-card'
import { ProfileModuleIcon, PROFILE_ACTION_GRID_ICONS } from '@/components/features/profile/profile-spot-icons'
import {
  ProfileTimelineIcon,
  isProfileTimelineIconName,
} from '@/components/features/profile/profile-timeline-icons'
import { StudyCheckInCard } from '@/components/features/profile/study-check-in-card'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import {
  MobileProfileSectionTitle,
} from '@/components/features/profile/mobile-today-tasks-card'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { useAuth } from '@/lib/context/auth-context'
import { BADGES, useGamification } from '@/lib/context/gamification-context'
import { type Notification, useOptionalNotifications } from '@/lib/context/notification-context'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { logger } from '@/lib/logger'
import type { ObservationEvent, Project, Work } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import { getNotificationTargetHref } from '@/lib/notifications/navigation'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import { getCompletedGrowthTaskCount, resolveGrowthTasks, toGrowthTaskInput } from '@/lib/profile/growth-tasks'
import {
  type ProfileStudyCheckInSummary,
  type StudyCheckInLoadState,
} from '@/lib/profile/study-checkin'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import type { ProfileNextAction } from '@/lib/profile/next-action'
import { isExploreVacuum as isProfileExploreVacuum, resolveProfileNextAction } from '@/lib/profile/next-action'
import { getNameColorClassName } from '@/lib/shop/items'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'
import { profileHomeQueryKey, useProfilePageData } from '@/hooks/profile/use-profile-page-data'
import { useToast } from '@/hooks/use-toast'
import { invalidateProfileHomeData } from '@/lib/profile/profile-home-client'
import type { WeeklyPlan } from '@/lib/profile/weekly-plan'
import { fetchWeeklyPlan, invalidateWeeklyPlan } from '@/lib/profile/weekly-plan-client'
import { WeeklyPlanCard, WeeklyPlanCardSkeleton } from '@/components/features/profile/weekly-plan-card'

const SteamRadarChart = dynamic(
  () => import('@/components/features/profile/steam-radar-chart').then((mod) => mod.SteamRadarChart),
  {
    loading: () => <div className="surface-panel min-h-[320px] rounded-xl" />,
  },
)

/** 卡片内引导操作：浅底 + 描边，避免与头图「我的内容」主按钮抢视觉层级（见 globals `.profile-soft-cta`） */

const weeklyPlanQueryKey = (userId: string | undefined) => ['profile', 'weekly-plan', userId] as const

type ProfileContext = {
  userName: string
  userAvatar: string
  level: number
  levelTitle: string
  currentXP: number
  nextLevelXP: number
  xpIntoLevel: number
  xpNeededThisLevel: number
  joinedAt: string
}

type ProfileStat = {
  key: string
  label: string
  value: number
  href: string
  icon: ProfileIconName
}

const PROFILE_ICON_META = {
  works: { icon: FolderOpen, tone: 'blue' },
  followers: { icon: UsersRound, tone: 'green' },
  following: { icon: Heart, tone: 'rose' },
  likes: { icon: Trophy, tone: 'amber' },
  projects: { icon: FolderOpen, tone: 'blue' },
  favorites: { icon: Heart, tone: 'rose' },
  progress: { icon: CalendarDays, tone: 'green' },
  liked: { icon: Award, tone: 'amber' },
  emptyProjects: { icon: Rocket, tone: 'blue' },
  observation: { icon: Leaf, tone: 'green' },
  community: { icon: MessageCircle, tone: 'violet' },
  timeline: { icon: Radar, tone: 'blue' },
  growth: { icon: BookOpen, tone: 'green' },
  achievement: { icon: Trophy, tone: 'amber' },
} as const

type ProfileIconName = keyof typeof PROFILE_ICON_META

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatShortDate(value?: string | null) {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '探'
}

function getLevelTitle(level: number) {
  if (level >= 18) return '探索导师'
  if (level >= 12) return '创客先锋'
  if (level >= 6) return '探索新星'
  return '创客学员'
}

function clampProgress(value: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / target) * 100)))
}

function hasSteamRadarValue(radar: SteamRadarWithGuidance | null) {
  if (!radar) return false
  return Object.values(radar).some((item) => (item.display ?? item.raw ?? 0) > 0)
}

function getObservationTitle(observation: ObservationEvent) {
  const firstSpecies = observation.species[0]?.commonName
  if (firstSpecies) return firstSpecies
  if (observation.habitat) return `${observation.habitat}观察`
  return '自然观察'
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { unlockedBadges, userBadgeDetails, userStats, refetchStats } = useGamification()
  const {
    data: profileHomeData,
    isPending: isProfileHomePending,
    isError: isProfileHomeError,
  } = useProfilePageData(user?.id)
  const {
    data: weeklyPlan,
    isPending: isWeeklyPlanPending,
    isError: isWeeklyPlanError,
  } = useQuery({
    queryKey: weeklyPlanQueryKey(user?.id),
    queryFn: () => fetchWeeklyPlan(user!.id),
    enabled: !!user?.id,
  })
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null)
  const [claimingTaskId, setClaimingTaskId] = useState<GrowthTaskId | null>(null)

  const showLoadError = useEffectEvent((description: string) => {
    toast({
      title: '加载失败',
      description,
      variant: 'destructive',
    })
  })

  const myProjects = profileHomeData?.myProjects ?? []
  const myWorks = profileHomeData?.myWorks ?? []
  const myWorksTotalCount = profileHomeData?.myWorksTotalCount ?? 0
  const followerCount = profileHomeData?.followerCount ?? 0
  const followingCount = profileHomeData?.followingCount ?? 0
  const totalLikesReceived = profileHomeData?.totalLikesReceived ?? 0
  const steamRadar = profileHomeData?.steamRadar ?? null
  const exploringProjects = profileHomeData?.exploringProjects ?? []
  const myObservations = profileHomeData?.myObservations ?? []
  const observationsTotal = profileHomeData?.observationsTotal ?? 0
  const naturalObservationProgress = profileHomeData?.naturalObservationProgress ?? null
  const studyCheckInSummary = profileHomeData?.studyCheckInSummary ?? null
  const growthTasks = profileHomeData?.growthTasks ?? null
  const growthTasksGraduatedAt = profileHomeData?.growthTasksGraduatedAt ?? null
  const profileTimelineEvents = profileHomeData?.profileTimelineEvents ?? null

  const studyCheckInState: StudyCheckInLoadState = isProfileHomePending
    ? 'loading'
    : isProfileHomeError
      ? 'error'
      : 'ready'

  useEffect(() => {
    if (!isProfileHomeError) return
    showLoadError('无法加载个人资料数据，请稍后重试')
  }, [isProfileHomeError])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)
    return () => mediaQuery.removeEventListener('change', updateViewport)
  }, [])

  const handleClaimGrowthTask = useCallback(async (taskId: GrowthTaskId) => {
    if (claimingTaskId) return

    setClaimingTaskId(taskId)

    try {
      const response = await fetch('/api/profile/growth-tasks/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload?.error || '领取失败')
      }

      await refreshProfile()
      if (user?.id) {
        invalidateProfileHomeData(user.id)
        invalidateWeeklyPlan(user.id)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: profileHomeQueryKey(user.id) }),
          queryClient.invalidateQueries({ queryKey: weeklyPlanQueryKey(user.id) }),
        ])
      }

      if (payload?.graduated) {
        void refetchStats()
        toast({
          title: '新手引导已完成',
          description: '解锁「新手毕业」徽章，开启下一段冒险吧',
        })
        return
      }

      if (payload?.alreadyClaimed) {
        toast({ title: '奖励已领取' })
        return
      }

      toast({
        title: '领取成功',
        description: payload?.taskLabel
          ? `已领取「${payload.taskLabel}」奖励，+${Number(payload?.xpGranted || 0)} XP`
          : `已领取 +${Number(payload?.xpGranted || 0)} XP`,
      })
    } catch (err) {
      toast({
        title: '领取失败',
        description: getErrorMessage(err, '请稍后重试'),
        variant: 'destructive',
      })
    } finally {
      setClaimingTaskId(null)
    }
  }, [claimingTaskId, queryClient, refreshProfile, refetchStats, toast, user?.id])

  const fallbackGrowthTasks = useMemo(
    () =>
      resolveGrowthTasks(
        toGrowthTaskInput({
          bio: profile?.bio,
          stats: userStats,
        }),
      ),
    [profile?.bio, userStats],
  )

  if (authLoading || isDesktopViewport === null || (user && isProfileHomePending && !profileHomeData)) {
    return <ProfileSkeleton />
  }

  if (!user) {
    return null
  }

  const userName = getDisplayName({
    profileName: profile?.display_name,
    metadataFullName: user.user_metadata?.full_name,
    metadataName: user.user_metadata?.name,
    phone: user.phone ?? null,
    email: user.email,
    fallback: '未命名用户',
  })
  const userAvatar = profile?.avatar_url || getDefaultAvatarPath(user.id)
  const currentXP = profile?.xp || 0
  const level = Math.floor(Math.sqrt(currentXP / 100)) + 1
  const currentLevelBaseXP = 100 * Math.pow(level - 1, 2)
  const nextLevelXP = 100 * Math.pow(level, 2)
  const xpIntoLevel = Math.max(0, currentXP - currentLevelBaseXP)
  const xpNeededThisLevel = Math.max(1, nextLevelXP - currentLevelBaseXP)
  const featuredBadges =
    unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 5) : BADGES.slice(0, 5)
  const stats: ProfileStat[] = [
    { key: 'works', label: '作品', value: myWorksTotalCount, href: '/profile/library', icon: 'projects' },
    { key: 'followers', label: '粉丝', value: followerCount, href: '/profile/followers', icon: 'followers' },
    { key: 'following', label: '关注', value: followingCount, href: '/profile/following', icon: 'following' },
    { key: 'likes', label: '获赞', value: totalLikesReceived, href: '/profile/likes', icon: 'likes' },
  ]
  const resolvedGrowthTasks = growthTasks ?? fallbackGrowthTasks
  const completedTaskCount = getCompletedGrowthTaskCount(resolvedGrowthTasks)
  const nextAction = resolveProfileNextAction({
    exploringProjects,
    steamRadar,
    myProjects,
    myWorks,
    myObservations,
    profileTimelineEvents,
    growthTasks: resolvedGrowthTasks,
    naturalObservationProgress,
  })

  const profileContext = {
    userName,
    userAvatar,
    level,
    levelTitle: getLevelTitle(level),
    currentXP,
    nextLevelXP,
    xpIntoLevel,
    xpNeededThisLevel,
    joinedAt: formatShortDate(user.created_at),
  }

  const pageData = {
    profileContext,
    stats,
    growthTasks: resolvedGrowthTasks,
    nextAction,
    weeklyPlan: weeklyPlan ?? null,
    weeklyPlanLoading: isWeeklyPlanPending,
    weeklyPlanError: isWeeklyPlanError,
    growthTasksGraduatedAt,
    completedTaskCount,
    claimingTaskId,
    onClaimGrowthTask: handleClaimGrowthTask,
    featuredBadges,
    unlockedBadges,
    userBadgeDetails,
    myProjects,
    myWorks,
    steamRadar,
    myObservations,
    observationsTotal,
    naturalObservationProgress,
    studyCheckInSummary,
    studyCheckInState,
    profile,
  }

  return isDesktopViewport ? (
    <DesktopProfilePage {...pageData} />
  ) : (
    <MobileProfilePage {...pageData} />
  )
}

function DesktopProfilePage({
  profileContext,
  stats,
  growthTasks,
  nextAction,
  weeklyPlan,
  weeklyPlanLoading,
  weeklyPlanError,
  growthTasksGraduatedAt,
  completedTaskCount,
  claimingTaskId,
  onClaimGrowthTask,
  featuredBadges,
  unlockedBadges,
  userBadgeDetails,
  myProjects,
  myWorks,
  steamRadar,
  myObservations,
  observationsTotal,
  naturalObservationProgress,
  studyCheckInSummary,
  studyCheckInState,
  profile,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  growthTasks: ProfileGrowthTask[]
  nextAction: ProfileNextAction
  weeklyPlan: WeeklyPlan | null
  weeklyPlanLoading: boolean
  weeklyPlanError: boolean
  growthTasksGraduatedAt: string | null
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaimGrowthTask: (taskId: GrowthTaskId) => void
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  userBadgeDetails: Map<string, { unlockedAt: string }>
  myProjects: Project[]
  myWorks: Work[]
  steamRadar: SteamRadarWithGuidance | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  naturalObservationProgress: NaturalObservationProgressSummary | null
  studyCheckInSummary: ProfileStudyCheckInSummary | null
  studyCheckInState: StudyCheckInLoadState
  profile: ReturnType<typeof useAuth>['profile']
}) {
  const isExploreVacuum = isProfileExploreVacuum({ steamRadar, myProjects, myWorks, myObservations })
  const hasRadarValue = hasSteamRadarValue(steamRadar)
  const primaryPlanCard = (
    <PrimaryPlanCard
      weeklyPlan={weeklyPlan}
      weeklyPlanLoading={weeklyPlanLoading}
      weeklyPlanError={weeklyPlanError}
      nextAction={nextAction}
      claimingTaskId={claimingTaskId}
      onClaimGrowthTask={onClaimGrowthTask}
    />
  )

  return (
    <div className="profile-page-surface min-h-screen pb-10 text-foreground">
      <div className="app-shell-wide py-4 min-[390px]:py-5 md:px-8 md:py-6 min-[1440px]:px-10">
        <div className="space-y-5">
          <ProfileHero
            profileContext={profileContext}
            stats={stats}
            profile={profile}
            compact={false}
          />

          {primaryPlanCard}

          <div className="grid items-start gap-5 min-[1440px]:grid-cols-[minmax(0,1fr)_400px] min-[1680px]:grid-cols-[minmax(0,1fr)_420px]">
            <main className="min-w-0 space-y-5">
              <section
                className={cn(
                  'surface-panel flex flex-col rounded-lg',
                  hasRadarValue ? 'min-h-[230px] p-6 lg:min-h-[250px]' : 'self-start p-5',
                )}
              >
                <SectionTitle iconName="timeline" title="STEAM 能力雷达" />
                {steamRadar && hasRadarValue ? (
                  <SteamRadarChart
                    initialRadar={steamRadar}
                    showHeader={false}
                    className="mt-3 flex-1 border-0 bg-transparent p-0 shadow-none [&>div:first-of-type]:min-h-[190px] [&>p]:line-clamp-2"
                  />
                ) : (
                  <SteamRadarEmptyPlaceholder />
                )}
              </section>

              {!isExploreVacuum ? (
                <section className="surface-panel rounded-lg p-6">
                  <SectionTitle iconName="projects" title="作品与观察" actionHref="/profile/library" actionLabel="查看内容库" />
                  <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <WorkShowcase works={myWorks} />
                    <ObservationList observations={myObservations} total={observationsTotal} emptyDensity="compact" embedded />
                  </div>
                </section>
              ) : null}

              {isExploreVacuum ? (
                <ProfileStarterHub />
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] min-[1440px]:grid-cols-1 min-[1680px]:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <NaturalObservationProgressCard
                    progress={naturalObservationProgress}
                    compact
                  />
                  <CommunityFeedPanel
                    projects={myProjects}
                    compactEmpty={isExploreVacuum}
                  />
                </div>
              )}
            </main>

            <aside className="min-w-0">
              <div className="grid gap-5 lg:grid-cols-2 min-[1440px]:grid-cols-1">
                <ExperienceBadgesPanel
                  profileContext={profileContext}
                  featuredBadges={featuredBadges}
                  unlockedBadges={unlockedBadges}
                  userBadgeDetails={userBadgeDetails}
                  className="lg:col-span-2 min-[1440px]:col-span-1"
                />
                <GrowthTasksPanel
                  tasks={growthTasks}
                  growthTasksGraduatedAt={growthTasksGraduatedAt}
                  completedTaskCount={completedTaskCount}
                  claimingTaskId={claimingTaskId}
                  onClaim={onClaimGrowthTask}
                  compact
                />
                <StudyCheckInPanel
                  studyCheckInSummary={studyCheckInSummary}
                  studyCheckInState={studyCheckInState}
                  compact
                />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileProfilePage({
  profileContext,
  stats,
  nextAction,
  weeklyPlan,
  weeklyPlanLoading,
  weeklyPlanError,
  claimingTaskId,
  onClaimGrowthTask,
  featuredBadges,
  unlockedBadges,
  userBadgeDetails,
  steamRadar,
  profile,
  naturalObservationProgress,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  nextAction: ProfileNextAction
  weeklyPlan: WeeklyPlan | null
  weeklyPlanLoading: boolean
  weeklyPlanError: boolean
  claimingTaskId: GrowthTaskId | null
  onClaimGrowthTask: (taskId: GrowthTaskId) => void
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  userBadgeDetails: Map<string, { unlockedAt: string }>
  steamRadar: SteamRadarWithGuidance | null
  profile: ReturnType<typeof useAuth>['profile']
  naturalObservationProgress: NaturalObservationProgressSummary | null
}) {
  return (
    <div className="profile-page-surface min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground">
      <MobileGlobalHeader
        variant="title"
        title="我的"
        showNotification={false}
        showUserButton={false}
        rightSlot={
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <Link href="/settings" aria-label="设置">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        }
      />
      <div className="space-y-3 px-4 pt-1 min-[430px]:mx-auto min-[430px]:max-w-[430px]">
        <ProfileHero
          profileContext={profileContext}
          stats={stats}
          profile={profile}
          compact
        />

        <MobileActionGrid />

        {weeklyPlan ? (
          <WeeklyPlanCard
            plan={weeklyPlan}
            claimPendingTaskId={claimingTaskId}
            onClaim={onClaimGrowthTask}
            variant="mobile"
          />
        ) : weeklyPlanLoading && !weeklyPlanError ? (
          <WeeklyPlanCardSkeleton variant="mobile" />
        ) : (
          <ProfileNextActionCard
            action={nextAction}
            claimPending={claimingTaskId === nextAction.growthTaskId}
            onClaim={onClaimGrowthTask}
            variant="mobile"
          />
        )}

        <section className="profile-mobile-panel p-4">
          <MobileProfileSectionTitle title="STEAM 能力雷达" />
          {steamRadar ? (
            <SteamRadarChart
              initialRadar={steamRadar}
              showHeader={false}
              className="mt-3 min-h-[220px] border-0 bg-transparent p-0 shadow-none [&>div:first-of-type]:min-h-[196px]"
            />
          ) : (
            <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.35)] px-4 py-8 text-center">
              <p className="text-sm leading-6 text-muted-foreground">完成项目后生成能力图谱。</p>
              <Link href="/explore" className="profile-action-cta mt-4">
                去发现
              </Link>
            </div>
          )}
        </section>

        <NaturalObservationProgressCard progress={naturalObservationProgress} mobile />

        <section id="profile-badges-anchor" className="profile-mobile-panel p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="truncate text-base font-semibold text-foreground">最近获得的徽章</h2>
            <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
              <button
                type="button"
                className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-xs font-semibold text-muted-foreground transition hover:text-[hsl(var(--brand-blue))]"
              >
                全部徽章
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </BadgeGalleryDialog>
          </div>
          <BadgeShowcase badges={featuredBadges} unlockedBadges={unlockedBadges} compact />
        </section>

      </div>
    </div>
  )
}

function PrimaryPlanCard({
  weeklyPlan,
  weeklyPlanLoading,
  weeklyPlanError,
  nextAction,
  claimingTaskId,
  onClaimGrowthTask,
}: {
  weeklyPlan: WeeklyPlan | null
  weeklyPlanLoading: boolean
  weeklyPlanError: boolean
  nextAction: ProfileNextAction
  claimingTaskId: GrowthTaskId | null
  onClaimGrowthTask: (taskId: GrowthTaskId) => void
}) {
  if (weeklyPlan) {
    return (
      <WeeklyPlanCard
        plan={weeklyPlan}
        claimPendingTaskId={claimingTaskId}
        onClaim={onClaimGrowthTask}
      />
    )
  }

  if (weeklyPlanLoading && !weeklyPlanError) {
    return <WeeklyPlanCardSkeleton />
  }

  return (
    <ProfileNextActionCard
      action={nextAction}
      claimPending={claimingTaskId === nextAction.growthTaskId}
      onClaim={onClaimGrowthTask}
    />
  )
}

function ProfileHeroBackdrop({ compact }: { compact: boolean }) {
  if (compact) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden profile-mobile-hero-backdrop">
        <OptimizedImage
          src="/assets/profile-mobile-hero-space-bg.png"
          alt=""
          fill
          priority
          variant="cover"
          className="object-cover object-[88%_4%] opacity-100"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.84)_0%,hsl(var(--surface-raised)/0.46)_54%,hsl(var(--surface-raised)/0.02)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,hsl(var(--surface-raised)/0.44))]" />
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <OptimizedImage
        src="/assets/profile-mobile-hero-space-bg.png"
        alt=""
        fill
        priority
        variant="cover"
        className="object-cover object-[86%_10%] opacity-95"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.98)_0%,hsl(var(--surface-raised)/0.94)_36%,hsl(var(--surface-raised)/0.66)_58%,hsl(var(--surface-raised)/0.16)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--surface-raised)/0.96)_0%,hsl(var(--surface-raised)/0.86)_42%,hsl(var(--surface-raised)/0.52)_68%,hsl(var(--surface-raised)/0.22)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,hsl(var(--surface-raised)/0.72))]" />
    </div>
  )
}

function ProfileHero({
  profileContext,
  stats,
  profile,
  compact,
  splitStats = false,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  profile: ReturnType<typeof useAuth>['profile']
  compact: boolean
  splitStats?: boolean
}) {
  const compactProgressPercent = clampProgress(profileContext.xpIntoLevel, profileContext.xpNeededThisLevel)
  const compactRemainingXP = Math.max(0, profileContext.nextLevelXP - profileContext.currentXP)
  const showInlineStats = compact ? !splitStats : true

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        compact
          ? 'profile-mobile-hero'
          : 'profile-hero-card surface-panel min-h-[270px] rounded-lg',
      )}
    >
      <ProfileHeroBackdrop compact={compact} />

      <div className={cn('relative', compact ? 'px-4 pb-4 pt-4' : 'px-7 pb-0 pt-7')}>
        <div className={cn(compact ? 'grid grid-cols-[78px_minmax(0,1fr)] items-start gap-4' : 'flex min-h-[156px] flex-wrap items-start gap-6')}>
          <div className="relative shrink-0">
            <AvatarWithFrame
              src={profileContext.userAvatar}
              alt={profileContext.userName}
              fallback={getInitial(profileContext.userName)}
              avatarFrameId={profile?.equipped_avatar_frame_id}
              className={cn(
                'border-[3px] border-background shadow-[0_12px_28px_-18px_hsl(var(--brand-blue)/0.35)]',
                compact ? 'h-[78px] w-[78px]' : 'h-[112px] w-[112px]',
              )}
              avatarClassName="rounded-full object-cover"
            />
            <LevelGuideDialog>
              <button
                type="button"
                className="absolute -bottom-1.5 left-1/2 inline-flex h-6 -translate-x-1/2 items-center rounded-full border border-[hsl(var(--brand-blue)/0.22)] bg-[hsl(var(--background)/0.98)] px-2.5 text-[10px] font-bold text-[hsl(var(--brand-blue))] shadow-xs backdrop-blur-md transition hover:-translate-y-0.5 hover:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Lv.{profileContext.level}
              </button>
            </LevelGuideDialog>
          </div>

          <div className="min-w-0">
            {compact ? (
              <span className="inline-flex h-5 items-center rounded-full border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--surface-raised)/0.74)] px-2.5 text-[10px] font-semibold text-[hsl(var(--brand-blue))] shadow-xs backdrop-blur-sm">
                {profileContext.levelTitle}
              </span>
            ) : null}
            <div className={cn('flex items-start gap-2', compact && 'mt-1.5')}>
              <h2
                className={cn(
                  'min-w-0 flex-1 truncate font-semibold tracking-normal text-foreground',
                  compact ? 'text-[19px] leading-7' : 'text-[30px]',
                  getNameColorClassName(profile?.equipped_name_color_id ?? null),
                )}
              >
                {profileContext.userName}
              </h2>
              {compact ? (
                <EditProfileDialog>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--surface-muted)/0.72)] hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label="编辑资料"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </EditProfileDialog>
              ) : null}
            </div>
            <p className={cn('text-muted-foreground', compact ? 'mt-1.5 line-clamp-2 text-[12px] leading-5' : 'mt-2 max-w-2xl text-sm leading-7')}>
              {profile?.bio || '热爱科学与创造，喜欢用动手实践探索世界的奥秘。'}
            </p>
          </div>
        </div>

        {compact ? (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-foreground/82">
                经验 {profileContext.xpIntoLevel.toLocaleString()} / {profileContext.xpNeededThisLevel.toLocaleString()}
              </span>
              <span className="font-semibold text-[hsl(var(--brand-blue))]">
                {compactProgressPercent}%
              </span>
            </div>
            <div
              className="profile-xp-track mt-2 h-[7px]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={compactProgressPercent}
            >
              <div
                className="profile-xp-progress h-full"
                style={{ width: `${compactProgressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              再获得 {compactRemainingXP.toLocaleString()} 经验升级
            </p>
          </div>
        ) : null}

        {showInlineStats ? (
          <div
            className={cn(
              'grid grid-cols-4 overflow-hidden',
              compact
                ? 'mt-4 rounded-md border border-[hsl(var(--surface-border)/0.52)] bg-[hsl(var(--surface-raised)/0.78)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.48)] backdrop-blur-sm'
                : 'profile-stats-bar mt-8',
            )}
          >
            {stats.map((stat, index) => (
              <ProfileStatTile key={stat.key} stat={stat} compact={compact} bordered={index > 0} />
            ))}
          </div>
        ) : null}
        {!compact ? <div className="h-5 shrink-0" aria-hidden="true" /> : null}
      </div>
    </section>
  )
}

function ProfileStatTile({ stat, compact, bordered }: { stat: ProfileStat; compact: boolean; bordered: boolean }) {
  return (
    <Link
      href={stat.href}
      className={cn(
        'group flex items-center justify-center transition hover:bg-[hsl(var(--surface-muted)/0.72)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
        compact
          ? 'min-h-[58px] flex-col justify-center gap-0.5 px-1 py-2.5 text-center'
          : 'min-h-[60px] gap-3 px-4 py-3.5',
        bordered &&
          (compact
            ? 'border-l border-[hsl(var(--surface-border)/0.65)]'
            : 'border-l border-[hsl(var(--surface-border))]'),
      )}
    >
      {!compact ? <ProfileImageIcon name={stat.icon} variant="heroStat" className="h-10 w-10" /> : null}
      <span className={compact ? 'block' : 'min-w-0'}>
        <span className={cn('block font-semibold tabular-nums text-foreground', compact ? 'text-[20px] leading-6' : 'text-xl')}>
          {formatCompactNumber(stat.value)}
        </span>
        <span className={cn('block text-muted-foreground', compact ? 'mt-1 text-[11px] font-medium leading-none' : 'mt-0.5 text-xs font-medium')}>
          {stat.label}
        </span>
      </span>
    </Link>
  )
}

function ProfileImageIcon({
  name,
  className,
  variant = 'module',
  size = 'md',
}: {
  name: ProfileIconName
  className?: string
  variant?: 'module' | 'heroStat' | 'timeline'
  size?: 'sm' | 'md'
}) {
  const { icon: Icon, tone } = PROFILE_ICON_META[name]
  const toneClassName = {
    blue: 'bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]',
    green: 'bg-[hsl(var(--brand-green)/0.1)] text-[hsl(var(--brand-green))]',
    amber: 'bg-[hsl(var(--brand-amber)/0.13)] text-[hsl(var(--brand-amber))]',
    rose: 'bg-rose-500/10 text-rose-500',
    violet: 'bg-violet-500/10 text-violet-500',
  }[tone]

  if (variant === 'timeline' && isProfileTimelineIconName(name)) {
    return <ProfileTimelineIcon name={name} size={size} className={className} />
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-lg',
        variant === 'heroStat'
          ? 'bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))] ring-1 ring-[hsl(var(--brand-blue)/0.35)] shadow-xs dark:bg-white/20 dark:text-white dark:ring-white/28'
          : variant === 'timeline'
            ? 'bg-[hsl(var(--brand-blue))] text-white ring-4 ring-[hsl(var(--surface-raised))] shadow-[0_14px_26px_-20px_hsl(var(--brand-blue)/0.85)]'
            : toneClassName,
        className,
      )}
    >
      <Icon className={cn(variant === 'heroStat' ? 'h-[52%] w-[52%]' : 'h-[48%] w-[48%]')} strokeWidth={variant === 'heroStat' ? 2.8 : 2.4} />
    </span>
  )
}

function SectionTitle({
  icon: Icon,
  iconName,
  title,
  actionHref,
  actionLabel,
  actionSlot,
}: {
  icon?: LucideIcon
  iconName?: ProfileIconName
  title: string
  actionHref?: string
  actionLabel?: string
  actionSlot?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {iconName ? (
          <ProfileImageIcon name={iconName} className="h-10 w-10" />
        ) : Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
      </div>
      {actionSlot ? (
        actionSlot
      ) : actionHref && actionLabel ? (
        <Link href={actionHref} className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)]">
          {actionLabel}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  )
}

const MINI_RADAR_DIMENSIONS = [
  { key: 'S', label: '科学' },
  { key: 'T', label: '技术' },
  { key: 'E', label: '工程' },
  { key: 'A', label: '艺术' },
  { key: 'M', label: '数学' },
] as const

function radarWebRingPoints(outerRadius: number) {
  return MINI_RADAR_DIMENSIONS.map((_, index) => {
    const angle = (-90 + index * 72) * (Math.PI / 180)
    return `${(50 + Math.cos(angle) * outerRadius).toFixed(2)},${(50 + Math.sin(angle) * outerRadius).toFixed(2)}`
  }).join(' ')
}

function SteamRadarEmptyPlaceholder() {
  const ringRadii = [40, 26, 14]
  const spokeRadius = 40

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-md border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.35)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <svg viewBox="0 0 100 100" className="h-16 w-16 shrink-0 text-muted-foreground/48 dark:text-muted-foreground/42" aria-hidden>
          {ringRadii.map((r) => (
            <polygon key={r} points={radarWebRingPoints(r)} fill="none" stroke="currentColor" strokeWidth="0.55" vectorEffect="non-scaling-stroke" />
          ))}
          {MINI_RADAR_DIMENSIONS.map((_, index) => {
            const angle = (-90 + index * 72) * (Math.PI / 180)
            return (
              <line
                key={index}
                x1="50"
                y1="50"
                x2={(50 + Math.cos(angle) * spokeRadius).toFixed(2)}
                y2={(50 + Math.sin(angle) * spokeRadius).toFixed(2)}
                stroke="currentColor"
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-foreground">还没有能力雷达</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            完成项目或挑战后，会生成 STEAM 五维图谱。
          </p>
        </div>
      </div>
      <Link href="/explore" className={cn('profile-soft-cta', 'h-9 w-fit shrink-0')}>
        去探索项目
      </Link>
    </div>
  )
}

function MobileActionGrid() {
  const { unreadCount } = useOptionalNotifications()
  const actions = [
    { label: '我的内容', href: '/profile/library', src: PROFILE_ACTION_GRID_ICONS.content },
    { label: '消息中心', href: '/messages', src: PROFILE_ACTION_GRID_ICONS.messages },
    { label: '我的钱包', href: '/coins', src: PROFILE_ACTION_GRID_ICONS.wallet },
    { label: '创客商店', href: '/shop', src: PROFILE_ACTION_GRID_ICONS.shop },
  ]

  return (
    <section className="profile-mobile-panel grid grid-cols-4 gap-2 p-3">
      {actions.map((action) => (
        <Link key={action.label} href={action.href} className="grid min-h-[76px] place-items-center gap-1.5 rounded-md px-0.5 py-2.5 text-center transition hover:bg-[hsl(var(--surface-muted)/0.68)]">
          <span className="relative block">
            <ProfileModuleIcon src={action.src} label={action.label} size="lg" />
            {action.href === '/messages' && unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </span>
          <span className="whitespace-nowrap text-[10px] font-semibold leading-none text-foreground min-[390px]:text-[11px]">{action.label}</span>
        </Link>
      ))}
    </section>
  )
}

function BadgeShowcase({
  badges,
  unlockedBadges,
  compact = false,
}: {
  badges: typeof BADGES
  unlockedBadges: Set<string>
  compact?: boolean
}) {
  return (
    <div className={cn('mt-4 flex', compact ? 'justify-between gap-1.5' : 'flex-wrap gap-3')}>
      {badges.map((badge) => (
        <div key={badge.id} className={cn('flex flex-col items-center text-center', compact ? 'min-w-0 flex-1' : 'w-[68px]')}>
          <span className="grid h-11 w-11 place-items-center overflow-visible">
            <BadgeIcon
              icon={badge.icon}
              tier={badge.tier}
              seriesKey={badge.seriesKey}
              size={compact ? 'md' : 'lg'}
              className={compact ? 'h-11 w-11' : 'h-12 w-12'}
              showGlow={false}
              locked={!unlockedBadges.has(badge.id)}
            />
          </span>
          <span className={cn('mt-2 max-w-full text-xs font-semibold leading-4 text-foreground/84', compact ? 'block truncate' : 'line-clamp-2')}>
            {badge.name}
          </span>
        </div>
      ))}
    </div>
  )
}

function ExperienceBadgesPanel({
  profileContext,
  featuredBadges,
  unlockedBadges,
  userBadgeDetails,
  className,
}: {
  profileContext: ProfileContext
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  userBadgeDetails: Map<string, { unlockedAt: string }>
  className?: string
}) {
  const remainingXP = Math.max(0, profileContext.nextLevelXP - profileContext.currentXP)
  const levelProgressPercent = clampProgress(profileContext.xpIntoLevel, profileContext.xpNeededThisLevel)

  return (
    <section
      id="profile-badges-anchor"
      className={cn('surface-panel flex flex-col overflow-hidden rounded-lg p-6', className)}
    >
      <SectionTitle
        iconName="achievement"
        title="经验与等级"
        actionSlot={(
          <LevelGuideDialog>
            <button
              type="button"
              className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              查看规则
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </LevelGuideDialog>
        )}
      />

      <div className="mt-4 rounded-md bg-[hsl(var(--surface-muted)/0.38)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 items-end gap-3">
            <span className="text-[34px] font-extrabold leading-none text-[hsl(var(--brand-blue))]">Lv.{profileContext.level}</span>
            <span className="pb-1 text-sm font-semibold text-foreground">{profileContext.levelTitle}</span>
          </div>
          <span className="pb-1 text-xs font-semibold text-[hsl(var(--brand-blue))]">{levelProgressPercent}%</span>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-muted-foreground">
              经验值 {profileContext.xpIntoLevel.toLocaleString()} / {profileContext.xpNeededThisLevel.toLocaleString()}
            </span>
          </div>
          <LevelProgress showLabel={false} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            再获得 {remainingXP.toLocaleString()} 经验值即可进入下一等级。
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-[hsl(var(--surface-border))] pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">最近获得的徽章</p>
          <BadgeGalleryDialog badges={BADGES} unlockedBadges={unlockedBadges} userBadgeDetails={userBadgeDetails}>
            <button type="button" className="inline-flex min-h-8 shrink-0 items-center gap-1 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)]">
              查看全部
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </BadgeGalleryDialog>
        </div>
        <BadgeShowcase badges={featuredBadges} unlockedBadges={unlockedBadges} />
      </div>
    </section>
  )
}

function StudyCheckInPanel({
  studyCheckInSummary,
  studyCheckInState,
  className,
  compact = false,
}: {
  studyCheckInSummary: ProfileStudyCheckInSummary | null
  studyCheckInState: StudyCheckInLoadState
  className?: string
  compact?: boolean
}) {
  return (
    <StudyCheckInCard
      title={<SectionTitle iconName="progress" title="每日打卡" />}
      summary={studyCheckInSummary}
      state={studyCheckInState}
      className={className}
      compact={compact}
    />
  )
}

function CommunityFeedPanel({
  projects,
  className,
  compactEmpty = false,
}: {
  projects: Project[]
  className?: string
  compactEmpty?: boolean
}) {
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      return
    }

    let cancelled = false

    const loadNotifications = async () => {
      setLoadFailed(false)
      try {
        const response = await fetch('/api/notifications?limit=5')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '最近通知加载失败')
        }

        if (cancelled) return
        setNotifications((payload?.notifications as Notification[] | undefined) || [])
      } catch (err) {
        if (cancelled) return
        logger.warn('Failed to load profile notification preview', { error: err })
        setLoadFailed(true)
        setNotifications([])
      }
    }

    setNotifications(null)
    loadNotifications()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const projectImageById = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project.image]))
  }, [projects])

  return (
    <section className={cn('surface-panel rounded-lg p-6', className)}>
      <SectionTitle iconName="community" title="最近通知" actionHref="/messages" actionLabel="查看全部" />
      {notifications === null ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-sm p-1.5">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-11 w-[52px] animate-pulse rounded-sm bg-muted" />
            </div>
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <div className="mt-4 space-y-3">
          {notifications.map((notification) => {
            const href = getNotificationTargetHref(notification) || '/messages'
            const image = notification.project_id ? projectImageById.get(notification.project_id) : null
            const displayName = notification.from_username || '系统通知'

            return (
              <Link key={notification.id} href={href} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-sm p-1.5 transition hover:bg-[hsl(var(--surface-muted)/0.68)]">
                <AvatarWithFrame
                  src={notification.from_avatar || undefined}
                  alt={displayName}
                  fallback={getInitial(displayName)}
                  className="h-8 w-8 border-2 border-background"
                  avatarClassName="rounded-full object-cover"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[hsl(var(--brand-green))]">{displayName}</span>
                  <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-foreground">{notification.content}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.created_at), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </span>
                <span className="relative h-11 w-[52px] overflow-hidden rounded-sm bg-[hsl(var(--surface-muted))]">
                  {image ? (
                    <OptimizedImage src={image} alt="" fill variant="thumbnail" className="object-cover" />
                  ) : (
                    <MessageCircle className="m-3 h-5 w-5 text-[hsl(var(--brand-blue))]" />
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      ) : compactEmpty ? (
        <p className="mt-3 rounded-sm border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.35)] px-3 py-2.5 text-center text-xs leading-5 text-muted-foreground">
          {loadFailed ? '最近通知暂时加载失败。' : '还没有通知，去创造营互动后会出现在这里。'}
          <Link href="/create" className="ml-1 font-bold text-[hsl(var(--brand-blue))]">
            去创造营看看
          </Link>
        </p>
      ) : (
        <EmptyBlock
          icon={MessageCircle}
          iconName="community"
          title={loadFailed ? '通知加载失败' : '还没有通知'}
          description={loadFailed ? '请稍后再查看，或前往消息中心刷新。' : '收到回复、喜欢、关注或打赏时，会在这里显示最近动态。'}
          href={loadFailed ? '/messages' : '/create'}
          action={loadFailed ? '去消息中心' : '去创造营'}
          density="compact"
        />
      )}
    </section>
  )
}

function GrowthTasksPanel({
  tasks,
  growthTasksGraduatedAt,
  completedTaskCount,
  claimingTaskId,
  onClaim,
  compact = false,
}: {
  tasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaim: (taskId: GrowthTaskId) => void
  compact?: boolean
}) {
  // 毕业后不再占用侧栏卡位，「新手毕业」徽章已在徽章墙中承载纪念
  if (growthTasksGraduatedAt) {
    return null
  }

  return (
    <section className={cn('surface-panel rounded-lg', compact ? 'p-4' : 'p-6')}>
      <SectionTitle iconName="growth" title={`新手引导（${completedTaskCount}/5）`} />
      <div className={cn(compact ? 'mt-4 space-y-2.5' : 'mt-5 space-y-3')}>
        {tasks.map((task) => (
          <GrowthTaskRow
            key={task.id}
            task={task}
            claimPending={claimingTaskId === task.id}
            onClaim={onClaim}
            compact={compact}
          />
        ))}
      </div>
    </section>
  )
}

function WorkShowcase({ works }: { works: Work[] }) {
  if (works.length === 0) {
    return (
      <EmptyBlock
        icon={Rocket}
        iconName="emptyProjects"
        title="还没有作品"
        description="完成一个项目或课程，把成果整理成你的第一件作品。"
        href="/explore"
        action="去完成一个项目"
        density="compact"
      />
    )
  }

  return (
    <div className="space-y-3">
      {works.slice(0, 3).map((work) => {
        const image = work.proofImages[0]
        return (
          <Link
            key={work.id}
            href={`/works/${work.id}`}
            className="group grid grid-cols-[82px_minmax(0,1fr)] items-center rounded-md p-1.5 transition hover:bg-[hsl(var(--surface-muted)/0.68)]"
          >
            <div className="relative h-16 w-[82px] overflow-hidden rounded-sm bg-[hsl(var(--surface-muted))]">
              {image ? (
                <OptimizedImage
                  src={image}
                  alt={`${work.author} 的作品`}
                  fill
                  variant="thumbnail"
                  className="object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : null}
            </div>
            <div className="min-w-0 px-3 py-1">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {work.source?.title || '探索作品'}
              </h3>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {work.source?.type === 'course_lesson' ? work.source.courseTitle : '项目作品'}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{work.likes}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{work.commentsCount ?? 0}</span>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function ObservationList({
  observations,
  total,
  mobile = false,
  emptyDensity = 'default',
  embedded = false,
}: {
  observations: ObservationEvent[]
  total: number
  mobile?: boolean
  emptyDensity?: 'default' | 'compact'
  embedded?: boolean
}) {
  if (observations.length === 0) {
    return (
      <EmptyBlock
        icon={Leaf}
        iconName="observation"
        title="大自然正在呼唤"
        description="拍下校园、公园或窗边的自然线索，让这里成为你的发现图鉴。"
        href="/nature/submit"
        action="去记录今天见到的第一只鸟"
        density={emptyDensity}
        mobile={mobile}
      />
    )
  }

  const visibleObservations = observations.slice(0, mobile ? 4 : embedded ? 3 : 5)

  return (
    <div className={cn('mt-4', mobile ? '-mx-1 overflow-x-auto px-1' : 'space-y-3')}>
      <div className={cn(mobile ? 'flex w-max gap-3 pb-1' : 'space-y-3')}>
        {visibleObservations.map((observation) => (
          <Link
            key={observation.id}
            href={`/nature/observations/${observation.id}`}
            className={cn(
              'group block transition hover:bg-[hsl(var(--surface-muted)/0.82)]',
              mobile ? 'surface-card w-[172px] overflow-hidden' : embedded ? 'rounded-md p-1.5' : 'surface-card p-4',
            )}
          >
            <div className={cn('flex gap-3', mobile && 'block')}>
              <div className={cn('relative shrink-0 overflow-hidden rounded-sm bg-[hsl(var(--surface-border))]', mobile ? 'h-[92px] w-full rounded-none' : 'h-16 w-20')}>
                {observation.mediaUrls[0] ? (
                  <OptimizedImage src={observation.mediaUrls[0]} alt={getObservationTitle(observation)} fill variant="thumbnail" className="object-cover transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Leaf className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className={cn('min-w-0 flex-1', mobile && 'p-3')}>
                <h3 className="line-clamp-1 text-sm font-extrabold text-foreground">{getObservationTitle(observation)}</h3>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{formatShortDate(observation.observedAt)} · {observation.locationName || '未知地点'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {formatCompactNumber(observation.likesCount || 0)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {formatCompactNumber(observation.commentsCount || 0)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {total > visibleObservations.length ? (
        <p className="mt-3 text-xs text-muted-foreground">还有 {total - visibleObservations.length} 条观察记录。</p>
      ) : null}
    </div>
  )
}

function NaturalObservationProgressCard({
  progress,
  className,
  mobile = false,
  compact = false,
}: {
  progress: NaturalObservationProgressSummary | null
  className?: string
  mobile?: boolean
  compact?: boolean
}) {
  const allProgress = progress?.topicProgress.find((item) => item.topic === 'all') ?? null
  const observedCount = allProgress?.observedCount ?? progress?.uniqueSpeciesCount ?? 0
  const totalSpecies = allProgress?.total ?? 0
  const progressPercent = allProgress?.progressPercent ?? 0

  if (!progress) {
    return null
  }

  return (
    <section
      className={cn(
        mobile ? 'profile-mobile-panel p-4' : 'surface-panel rounded-lg',
        !mobile && compact ? 'p-5' : !mobile && 'p-6',
        className,
      )}
    >
      {mobile ? (
        <MobileProfileSectionTitle title="自然观察进度" actionHref="/nature/species" actionLabel="查看清单" />
      ) : (
        <SectionTitle iconName="observation" title="自然观察进度" actionHref="/nature/species" actionLabel="查看物种清单" />
      )}

      <div className={cn(compact ? 'mt-4' : 'mt-2')}>
        <div className={cn('flex items-baseline justify-between', compact && 'gap-4')}>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-muted-foreground">已观察</span>
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {observedCount.toLocaleString()}
              {totalSpecies > 0 ? <span className="text-sm font-medium text-muted-foreground"> / {totalSpecies.toLocaleString()}</span> : null}
            </span>
          </div>
          <span className="rounded-full bg-[hsl(var(--brand-green)/0.12)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-green))]">
            {progressPercent}%
          </span>
        </div>
        <div
          className={cn(
            'mb-1 mt-3 overflow-hidden rounded-full bg-[hsl(var(--surface-border))]',
            compact ? 'h-2' : 'h-1.5',
          )}
          role="progressbar"
          aria-label={`自然观察进度，已观察 ${observedCount.toLocaleString()} / ${totalSpecies.toLocaleString()} 种，${progressPercent}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--brand-green)),hsl(var(--brand-blue)))]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </section>
  )
}

function ProfileStarterHub() {
  return (
    <section className="surface-panel overflow-hidden rounded-lg">
      <div className="grid gap-0 md:grid-cols-[minmax(0,200px)_1fr]">
        <div className="relative flex min-h-[140px] items-center justify-center bg-[linear-gradient(160deg,hsl(var(--brand-blue)/0.12),hsl(var(--brand-green)/0.08))] px-6 py-6 dark:bg-[linear-gradient(160deg,hsl(var(--surface-muted)),hsl(var(--surface-raised)))]">
          <span className="relative grid h-[120px] w-full max-w-[180px] place-items-center">
            <span className="absolute h-24 w-24 rounded-full bg-[hsl(var(--brand-blue)/0.12)] blur-xl" />
            <span className="relative grid h-24 w-24 place-items-center rounded-xl border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--surface-raised)/0.76)] shadow-[0_18px_38px_-28px_hsl(var(--surface-shadow)/0.35)]">
              <Rocket className="h-11 w-11 text-[hsl(var(--brand-blue))]" strokeWidth={2.2} />
            </span>
          </span>
        </div>
        <div className="flex flex-col justify-center gap-4 p-6">
          <div>
            <span className="inline-flex rounded-full bg-[hsl(var(--brand-blue)/0.12)] px-2.5 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
              新手出发
            </span>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-foreground">从这里点亮你的探索档案</h3>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              一次小实验、一张观察照片，都会让个人主页变成真正属于你的成长记录。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/project" className={cn('profile-soft-cta', 'h-10 px-5 text-sm font-semibold')}>
              <Rocket className="h-4 w-4" />
              发布第一个项目
            </Link>
            <Link
              href="/nature/submit"
              className="profile-success-cta h-10"
            >
              <Leaf className="h-4 w-4" />
              记录第一只鸟
            </Link>
          </div>
          <Link
            href="/create"
            className="inline-flex w-fit items-center gap-0.5 text-sm font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.85)]"
          >
            去参加社区挑战
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

    </section>
  )
}

function EmptyBlock({
  icon: Icon,
  iconName,
  title,
  description,
  href,
  action,
  density = 'default',
  mobile = false,
}: {
  icon: LucideIcon
  iconName?: ProfileIconName
  title: string
  description: string
  href: string
  action: string
  density?: 'default' | 'compact'
  mobile?: boolean
}) {
  const compact = density === 'compact'

  return (
    <div
      className={cn(
        'mt-4 flex flex-col justify-between text-left',
        mobile
          ? 'min-h-[168px] items-center rounded-md bg-[hsl(var(--surface-muted)/0.35)] px-4 py-5 text-center'
          : cn('surface-subtle', compact ? 'min-h-0 gap-3 px-4 py-3' : 'min-h-[178px] px-4 py-4'),
      )}
    >
      <div className={cn('flex items-start gap-3', mobile && 'flex-col items-center')}>
        {iconName ? (
          <ProfileImageIcon name={iconName} className={mobile ? 'h-14 w-14' : compact ? 'h-10 w-10' : 'h-12 w-12'} />
        ) : (
          <span
            className={cn(
              'grid shrink-0 place-items-center rounded-lg bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]',
              mobile ? 'h-14 w-14' : compact ? 'h-10 w-10' : 'h-12 w-12',
            )}
          >
            <Icon className={mobile ? 'h-7 w-7' : compact ? 'h-5 w-5' : 'h-6 w-6'} />
          </span>
        )}
        <div className={cn('min-w-0', mobile && 'text-center')}>
          {!compact && !mobile ? (
            <span className="inline-flex rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
              下一步任务
            </span>
          ) : null}
          <h3 className={cn('font-semibold text-foreground', mobile ? 'mt-2 text-sm' : compact ? 'mt-0 text-sm' : 'mt-2 text-base')}>{title}</h3>
          <p className={cn('text-muted-foreground', mobile ? 'mt-1.5 text-xs leading-5' : compact ? 'mt-1 line-clamp-2 text-xs leading-5' : 'mt-1.5 text-sm leading-6')}>
            {description}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className={cn(
          mobile ? 'profile-mobile-empty-cta' : 'profile-soft-cta',
          'w-fit shrink-0',
          mobile ? 'mt-4' : compact ? 'mt-1 h-8 px-3 text-xs' : 'mt-4 h-9',
        )}
      >
        {action}
      </Link>
    </div>
  )
}
