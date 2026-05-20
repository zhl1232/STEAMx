'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useEffectEvent, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarCheck2,
  ChevronRight,
  Compass,
  Edit3,
  Eye,
  FolderOpen,
  Heart,
  Library,
  Leaf,
  MessageCircle,
  Radar,
  Rocket,
  Settings,
  ShoppingBag,
  Sparkles,
  Trophy,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { BadgeIcon } from '@/components/features/gamification/badge-icon'
import { GrowthTasksGraduatedCard } from '@/components/features/profile/growth-tasks-graduated-card'
import { GrowthTaskRow } from '@/components/features/profile/growth-task-row'
import { StudyCheckInCard } from '@/components/features/profile/study-check-in-card'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { MobileGlobalHeader } from '@/components/layout/mobile-global-header'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { RoleBadge } from '@/components/ui/role-badge'
import { useAuth } from '@/lib/context/auth-context'
import { BADGES, useGamification } from '@/lib/context/gamification-context'
import { useNotifications, type Notification } from '@/lib/context/notification-context'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { logger } from '@/lib/logger'
import type { ObservationEvent, Project } from '@/lib/mappers/types'
import { getNotificationTargetHref } from '@/lib/notifications/navigation'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import type { GrowthTaskId, ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import { getCompletedGrowthTaskCount, resolveGrowthTasks, toGrowthTaskInput } from '@/lib/profile/growth-tasks'
import {
  type ProfileStudyCheckInSummary,
  type StudyCheckInLoadState,
} from '@/lib/profile/study-checkin'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { getNameColorClassName } from '@/lib/shop/items'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'
import { profileHomeQueryKey, useProfilePageData } from '@/hooks/profile/use-profile-page-data'
import { useToast } from '@/hooks/use-toast'
import { invalidateProfileHomeData } from '@/lib/profile/profile-home-client'

const SteamRadarChart = dynamic(
  () => import('@/components/features/profile/steam-radar-chart').then((mod) => mod.SteamRadarChart),
  {
    loading: () => <div className="surface-panel min-h-[320px] rounded-[28px]" />,
  },
)

const PROFILE_HERO_IMAGE = '/assets/profile-hero-explorer-v4.webp'
const PROFILE_LEVEL_BADGE_IMAGE = '/assets/profile-generated/level-medal.png'
const RECOMMENDED_CHALLENGE_IMAGE = '/projects/generated/project-0008.webp'
const EMPTY_STATE_IMAGE_SRC = {
  emptyProjects: '/assets/profile-generated/empty-project-lab.png',
  observation: '/assets/profile-generated/empty-observation.png',
  community: '/assets/profile-generated/empty-community.png',
} as const

/** 卡片内引导操作：浅底 + 描边，避免与头图「我的内容」主按钮抢视觉层级（见 globals `.profile-soft-cta`） */

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
  const { unreadCount } = useNotifications()
  const {
    data: profileHomeData,
    isPending: isProfileHomePending,
    isError: isProfileHomeError,
  } = useProfilePageData(user?.id)
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null)
  const [growthGraduationSparkle, setGrowthGraduationSparkle] = useState(false)
  const [claimingTaskId, setClaimingTaskId] = useState<GrowthTaskId | null>(null)

  const showLoadError = useEffectEvent((description: string) => {
    toast({
      title: '加载失败',
      description,
      variant: 'destructive',
    })
  })

  const myProjects = profileHomeData?.myProjects ?? []
  const myProjectsTotalCount = profileHomeData?.myProjectsTotalCount ?? 0
  const followerCount = profileHomeData?.followerCount ?? 0
  const followingCount = profileHomeData?.followingCount ?? 0
  const totalLikesReceived = profileHomeData?.totalLikesReceived ?? 0
  const steamRadar = profileHomeData?.steamRadar ?? null
  const myObservations = profileHomeData?.myObservations ?? []
  const observationsTotal = profileHomeData?.observationsTotal ?? 0
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

      if (payload?.graduated) {
        setGrowthGraduationSparkle(true)
        window.setTimeout(() => setGrowthGraduationSparkle(false), 600)
      }

      await refreshProfile()
      if (user?.id) {
        invalidateProfileHomeData(user.id)
        await queryClient.invalidateQueries({ queryKey: profileHomeQueryKey(user.id) })
      }

      if (payload?.graduated) {
        void refetchStats()
        toast({
          title: '成长任务全部完成',
          description: '解锁「探索启程」徽章，开启下一段冒险吧',
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
    { key: 'works', label: '作品', value: myProjectsTotalCount, href: '/profile/library', icon: 'projects' },
    { key: 'followers', label: '粉丝', value: followerCount, href: '/profile/followers', icon: 'followers' },
    { key: 'following', label: '关注', value: followingCount, href: '/profile/following', icon: 'following' },
    { key: 'likes', label: '获赞', value: totalLikesReceived, href: '/profile/likes', icon: 'likes' },
  ]
  const resolvedGrowthTasks = growthTasks ?? fallbackGrowthTasks
  const completedTaskCount = getCompletedGrowthTaskCount(resolvedGrowthTasks)

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
    growthTasksGraduatedAt,
    growthGraduationSparkle,
    completedTaskCount,
    claimingTaskId,
    onClaimGrowthTask: handleClaimGrowthTask,
    featuredBadges,
    unlockedBadges,
    userBadgeDetails,
    myProjects,
    steamRadar,
    myObservations,
    observationsTotal,
    studyCheckInSummary,
    studyCheckInState,
    profileTimelineEvents,
    profile,
  }

  return isDesktopViewport ? (
    <DesktopProfilePage {...pageData} />
  ) : (
    <MobileProfilePage {...pageData} unreadCount={unreadCount} />
  )
}

function DesktopProfilePage({
  profileContext,
  stats,
  growthTasks,
  growthTasksGraduatedAt,
  growthGraduationSparkle,
  completedTaskCount,
  claimingTaskId,
  onClaimGrowthTask,
  featuredBadges,
  unlockedBadges,
  userBadgeDetails,
  myProjects,
  steamRadar,
  myObservations,
  observationsTotal,
  studyCheckInSummary,
  studyCheckInState,
  profileTimelineEvents,
  profile,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  growthTasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  growthGraduationSparkle: boolean
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaimGrowthTask: (taskId: GrowthTaskId) => void
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  userBadgeDetails: Map<string, { unlockedAt: string }>
  myProjects: Project[]
  steamRadar: SteamRadarWithGuidance | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  studyCheckInSummary: ProfileStudyCheckInSummary | null
  studyCheckInState: StudyCheckInLoadState
  profileTimelineEvents: ProfileTimelineEvent[] | null
  profile: ReturnType<typeof useAuth>['profile']
}) {
  const isExploreVacuum = !steamRadar && myProjects.length === 0 && myObservations.length === 0

  return (
    <div className="min-h-screen bg-background pb-10 text-foreground">
      <div className="app-shell-wide py-4 min-[390px]:px-5 min-[390px]:py-5 md:px-8 md:py-6">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 min-w-0 space-y-6 xl:col-span-8">
            <ProfileHero
              profileContext={profileContext}
              stats={stats}
              profile={profile}
              compact={false}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <ExperienceBadgesPanel
                profileContext={profileContext}
                featuredBadges={featuredBadges}
                unlockedBadges={unlockedBadges}
                userBadgeDetails={userBadgeDetails}
                className={cn(isExploreVacuum && 'lg:col-span-2')}
              />

              {!isExploreVacuum ? (
                <section className="surface-panel flex min-h-[260px] flex-col rounded-[20px] p-6 lg:min-h-[300px]">
                  <SectionTitle iconName="timeline" title="STEAM 能力雷达" />
                  {steamRadar ? (
                    <SteamRadarChart
                      initialRadar={steamRadar}
                      showHeader={false}
                      className="mt-3 flex-1 border-0 bg-transparent p-0 shadow-none [&>div:first-of-type]:min-h-[200px] [&>p]:line-clamp-2"
                    />
                  ) : (
                    <SteamRadarEmptyPlaceholder />
                  )}
                </section>
              ) : null}
            </div>

            {isExploreVacuum ? (
              <ProfileStarterHub />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <section className="surface-panel rounded-[20px] p-6">
                  <SectionTitle iconName="projects" title="我的项目 / 作品" actionHref="/profile/library" actionLabel="查看全部" />
                  <ProjectShowcase projects={myProjects} emptyDensity="compact" />
                </section>

                <section className="surface-panel rounded-[20px] p-6">
                  <SectionTitle iconName="observation" title="最近观察记录" actionHref="/nature/observations" actionLabel="查看全部" />
                  <ObservationList observations={myObservations} total={observationsTotal} emptyDensity="compact" />
                </section>
              </div>
            )}

            <LearningTimeline events={profileTimelineEvents} />
          </div>

          <aside className="col-span-12 min-w-0 space-y-6 xl:col-span-4">
            <GrowthTasksPanel
              tasks={growthTasks}
              growthTasksGraduatedAt={growthTasksGraduatedAt}
              growthGraduationSparkle={growthGraduationSparkle}
              completedTaskCount={completedTaskCount}
              claimingTaskId={claimingTaskId}
              onClaim={onClaimGrowthTask}
            />
            <StudyCheckInPanel studyCheckInSummary={studyCheckInSummary} studyCheckInState={studyCheckInState} />
            <RecommendedChallengePanel />
            <CommunityFeedPanel
              projects={myProjects}
              compactEmpty={isExploreVacuum}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

function MobileProfilePage({
  profileContext,
  stats,
  growthTasks,
  growthTasksGraduatedAt,
  growthGraduationSparkle,
  completedTaskCount,
  claimingTaskId,
  onClaimGrowthTask,
  featuredBadges,
  unlockedBadges,
  myProjects,
  steamRadar,
  myObservations,
  observationsTotal,
  profileTimelineEvents,
  unreadCount,
  profile,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  growthTasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  growthGraduationSparkle: boolean
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaimGrowthTask: (taskId: GrowthTaskId) => void
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  myProjects: Project[]
  steamRadar: SteamRadarWithGuidance | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  profileTimelineEvents: ProfileTimelineEvent[] | null
  unreadCount: number
  profile: ReturnType<typeof useAuth>['profile']
}) {
  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground">
      <MobileGlobalHeader
        variant="title"
        title="我的"
        showNotification={false}
        showUserButton={false}
        rightSlot={
          <>
            <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 shrink-0">
              <Link href="/messages" aria-label="消息">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-5 text-destructive-foreground">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Link href="/settings" aria-label="设置">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </>
        }
      />
      <div className="px-4 pb-4">
        <ProfileHero
          profileContext={profileContext}
          stats={stats}
          profile={profile}
          compact
        />
      </div>

      <div className="space-y-4 px-4">
        <MobileActionGrid />

        <div className="grid grid-cols-2 gap-3">
          <section className="surface-panel min-h-[164px] p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">经验与等级</p>
              <LevelGuideDialog>
                <button
                  type="button"
                  className="inline-flex min-h-7 shrink-0 items-center gap-0.5 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  规则
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </LevelGuideDialog>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <span className="text-3xl font-extrabold text-[hsl(var(--brand-blue))]">
                Lv.{profileContext.level}
              </span>
              <span className="pb-1 text-xs font-semibold text-muted-foreground">{profileContext.levelTitle}</span>
            </div>
            <div className="mt-5">
              <LevelProgress showLabel={false} />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              {profileContext.xpIntoLevel.toLocaleString()} / {profileContext.xpNeededThisLevel.toLocaleString()}
            </p>
          </section>

          <section className="surface-panel min-h-[164px] p-4">
            <p className="text-sm font-semibold text-foreground">STEAM 能力雷达</p>
            {steamRadar ? (
              <MiniRadarPreview radar={steamRadar} />
            ) : (
              <div className="mt-6 text-xs leading-5 text-muted-foreground">
                完成项目后生成能力图谱。
              </div>
            )}
          </section>
        </div>

        <section id="profile-badges-anchor" className="surface-panel p-4">
          <SectionTitle iconName="achievement" title="最近获得的徽章" actionHref="/badges-preview" actionLabel="全部徽章" />
          <BadgeShowcase badges={featuredBadges} unlockedBadges={unlockedBadges} compact />
        </section>

        <GrowthTasksPanel
          tasks={growthTasks}
          growthTasksGraduatedAt={growthTasksGraduatedAt}
          growthGraduationSparkle={growthGraduationSparkle}
          completedTaskCount={completedTaskCount}
          claimingTaskId={claimingTaskId}
          onClaim={onClaimGrowthTask}
        />

        <LearningTimeline events={profileTimelineEvents} compact />

        <section className="surface-panel p-4">
          <SectionTitle iconName="projects" title="我的项目 / 作品" actionHref="/profile/library" actionLabel="查看全部" />
          <ProjectShowcase projects={myProjects} mobile />
        </section>

        <section className="surface-panel p-4">
          <SectionTitle iconName="observation" title="最近观察记录" actionHref="/nature/observations" actionLabel="查看全部" />
          <ObservationList observations={myObservations} total={observationsTotal} mobile />
        </section>
      </div>
    </div>
  )
}

function ProfileHero({
  profileContext,
  stats,
  profile,
  compact,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  profile: ReturnType<typeof useAuth>['profile']
  compact: boolean
}) {
  return (
    <section className={cn('surface-panel relative overflow-hidden', compact ? 'rounded-[var(--radius-lg)]' : 'min-h-[270px] rounded-[20px]')}>
      <div className="absolute inset-0">
        <OptimizedImage
          src={PROFILE_HERO_IMAGE}
          alt=""
          fill
          priority
          variant="cover"
          className={cn(compact ? 'object-cover object-[68%_center]' : 'object-contain object-right-bottom')}
        />
        <div
          className={cn(
            'absolute inset-0',
            compact
              ? 'bg-[linear-gradient(90deg,hsl(var(--background)/0.96)_0%,hsl(var(--background)/0.82)_54%,hsl(var(--background)/0.18)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--background)/0.96)_0%,hsl(var(--background)/0.86)_42%,hsl(var(--background)/0.34)_100%)]'
              : 'bg-[linear-gradient(90deg,hsl(var(--background)/0.98)_0%,hsl(var(--background)/0.92)_38%,hsl(var(--surface-muted)/0.72)_72%,hsl(var(--background)/0.22)_100%)] dark:bg-[linear-gradient(90deg,hsl(var(--background)/0.96)_0%,hsl(var(--background)/0.86)_42%,hsl(var(--background)/0.34)_100%)]',
          )}
        />
        {!compact ? (
          <div className="absolute inset-y-0 right-0 w-[48%] bg-[linear-gradient(270deg,hsl(var(--brand-blue)/0.18)_0%,hsl(var(--brand-blue)/0.08)_56%,transparent_100%)] dark:hidden" />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--surface-muted)/0.34),transparent_58%)]" />
      </div>

      <div className={cn('relative', compact ? 'px-5 pb-4 pt-5' : 'px-7 pb-0 pt-7')}>
        <div className={cn('flex gap-6', compact ? 'flex-col' : 'min-h-[156px] flex-wrap items-start')}>
          <div className={cn('flex items-center gap-5', compact ? '' : 'min-w-0 md:min-w-[420px] xl:min-w-[520px]')}>
            <div className="relative shrink-0">
              <AvatarWithFrame
                src={profileContext.userAvatar}
                alt={profileContext.userName}
                fallback={getInitial(profileContext.userName)}
                avatarFrameId={profile?.equipped_avatar_frame_id}
                className={cn(
                  'border-[5px] border-background shadow-[0_24px_70px_-34px_rgba(17,65,125,0.6)]',
                  compact ? 'h-[88px] w-[88px]' : 'h-[112px] w-[112px]',
                )}
                avatarClassName="rounded-full object-cover"
              />
              <LevelGuideDialog>
                <button
                  type="button"
                  className="absolute -bottom-1.5 left-1/2 inline-flex min-h-7 -translate-x-1/2 items-center gap-1 rounded-full border border-[hsl(var(--brand-blue)/0.24)] bg-[hsl(var(--surface-raised)/0.96)] px-3 text-xs font-bold text-[hsl(var(--brand-blue))] shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Lv.{profileContext.level}
                </button>
              </LevelGuideDialog>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {profile?.role && profile.role !== 'user' ? <RoleBadge role={profile.role} size="md" /> : null}
                <span className="rounded-full border border-[hsl(var(--brand-blue)/0.2)] bg-[hsl(var(--brand-blue)/0.1)] px-2.5 py-1 text-xs font-bold text-[hsl(var(--brand-blue))]">
                  {profileContext.levelTitle}
                </span>
              </div>
              <div className={cn('mt-2 flex min-w-0 items-center gap-2', compact ? 'pr-1' : '')}>
                <h2
                  className={cn(
                    'min-w-0 flex-1 truncate font-semibold tracking-normal text-foreground',
                    compact ? 'text-[26px]' : 'text-[30px]',
                    getNameColorClassName(profile?.equipped_name_color_id ?? null),
                  )}
                >
                  {profileContext.userName}
                </h2>
                {compact ? (
                  <EditProfileDialog>
                    <button
                      type="button"
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.88)] px-3 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-md transition hover:bg-[hsl(var(--surface-muted)/0.75)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      aria-label="编辑资料"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span className="ml-1 hidden min-[360px]:inline">编辑</span>
                    </button>
                  </EditProfileDialog>
                ) : null}
              </div>
              <p className={cn('mt-2 text-muted-foreground', compact ? 'line-clamp-2 text-sm leading-6' : 'max-w-2xl text-sm leading-7')}>
                {profile?.bio || '热爱科学与创造，喜欢用动手实践探索世界的奥秘。'}
              </p>
              {!compact ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.72)] px-3 py-1.5">
                      <Compass className="h-3.5 w-3.5 text-[hsl(var(--brand-blue))]" />
                      STEAM 探索者
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.72)] px-3 py-1.5">
                      <CalendarCheck2 className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" />
                      加入时间：{profileContext.joinedAt}
                    </span>
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button asChild className="h-11 rounded-[20px] bg-[hsl(var(--brand-blue))] px-5 text-sm font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_18px_40px_-24px_hsl(var(--brand-blue)/0.8)] hover:bg-[hsl(var(--brand-blue)/0.92)]">
                      <Link href="/profile/library">
                        <Library className="mr-2 h-4 w-4" />
                        我的内容
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-[20px] border-[hsl(var(--brand-green)/0.28)] bg-[hsl(var(--surface-raised)/0.72)] px-4 text-sm font-bold text-[hsl(var(--brand-green))] hover:bg-[hsl(var(--brand-green)/0.1)]">
                      <Link href="/coins">
                        <WalletCards className="mr-2 h-4 w-4" />
                        我的钱包
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 rounded-[20px] border-[hsl(var(--brand-amber)/0.32)] bg-[hsl(var(--surface-raised)/0.72)] px-4 text-sm font-bold text-[hsl(var(--brand-amber))] hover:bg-[hsl(var(--brand-amber)/0.12)]">
                      <Link href="/shop">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        创客商店
                      </Link>
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            'grid grid-cols-3 overflow-hidden',
            compact
              ? 'mt-5 rounded-2xl border border-white/35 bg-white/10 shadow-[0_18px_48px_-34px_hsl(var(--surface-shadow)/0.62)] backdrop-blur-md dark:border-[hsl(var(--surface-border-strong))] dark:bg-background/60'
              : 'profile-stats-bar mt-8',
          )}
        >
          {stats.map((stat, index) => (
            <ProfileStatTile key={stat.key} stat={stat} compact={compact} bordered={index > 0} />
          ))}
        </div>
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
        'group flex items-center justify-center transition hover:bg-[hsl(var(--surface-muted)/0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
        compact
          ? 'min-h-[60px] flex-col justify-center gap-0.5 px-1.5 py-2.5 text-center'
          : 'min-h-[60px] gap-3 px-4 py-3.5',
        bordered &&
          (compact
            ? 'border-l border-white/24 dark:border-[hsl(var(--surface-border-strong))]'
            : 'border-l border-[hsl(var(--surface-border))]'),
      )}
    >
      {!compact ? <ProfileImageIcon name={stat.icon} variant="heroStat" className="h-10 w-10" /> : null}
      <span className={compact ? 'block' : 'min-w-0'}>
        <span className={cn('block font-semibold tabular-nums text-foreground', compact ? 'text-lg leading-6' : 'text-xl')}>
          {formatCompactNumber(stat.value)}
        </span>
        <span className={cn('block text-muted-foreground', compact ? 'text-[11px] font-medium' : 'mt-0.5 text-xs font-medium')}>
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
}: {
  name: ProfileIconName
  className?: string
  variant?: 'module' | 'heroStat' | 'timeline'
}) {
  const { icon: Icon, tone } = PROFILE_ICON_META[name]
  const toneClassName = {
    blue: 'bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]',
    green: 'bg-[hsl(var(--brand-green)/0.1)] text-[hsl(var(--brand-green))]',
    amber: 'bg-[hsl(var(--brand-amber)/0.13)] text-[hsl(var(--brand-amber))]',
    rose: 'bg-rose-500/10 text-rose-500',
    violet: 'bg-violet-500/10 text-violet-500',
  }[tone]

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-[20px]',
        variant === 'heroStat'
          ? 'bg-[hsl(var(--brand-blue)/0.08)] text-[hsl(var(--brand-blue))] ring-1 ring-[hsl(var(--brand-blue)/0.35)] shadow-sm dark:bg-white/20 dark:text-white dark:ring-white/28'
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
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
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

function MiniRadarPreview({ radar }: { radar: SteamRadarWithGuidance }) {
  const values = MINI_RADAR_DIMENSIONS.map((dim) => Number(radar[dim.key]?.display || 0))
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
  const points = values
    .map((value, index) => {
      const angle = (-90 + index * 72) * (Math.PI / 180)
      const radius = 10 + (Math.min(100, Math.max(0, value)) / 100) * 34
      const x = 50 + Math.cos(angle) * radius
      const y = 50 + Math.sin(angle) * radius
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const outerPoints = MINI_RADAR_DIMENSIONS
    .map((_, index) => {
      const angle = (-90 + index * 72) * (Math.PI / 180)
      return `${(50 + Math.cos(angle) * 44).toFixed(1)},${(50 + Math.sin(angle) * 44).toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="mt-3 grid grid-cols-[92px_minmax(0,1fr)] items-center gap-2">
      <svg viewBox="0 0 100 100" className="h-[92px] w-[92px]" aria-hidden="true">
        <polygon points={outerPoints} fill="none" stroke="hsl(var(--surface-border))" strokeWidth="1.2" />
        <polygon points={points} fill="hsl(var(--brand-blue) / 0.18)" stroke="hsl(var(--brand-blue))" strokeWidth="2" />
        {MINI_RADAR_DIMENSIONS.map((_, index) => {
          const angle = (-90 + index * 72) * (Math.PI / 180)
          return (
            <line
              key={index}
              x1="50"
              y1="50"
              x2={(50 + Math.cos(angle) * 44).toFixed(1)}
              y2={(50 + Math.sin(angle) * 44).toFixed(1)}
              stroke="hsl(var(--surface-border))"
              strokeWidth="0.8"
            />
          )
        })}
      </svg>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-[hsl(var(--brand-blue))]">{average}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">综合能力均值</p>
      </div>
    </div>
  )
}

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
    <div className="mt-4 flex min-h-[200px] flex-1 flex-col items-center justify-center gap-4 rounded-[14px] bg-[hsl(var(--surface-muted)/0.45)] px-4 py-7 dark:bg-[hsl(var(--surface-muted)/0.35)]">
      <div className="relative mx-auto aspect-square w-[min(200px,88%)] max-w-[210px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full text-muted-foreground/55 dark:text-muted-foreground/45" aria-hidden>
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
      </div>
      <div className="max-w-xs px-1 text-center">
        <p className="text-sm font-semibold leading-snug text-muted-foreground">参与挑战，点亮你的能力雷达</p>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground/90">完成项目或挑战后，这里会显示你的 STEAM 五维图谱。</p>
      </div>
      <Link href="/explore" className={cn('profile-soft-cta', 'h-9 w-fit shrink-0')}>
        去探索项目
      </Link>
    </div>
  )
}

function MobileActionGrid() {
  const actions = [
    { label: '我的内容', href: '/profile/library', icon: Library, tone: 'text-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue)/0.12)]' },
    { label: '我的钱包', href: '/coins', icon: WalletCards, tone: 'text-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green)/0.12)]' },
    { label: '创客商店', href: '/shop', icon: ShoppingBag, tone: 'text-[hsl(var(--brand-amber))] bg-[hsl(var(--brand-amber)/0.14)]' },
  ]

  return (
    <section className="surface-panel grid grid-cols-3 gap-2 p-3 min-[390px]:gap-3">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link key={action.label} href={action.href} className="grid min-h-[78px] place-items-center gap-1.5 rounded-[16px] px-2 py-2.5 text-center transition hover:bg-[hsl(var(--surface-muted)/0.68)] min-[390px]:min-h-[86px] min-[390px]:gap-2 min-[390px]:py-3">
            <span className={cn('grid h-10 w-10 place-items-center rounded-[18px] min-[390px]:h-11 min-[390px]:w-11 min-[390px]:rounded-[20px]', action.tone)}>
              <Icon className="h-5 w-5 min-[390px]:h-6 min-[390px]:w-6" />
            </span>
            <span className="text-xs font-bold text-foreground">{action.label}</span>
          </Link>
        )
      })}
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
    <div className={cn('mt-4 flex', compact ? 'justify-between gap-4' : 'flex-wrap gap-3')}>
      {badges.map((badge) => (
        <div key={badge.id} className={cn('flex flex-col items-center text-center', compact ? 'min-w-[58px]' : 'w-[68px]')}>
          <BadgeIcon
            icon={badge.icon}
            tier={badge.tier}
            seriesKey={badge.seriesKey}
            size={compact ? 'md' : 'lg'}
            className={compact ? 'h-11 w-11' : 'h-12 w-12'}
            showGlow={false}
            locked={!unlockedBadges.has(badge.id)}
          />
          <span className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-foreground/84">{badge.name}</span>
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
      className={cn('surface-panel flex flex-col overflow-hidden rounded-[20px] p-6', className)}
    >
      <SectionTitle
        iconName="achievement"
        title="经验与等级"
        actionSlot={(
          <LevelGuideDialog>
            <button
              type="button"
              className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.82)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              查看规则
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </LevelGuideDialog>
        )}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_108px]">
        <div className="min-w-0">
          <div className="flex items-end gap-3">
            <span className="text-[34px] font-extrabold leading-none text-[hsl(var(--brand-blue))]">
              Lv.{profileContext.level}
            </span>
            <span className="pb-1 text-sm font-semibold text-foreground">{profileContext.levelTitle}</span>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-muted-foreground">
                经验值 {profileContext.xpIntoLevel.toLocaleString()} / {profileContext.xpNeededThisLevel.toLocaleString()}
              </span>
              <span className="font-medium text-[hsl(var(--brand-blue))]">{levelProgressPercent}%</span>
            </div>
            <LevelProgress showLabel={false} />
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            再获得 {remainingXP.toLocaleString()} 经验值即可进入下一等级。
          </p>
        </div>

        <div className="relative min-h-[108px] overflow-visible">
          <OptimizedImage
            src={PROFILE_LEVEL_BADGE_IMAGE}
            alt=""
            fill
            variant="thumbnail"
            className="object-contain drop-shadow-[0_18px_26px_rgba(15,23,42,0.22)]"
          />
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
}: {
  studyCheckInSummary: ProfileStudyCheckInSummary | null
  studyCheckInState: StudyCheckInLoadState
  className?: string
}) {
  return (
    <StudyCheckInCard
      title={<SectionTitle iconName="progress" title="探索打卡" />}
      summary={studyCheckInSummary}
      state={studyCheckInState}
      className={className}
    />
  )
}

function RecommendedChallengePanel() {
  return (
    <section className="surface-panel rounded-[20px] p-6">
      <SectionTitle iconName="emptyProjects" title="推荐下一步挑战" actionHref="/community?tab=challenges" actionLabel="查看全部" />
      <Link href="/community?tab=challenges" className="surface-card mt-4 grid grid-cols-[106px_minmax(0,1fr)] gap-3 p-3 transition hover:border-[hsl(var(--surface-border-strong))] hover:bg-[hsl(var(--surface-muted)/0.82)]">
        <div className="relative min-h-[108px] overflow-hidden rounded-[10px] bg-[hsl(var(--surface-border))]">
          <OptimizedImage src={RECOMMENDED_CHALLENGE_IMAGE} alt="纸飞机飞行距离挑战赛" fill variant="thumbnail" className="object-cover" />
        </div>
        <div className="min-w-0 py-1 pr-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">纸飞机飞行距离挑战赛</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[hsl(var(--brand-blue)/0.12)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-blue))]">限时挑战</span>
            <span className="rounded-full bg-[hsl(var(--brand-amber)/0.14)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--brand-amber))]">剩余 5 天</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <UsersRound className="h-3.5 w-3.5" />
              1,258 人参与
            </span>
            <span className={cn('profile-soft-cta', 'h-8 shrink-0 px-3 text-xs font-semibold')}>去参与</span>
          </div>
        </div>
      </Link>
    </section>
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
    <section className={cn('surface-panel rounded-[20px] p-6', className)}>
      <SectionTitle iconName="community" title="最近通知" actionHref="/messages" actionLabel="查看全部" />
      {notifications === null ? (
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-[12px] p-1.5">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-11 w-[52px] animate-pulse rounded-[10px] bg-muted" />
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
              <Link key={notification.id} href={href} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-[12px] p-1.5 transition hover:bg-[hsl(var(--surface-muted)/0.68)]">
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
                <span className="relative h-11 w-[52px] overflow-hidden rounded-[10px] bg-[hsl(var(--surface-muted))]">
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
        <p className="mt-3 rounded-[12px] border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.35)] px-3 py-2.5 text-center text-xs leading-5 text-muted-foreground">
          {loadFailed ? '最近通知暂时加载失败。' : '还没有通知，去社区互动后会出现在这里。'}
          <Link href="/community" className="ml-1 font-bold text-[hsl(var(--brand-blue))]">
            去社区看看
          </Link>
        </p>
      ) : (
        <EmptyBlock
          icon={MessageCircle}
          iconName="community"
          title={loadFailed ? '通知加载失败' : '还没有通知'}
          description={loadFailed ? '请稍后再查看，或前往消息中心刷新。' : '收到回复、喜欢、关注或打赏时，会在这里显示最近动态。'}
          href={loadFailed ? '/messages' : '/community'}
          action={loadFailed ? '去消息中心' : '去社区互动'}
          density="compact"
        />
      )}
    </section>
  )
}

function LearningTimeline({
  events,
  className,
  compact = false,
}: {
  events: ProfileTimelineEvent[] | null
  className?: string
  compact?: boolean
}) {
  const visibleEvents = events ? [...events].reverse() : []

  return (
    <section className={cn('surface-panel rounded-[20px] p-6', className)}>
      <SectionTitle iconName="timeline" title="探索轨迹" actionHref="/profile/timeline" actionLabel="查看详情" />
      {events === null ? (
        <div className="mt-5 flex min-h-[118px] items-center gap-3 rounded-[14px] border border-dashed border-[hsl(var(--surface-border))] px-4 text-sm font-medium text-muted-foreground">
          <ProfileImageIcon name="timeline" className="h-10 w-10" />
          正在同步真实轨迹
        </div>
      ) : visibleEvents.length === 0 ? (
        <EmptyBlock
          icon={Radar}
          iconName="timeline"
          title="还没有探索轨迹"
          description="发布作品、完成项目或提交观察后，这里会显示真实记录。"
          href="/explore"
          action="去探索项目"
          density="compact"
        />
      ) : (
        <div
          className={cn('mt-5 grid gap-2', compact && 'gap-1.5')}
          style={{ gridTemplateColumns: `repeat(${visibleEvents.length}, minmax(0, 1fr))` }}
        >
          {visibleEvents.map((item, index) => {
            const detailParts = [
              item.detail,
              item.statusLabel,
              item.xpAmount ? `+${item.xpAmount} XP` : null,
            ].filter(Boolean)
            const content = (
              <>
                {index > 0 ? (
                  <span className="absolute left-[-50%] top-5 h-0.5 w-full bg-[hsl(var(--surface-border))]" aria-hidden="true" />
                ) : null}
                <ProfileImageIcon
                  name={item.iconName}
                  variant="timeline"
                  className={cn('relative z-10 mx-auto h-11 w-11', item.status === 'rejected' && 'opacity-70 grayscale')}
                />
                <span className="mt-2 block text-xs font-semibold text-muted-foreground">{item.dateLabel}</span>
                <span className="mt-1 block truncate text-xs font-bold text-foreground">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detailParts.join(' / ')}</span>
              </>
            )

            return item.href ? (
              <Link key={item.id} href={item.href} className="relative min-w-0 rounded-[12px] px-1 pb-1 text-center transition hover:bg-[hsl(var(--surface-muted)/0.68)]">
                {content}
              </Link>
            ) : (
              <div key={item.id} className="relative min-w-0 px-1 pb-1 text-center">
                {content}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function GrowthTasksPanel({
  tasks,
  growthTasksGraduatedAt,
  growthGraduationSparkle,
  completedTaskCount,
  claimingTaskId,
  onClaim,
}: {
  tasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  growthGraduationSparkle: boolean
  completedTaskCount: number
  claimingTaskId: GrowthTaskId | null
  onClaim: (taskId: GrowthTaskId) => void
}) {
  if (growthTasksGraduatedAt) {
    return (
      <GrowthTasksGraduatedCard
        tasks={tasks}
        showSparkle={growthGraduationSparkle}
        claimingTaskId={claimingTaskId}
        onClaim={onClaim}
      />
    )
  }

  return (
    <section className="surface-panel rounded-[20px] p-6">
      <SectionTitle iconName="growth" title={`成长任务（${completedTaskCount}/5）`} />
      <div className="mt-5 space-y-3">
        {tasks.map((task) => (
          <GrowthTaskRow
            key={task.id}
            task={task}
            claimPending={claimingTaskId === task.id}
            onClaim={onClaim}
          />
        ))}
      </div>
    </section>
  )
}

function ProjectShowcase({
  projects,
  mobile = false,
  emptyDensity = 'default',
}: {
  projects: Project[]
  mobile?: boolean
  emptyDensity?: 'default' | 'compact'
}) {
  if (projects.length === 0) {
    return (
      <EmptyBlock
        icon={Rocket}
        iconName="emptyProjects"
        title="你的创意实验室空空如也"
        description="把今天完成的小实验、模型或观察整理成作品，点亮你的第一个展示位。"
        href="/project"
        action="启动第一个 STEAM 项目"
        density={emptyDensity}
      />
    )
  }

  const visibleProjects = projects.slice(0, mobile ? 6 : 8)

  return (
    <div className={cn('mt-4', mobile ? '-mx-1 overflow-x-auto px-1' : '')}>
      <div
        className={cn(
          mobile ? 'flex w-max gap-3 pb-1' : 'grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4',
        )}
      >
        {visibleProjects.map((project) => (
          <MiniProjectCard key={project.id} project={project} mobile={mobile} />
        ))}
      </div>
    </div>
  )
}

function MiniProjectCard({ project, mobile }: { project: Project; mobile: boolean }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className={cn(
        'surface-card group flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:border-[hsl(var(--surface-border-strong))] hover:shadow-md',
        mobile ? 'w-[176px]' : '',
      )}
    >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-[hsl(var(--surface-muted))]',
          mobile ? 'aspect-[16/10]' : 'aspect-[16/10]',
        )}
      >
        {project.image ? (
          <OptimizedImage
            src={project.image}
            alt={project.title}
            fill
            variant="card"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground/80">
            <FolderOpen className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col', mobile ? 'p-3' : 'px-3.5 pb-3 pt-2.5')}>
        <h3 className="truncate font-sans text-[13px] font-medium leading-snug tracking-tight text-foreground">
          {project.title}
        </h3>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[hsl(var(--surface-border))]/80 pt-2 text-[11px] tabular-nums text-muted-foreground">
          <span className="inline-flex w-full justify-end items-center gap-2 text-muted-foreground/90">
            <span className="inline-flex items-center gap-0.5">
              <Eye className="h-3 w-3 opacity-70" aria-hidden />
              {formatCompactNumber(project.views_count || 0)}
            </span>
            <span className="inline-flex items-center gap-0.5">
              <Heart className="h-3 w-3 opacity-70" aria-hidden />
              {formatCompactNumber(project.likes || 0)}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function ObservationList({
  observations,
  total,
  mobile = false,
  emptyDensity = 'default',
}: {
  observations: ObservationEvent[]
  total: number
  mobile?: boolean
  emptyDensity?: 'default' | 'compact'
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
      />
    )
  }

  const visibleObservations = observations.slice(0, mobile ? 4 : 5)

  return (
    <div className={cn('mt-4', mobile ? '-mx-1 overflow-x-auto px-1' : 'space-y-3')}>
      <div className={cn(mobile ? 'flex w-max gap-3 pb-1' : 'space-y-3')}>
        {visibleObservations.map((observation) => (
          <Link
            key={observation.id}
            href={`/nature/observations/${observation.id}`}
            className={cn('surface-card group block transition hover:bg-[hsl(var(--surface-muted)/0.82)]', mobile ? 'w-[172px] overflow-hidden' : 'p-4')}
          >
            <div className={cn('flex gap-3', mobile && 'block')}>
              <div className={cn('relative shrink-0 overflow-hidden rounded-[12px] bg-[hsl(var(--surface-border))]', mobile ? 'h-[92px] w-full rounded-none' : 'h-16 w-20')}>
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

function ProfileStarterHub() {
  return (
    <section className="surface-panel overflow-hidden rounded-[20px]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,200px)_1fr]">
        <div className="relative flex min-h-[140px] items-center justify-center bg-[linear-gradient(160deg,hsl(var(--brand-blue)/0.12),hsl(var(--brand-green)/0.08))] px-6 py-6 dark:bg-[linear-gradient(160deg,hsl(var(--surface-muted)),hsl(var(--surface-raised)))]">
          <span className="relative block h-[120px] w-full max-w-[180px]">
            <OptimizedImage
              src={EMPTY_STATE_IMAGE_SRC.emptyProjects}
              alt=""
              fill
              variant="thumbnail"
              className="object-contain drop-shadow-sm"
            />
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
            href="/community?tab=challenges"
            className="inline-flex w-fit items-center gap-0.5 text-sm font-bold text-[hsl(var(--brand-blue))] transition hover:text-[hsl(var(--brand-blue)/0.85)]"
          >
            去参加社区挑战
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <p className="border-t border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.35)] px-6 py-3 text-xs leading-5 text-muted-foreground dark:bg-muted/20">
        完成项目或挑战后，会解锁 STEAM 能力图谱与下方探索轨迹。
      </p>
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
}: {
  icon: LucideIcon
  iconName?: ProfileIconName
  title: string
  description: string
  href: string
  action: string
  density?: 'default' | 'compact'
}) {
  const imageSrc = iconName && iconName in EMPTY_STATE_IMAGE_SRC
    ? EMPTY_STATE_IMAGE_SRC[iconName as keyof typeof EMPTY_STATE_IMAGE_SRC]
    : null
  const compact = density === 'compact'

  return (
    <div
      className={cn(
        'surface-subtle mt-4 flex flex-col justify-between text-left',
        compact ? 'min-h-0 gap-3 px-4 py-3' : 'min-h-[178px] px-4 py-4',
      )}
    >
      <div className="flex items-start gap-3">
        {imageSrc ? (
          <span className={cn('relative shrink-0 overflow-visible', compact ? 'h-14 w-14' : 'h-20 w-20')}>
            <OptimizedImage src={imageSrc} alt="" fill variant="thumbnail" className="object-contain" />
          </span>
        ) : iconName ? (
          <ProfileImageIcon name={iconName} className={compact ? 'h-10 w-10' : 'h-12 w-12'} />
        ) : (
          <span
            className={cn(
              'grid shrink-0 place-items-center rounded-[20px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]',
              compact ? 'h-10 w-10' : 'h-12 w-12',
            )}
          >
            <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
          </span>
        )}
        <div className="min-w-0">
          {!compact ? (
            <span className="inline-flex rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
              下一步任务
            </span>
          ) : null}
          <h3 className={cn('font-semibold text-foreground', compact ? 'mt-0 text-sm' : 'mt-2 text-base')}>{title}</h3>
          <p className={cn('text-muted-foreground', compact ? 'mt-1 line-clamp-2 text-xs leading-5' : 'mt-1.5 text-sm leading-6')}>
            {description}
          </p>
        </div>
      </div>
      <Link href={href} className={cn('profile-soft-cta', 'w-fit shrink-0', compact ? 'mt-1 h-8 px-3 text-xs' : 'mt-4 h-9')}>
        {action}
      </Link>
    </div>
  )
}
