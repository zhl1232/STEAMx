'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import {
  Award,
  BookOpen,
  CalendarDays,
  CalendarCheck2,
  ChevronRight,
  CheckCircle2,
  Circle,
  Compass,
  Edit3,
  Eye,
  FolderOpen,
  Heart,
  Library,
  Leaf,
  Mail,
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
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Button } from '@/components/ui/button'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { RoleBadge } from '@/components/ui/role-badge'
import { useAuth } from '@/lib/context/auth-context'
import { BADGES, useGamification } from '@/lib/context/gamification-context'
import { useNotifications } from '@/lib/context/notification-context'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { logger } from '@/lib/logger'
import type { ObservationEvent, Project } from '@/lib/mappers/types'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { getNameColorClassName } from '@/lib/shop/items'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'
import { useToast } from '@/hooks/use-toast'

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

type GrowthTask = {
  label: string
  href: string
  reward: string
  progressLabel: string
  progress: number
  done: boolean
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

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`
}

function getRecentDayLabels(count: number) {
  const today = new Date()

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (count - index - 1))
    return formatMonthDay(date)
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
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const { unlockedBadges, userBadgeDetails } = useGamification()
  const { unreadCount } = useNotifications()
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null)
  const [myProjects, setMyProjects] = useState<Project[]>([])
  const [myProjectsTotalCount, setMyProjectsTotalCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [completedProjectsCount, setCompletedProjectsCount] = useState(0)
  const [totalLikesReceived, setTotalLikesReceived] = useState(0)
  const [steamRadar, setSteamRadar] = useState<SteamRadarWithGuidance | null>(null)
  const [myObservations, setMyObservations] = useState<ObservationEvent[]>([])
  const [observationsTotal, setObservationsTotal] = useState(0)
  const [observationsLoaded, setObservationsLoaded] = useState(false)

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
    if (!user?.id) return

    let cancelled = false

    const loadProfileSummary = async () => {
      try {
        const response = await fetch('/api/profile/summary')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '个人主页摘要加载失败')
        }

        if (cancelled) return

        setMyProjects((payload?.myProjects as Project[] | undefined) || [])
        setMyProjectsTotalCount(Number(payload?.myProjectsTotalCount || 0))
        setFollowerCount(Number(payload?.followerCount || 0))
        setFollowingCount(Number(payload?.followingCount || 0))
        setCompletedProjectsCount(Number(payload?.completedProjectsCount || 0))
        setTotalLikesReceived(Number(payload?.totalLikesReceived || 0))
        setSteamRadar((payload?.radar as SteamRadarWithGuidance | null) || null)
      } catch (err) {
        if (cancelled) return
        logger.error('Exception in loadProfileSummary', { error: err })
        showLoadError(getErrorMessage(err, '无法加载个人资料数据，请稍后重试'))
      }
    }

    loadProfileSummary()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false

    const loadObservations = async () => {
      setObservationsLoaded(false)

      try {
        const response = await fetch('/api/observations/mine?pageSize=6')
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '观察记录加载失败')
        }

        if (cancelled) return

        setMyObservations((payload?.observations as ObservationEvent[] | undefined) || [])
        setObservationsTotal(Number(payload?.total || 0))
      } catch (err) {
        if (cancelled) return
        logger.warn('Failed to load profile observations', { error: err })
        setMyObservations([])
        setObservationsTotal(0)
      } finally {
        if (!cancelled) setObservationsLoaded(true)
      }
    }

    loadObservations()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  const uniqueSpeciesCount = useMemo(() => {
    const speciesIds = new Set<number>()

    for (const observation of myObservations) {
      for (const species of observation.species) {
        speciesIds.add(species.speciesId)
      }
    }

    return speciesIds.size
  }, [myObservations])

  if (authLoading || isDesktopViewport === null) {
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
  const profileComplete = Boolean(profile?.display_name && profile?.bio && profile?.avatar_url)

  const stats: ProfileStat[] = [
    { key: 'works', label: '作品', value: myProjectsTotalCount, href: '/profile/library', icon: 'works' },
    { key: 'followers', label: '粉丝', value: followerCount, href: '/profile/followers', icon: 'followers' },
    { key: 'following', label: '关注', value: followingCount, href: '/profile/following', icon: 'following' },
    { key: 'likes', label: '获赞', value: totalLikesReceived, href: '/profile/likes', icon: 'likes' },
  ]

  const growthTasks: GrowthTask[] = [
    {
      label: '完善个人资料',
      href: '/settings/profile',
      reward: '+50 经验值',
      progressLabel: profileComplete ? '已完成' : '待完善',
      progress: profileComplete ? 100 : 40,
      done: profileComplete,
    },
    {
      label: '发布 1 个项目',
      href: '/share',
      reward: '+100 经验值',
      progressLabel: `${Math.min(myProjectsTotalCount, 1)}/1`,
      progress: clampProgress(myProjectsTotalCount, 1),
      done: myProjectsTotalCount >= 1,
    },
    {
      label: '记录 3 条自然观察',
      href: '/nature/submit',
      reward: '+80 经验值',
      progressLabel: `${Math.min(observationsTotal, 3)}/3`,
      progress: observationsLoaded ? clampProgress(observationsTotal, 3) : 0,
      done: observationsTotal >= 3,
    },
    {
      label: '获得 20 个点赞',
      href: '/profile/likes',
      reward: '+50 经验值',
      progressLabel: `${Math.min(totalLikesReceived, 20)}/20`,
      progress: clampProgress(totalLikesReceived, 20),
      done: totalLikesReceived >= 20,
    },
    {
      label: '完成 3 个项目',
      href: '/profile/library',
      reward: '+100 经验值',
      progressLabel: `${Math.min(completedProjectsCount, 3)}/3`,
      progress: clampProgress(completedProjectsCount, 3),
      done: completedProjectsCount >= 3,
    },
  ]
  const completedTaskCount = growthTasks.filter((task) => task.done).length

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
    growthTasks,
    completedTaskCount,
    featuredBadges,
    unlockedBadges,
    userBadgeDetails,
    myProjects,
    myProjectsTotalCount,
    completedProjectsCount,
    steamRadar,
    myObservations,
    observationsTotal,
    uniqueSpeciesCount,
    unreadCount,
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
  completedTaskCount,
  featuredBadges,
  unlockedBadges,
  userBadgeDetails,
  myProjects,
  myProjectsTotalCount,
  completedProjectsCount,
  steamRadar,
  myObservations,
  observationsTotal,
  uniqueSpeciesCount,
  profile,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  growthTasks: GrowthTask[]
  completedTaskCount: number
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  userBadgeDetails: Map<string, { unlockedAt: string }>
  myProjects: Project[]
  myProjectsTotalCount: number
  completedProjectsCount: number
  steamRadar: SteamRadarWithGuidance | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  uniqueSpeciesCount: number
  unreadCount: number
  profile: ReturnType<typeof useAuth>['profile']
}) {
  return (
    <div className="min-h-screen bg-background pb-10 text-foreground">
      <div className="page-shell py-4 min-[390px]:py-5 md:py-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
          <main className="min-w-0 space-y-4">
            <ProfileHero
              profileContext={profileContext}
              stats={stats}
              profile={profile}
              compact={false}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
              <section className="surface-panel flex min-h-[388px] flex-col rounded-[20px] p-5 xl:col-span-4">
                <SectionTitle iconName="timeline" title="STEAM 能力雷达" actionHref="/profile/library" actionLabel="查看内容库" />
                {steamRadar ? (
                  <SteamRadarChart
                    initialRadar={steamRadar}
                    showHeader={false}
                    className="mt-3 border-0 bg-transparent p-0 shadow-none xl:[&>div:first-of-type]:h-[214px] xl:[&>div:first-of-type]:min-h-[214px] xl:[&>p]:line-clamp-2"
                  />
                ) : (
                  <EmptyBlock
                    icon={Compass}
                    iconName="timeline"
                    title="还没有足够的数据"
                    description="完成项目和挑战后，这里会生成你的 STEAM 能力图谱。"
                    href="/explore"
                    action="去完成一次挑战"
                  />
                )}
              </section>

              <ExperienceBadgesPanel
                profileContext={profileContext}
                featuredBadges={featuredBadges}
                unlockedBadges={unlockedBadges}
                userBadgeDetails={userBadgeDetails}
                className="xl:col-span-5 xl:min-h-[388px]"
              />

              <StudyCheckInPanel profileContext={profileContext} className="xl:col-span-3 xl:min-h-[388px]" />

              <section className="surface-panel rounded-[20px] p-5 md:col-span-2 xl:col-span-6">
                <SectionTitle iconName="projects" title="我的项目 / 作品" actionHref="/profile/library" actionLabel="查看全部" />
                <ProjectShowcase projects={myProjects} total={myProjectsTotalCount} />
              </section>

              <section className="surface-panel rounded-[20px] p-5 xl:col-span-3">
                <SectionTitle iconName="observation" title="最近观察记录" actionHref="/nature/observations" actionLabel="查看全部" />
                <ObservationList observations={myObservations} total={observationsTotal} />
              </section>

              <CommunityFeedPanel
                profileContext={profileContext}
                projects={myProjects}
                observations={myObservations}
                className="xl:col-span-3"
              />

              <LearningTimeline
                profileContext={profileContext}
                projects={myProjects}
                observations={myObservations}
                className="md:col-span-2 xl:col-span-6"
              />
            </div>
          </main>

          <aside className="space-y-4">
            <GrowthTasksPanel tasks={growthTasks} completedTaskCount={completedTaskCount} />
            <RecommendedChallengePanel />
            <AchievementSummary
              completedProjectsCount={completedProjectsCount}
              observationsTotal={observationsTotal}
              uniqueSpeciesCount={uniqueSpeciesCount}
              xp={profileContext.currentXP}
              level={profileContext.level}
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
  completedTaskCount,
  featuredBadges,
  unlockedBadges,
  myProjects,
  myProjectsTotalCount,
  completedProjectsCount,
  steamRadar,
  myObservations,
  observationsTotal,
  uniqueSpeciesCount,
  unreadCount,
  profile,
}: {
  profileContext: ProfileContext
  stats: ProfileStat[]
  growthTasks: GrowthTask[]
  completedTaskCount: number
  featuredBadges: typeof BADGES
  unlockedBadges: Set<string>
  myProjects: Project[]
  myProjectsTotalCount: number
  completedProjectsCount: number
  steamRadar: SteamRadarWithGuidance | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  uniqueSpeciesCount: number
  unreadCount: number
  profile: ReturnType<typeof useAuth>['profile']
}) {
  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))] text-foreground">
      <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <MobileTopBar unreadCount={unreadCount} />
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
            <p className="text-sm font-semibold text-foreground">经验与等级</p>
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

        <section className="surface-panel p-4">
          <SectionTitle iconName="achievement" title="最近获得的徽章" actionHref="/badges-preview" actionLabel="全部徽章" />
          <BadgeShowcase badges={featuredBadges} unlockedBadges={unlockedBadges} compact />
        </section>

        <section className="surface-panel p-4">
          <SectionTitle iconName="growth" title={`成长任务（${completedTaskCount}/5）`} actionHref="/profile/library" actionLabel="查看全部" />
          <div className="mt-4 space-y-3">
            {growthTasks.slice(0, 5).map((task) => (
              <GrowthTaskRow key={task.label} task={task} />
            ))}
          </div>
        </section>

        <section className="surface-panel p-4">
          <SectionTitle iconName="projects" title="我的项目 / 作品" actionHref="/profile/library" actionLabel="查看全部" />
          <ProjectShowcase projects={myProjects} total={myProjectsTotalCount} mobile />
        </section>

        <section className="surface-panel p-4">
          <SectionTitle iconName="observation" title="最近观察记录" actionHref="/nature/observations" actionLabel="查看全部" />
          <ObservationList observations={myObservations} total={observationsTotal} mobile />
        </section>

        <AchievementSummary
          completedProjectsCount={completedProjectsCount}
          observationsTotal={observationsTotal}
          uniqueSpeciesCount={uniqueSpeciesCount}
          xp={profileContext.currentXP}
          level={profileContext.level}
          compact
        />
      </div>
    </div>
  )
}

function MobileTopBar({ unreadCount }: { unreadCount: number }) {
  return (
    <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
      <h1 className="text-[28px] font-semibold leading-none text-foreground">我的</h1>
      <div className="flex items-center gap-2">
        <div className="grid h-11 w-11 place-items-center rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)] shadow-sm backdrop-blur-md">
          <ThemeToggle />
        </div>
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)] shadow-sm backdrop-blur-md">
          <Link href="/settings" aria-label="设置">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="icon" className="relative h-11 w-11 rounded-full border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.82)] shadow-sm backdrop-blur-md">
          <Link href="/messages" aria-label="消息">
            <Mail className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold leading-5 text-destructive-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Link>
        </Button>
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
    <section className={cn('surface-panel relative overflow-hidden', compact ? 'rounded-[24px]' : 'min-h-[270px] rounded-[20px]')}>
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

      <div className={cn('relative', compact ? 'px-5 pb-4 pt-5' : 'px-7 pb-5 pt-7')}>
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
              <h2
                className={cn(
                  'mt-2 truncate font-semibold tracking-normal text-foreground',
                  compact ? 'text-[26px]' : 'text-[30px]',
                  getNameColorClassName(profile?.equipped_name_color_id ?? null),
                )}
              >
                {profileContext.userName}
              </h2>
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
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Button asChild className="h-11 rounded-[20px] bg-[hsl(var(--brand-blue))] px-5 text-sm font-bold text-[hsl(var(--brand-blue-foreground))] shadow-[0_18px_40px_-24px_hsl(var(--brand-blue)/0.8)] hover:bg-[hsl(var(--brand-blue)/0.92)]">
                      <Link href="/project">
                        <Rocket className="mr-2 h-4 w-4" />
                        发布项目
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

        <div className={cn('grid overflow-hidden border border-white/35 bg-white/10 shadow-[0_18px_48px_-34px_hsl(var(--surface-shadow)/0.62)] backdrop-blur-md dark:border-[hsl(var(--surface-border-strong))] dark:bg-background/60', compact ? 'mt-5 grid-cols-4 rounded-2xl' : 'mt-6 max-w-[610px] grid-cols-4 rounded-[18px]')}>
          {stats.map((stat, index) => (
            <ProfileStatTile key={stat.key} stat={stat} compact={compact} bordered={index > 0} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ProfileStatTile({ stat, compact, bordered }: { stat: ProfileStat; compact: boolean; bordered: boolean }) {
  return (
    <Link
      href={stat.href}
      className={cn(
        'group flex items-center justify-center gap-3 transition hover:bg-[hsl(var(--surface-muted)/0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30',
        compact ? 'min-h-[72px] flex-col gap-1.5 px-2 py-3 text-center' : 'min-h-[62px] px-4 py-3',
        bordered && 'border-l border-white/24 dark:border-[hsl(var(--surface-border-strong))]',
      )}
    >
      <ProfileImageIcon name={stat.icon} variant="heroStat" className={compact ? 'h-9 w-9' : 'h-10 w-10'} />
      <span className={compact ? 'block' : 'min-w-0'}>
        <span className={cn('block font-semibold tabular-nums text-foreground', compact ? 'text-xl leading-5' : 'text-xl')}>
          {formatCompactNumber(stat.value)}
        </span>
        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{stat.label}</span>
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
}: {
  icon?: LucideIcon
  iconName?: ProfileIconName
  title: string
  actionHref?: string
  actionLabel?: string
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
      {actionHref && actionLabel ? (
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

function MobileActionGrid() {
  const actions = [
    { label: '发布项目', href: '/share', icon: Rocket, tone: 'text-[hsl(var(--brand-blue))] bg-[hsl(var(--brand-blue)/0.12)]' },
    { label: '我的钱包', href: '/coins', icon: WalletCards, tone: 'text-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green)/0.12)]' },
    { label: '创客商店', href: '/shop', icon: ShoppingBag, tone: 'text-[hsl(var(--brand-amber))] bg-[hsl(var(--brand-amber)/0.14)]' },
    { label: '内容库', href: '/profile/library', icon: Library, tone: 'text-violet-500 bg-violet-500/10' },
  ]

  return (
    <section className="surface-panel grid grid-cols-5 gap-1.5 p-3 min-[390px]:gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link key={action.label} href={action.href} className="grid min-h-[78px] place-items-center gap-1.5 rounded-[16px] px-1 py-2.5 text-center transition hover:bg-[hsl(var(--surface-muted)/0.68)] min-[390px]:min-h-[86px] min-[390px]:gap-2 min-[390px]:px-2 min-[390px]:py-3">
            <span className={cn('grid h-10 w-10 place-items-center rounded-[18px] min-[390px]:h-11 min-[390px]:w-11 min-[390px]:rounded-[20px]', action.tone)}>
              <Icon className="h-5 w-5 min-[390px]:h-6 min-[390px]:w-6" />
            </span>
            <span className="text-xs font-bold text-foreground">{action.label}</span>
          </Link>
        )
      })}
      <EditProfileDialog>
        <button type="button" className="grid min-h-[78px] place-items-center gap-1.5 rounded-[16px] px-1 py-2.5 text-center transition hover:bg-[hsl(var(--surface-muted)/0.68)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 min-[390px]:min-h-[86px] min-[390px]:gap-2 min-[390px]:px-2 min-[390px]:py-3">
          <span className="grid h-10 w-10 place-items-center rounded-[18px] bg-violet-500/10 text-violet-500 min-[390px]:h-11 min-[390px]:w-11 min-[390px]:rounded-[20px]">
            <Edit3 className="h-5 w-5 min-[390px]:h-6 min-[390px]:w-6" />
          </span>
          <span className="text-xs font-bold text-foreground">编辑资料</span>
        </button>
      </EditProfileDialog>
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
    <section className={cn('surface-panel flex flex-col overflow-hidden rounded-[20px] p-5', className)}>
      <SectionTitle iconName="achievement" title="经验与等级" actionHref="/profile/library" actionLabel="成长体系" />

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
  profileContext,
  className,
}: {
  profileContext: ProfileContext
  className?: string
}) {
  const dayLabels = getRecentDayLabels(6)
  const streakDays = Math.max(7, Math.min(28, profileContext.level * 4))

  return (
    <section className={cn('surface-panel flex flex-col rounded-[20px] p-5', className)}>
      <SectionTitle iconName="progress" title="学习打卡" actionHref="/profile/library" actionLabel="日历" />

      <div className="mt-4 rounded-[20px] bg-[linear-gradient(135deg,#f4fbf7,#eef7ff)] p-4 dark:bg-[linear-gradient(135deg,hsl(var(--surface-muted)),hsl(var(--surface-raised)))]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">连续打卡</p>
            <div className="mt-1 flex items-end gap-1">
              <span className="text-[34px] font-extrabold leading-none text-[hsl(var(--brand-green))]">{streakDays}</span>
              <span className="pb-1 text-sm font-bold text-foreground">天</span>
            </div>
          </div>
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-white shadow-[0_16px_34px_-26px_rgba(27,96,54,0.62)] dark:bg-background/60">
            <CalendarDays className="h-9 w-9 text-[hsl(var(--brand-amber))]" />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">继续加油，养成探索习惯。</p>
      </div>

      <div className="mt-4 grid grid-cols-6 gap-2">
        {dayLabels.map((label, index) => {
          const isToday = index === dayLabels.length - 1
          return (
            <div key={label} className="text-center">
              <span className={cn('mx-auto grid h-7 w-7 place-items-center rounded-full', isToday ? 'bg-[hsl(var(--brand-green))] text-white' : 'bg-[hsl(var(--brand-green)/0.12)] text-[hsl(var(--brand-green))]')}>
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="mt-1 block text-[11px] font-medium text-muted-foreground">{isToday ? '今天' : label}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-auto pt-4">
        <div className="rounded-[12px] border border-[hsl(var(--brand-green)/0.16)] bg-[hsl(var(--brand-green)/0.07)] px-3 py-2.5">
          <p className="text-xs font-bold text-[hsl(var(--brand-green))]">今日探索提示</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">把一个好奇问题写下来，明天用实验或观察验证它。</p>
        </div>
      </div>
    </section>
  )
}

function RecommendedChallengePanel() {
  return (
    <section className="surface-panel rounded-[20px] p-5">
      <SectionTitle iconName="emptyProjects" title="推荐下一步挑战" actionHref="/community?tab=challenges" actionLabel="查看全部" />
      <Link href="/community?tab=challenges" className="surface-card mt-4 grid grid-cols-[106px_minmax(0,1fr)] gap-3 p-2 transition hover:border-[hsl(var(--surface-border-strong))] hover:bg-[hsl(var(--surface-muted)/0.82)]">
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
            <span className="inline-flex h-8 items-center rounded-[10px] bg-[hsl(var(--brand-blue))] px-3 text-xs font-bold text-white">
              去参与
            </span>
          </div>
        </div>
      </Link>
    </section>
  )
}

function CommunityFeedPanel({
  profileContext,
  projects,
  observations,
  className,
}: {
  profileContext: ProfileContext
  projects: Project[]
  observations: ObservationEvent[]
  className?: string
}) {
  const feedItems = [
    projects[0]
      ? {
          key: `project-${projects[0].id}`,
          tone: '创客工坊',
          title: `发布了新项目：${projects[0].title}`,
          meta: '刚刚更新',
          image: projects[0].image,
          href: `/project/${projects[0].id}`,
        }
      : null,
    observations[0]
      ? {
          key: `observation-${observations[0].id}`,
          tone: '自然小达人',
          title: `分享了观察记录：${getObservationTitle(observations[0])}`,
          meta: formatShortDate(observations[0].observedAt),
          image: observations[0].mediaUrls[0] || '',
          href: `/nature/observations/${observations[0].id}`,
        }
      : null,
    projects[1]
      ? {
          key: `project-${projects[1].id}`,
          tone: '科学少年',
          title: `评论了你的项目：${projects[1].title}`,
          meta: '昨天 16:05',
          image: projects[1].image,
          href: `/project/${projects[1].id}`,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  return (
    <section className={cn('surface-panel rounded-[20px] p-5', className)}>
      <SectionTitle iconName="community" title="社区动态" actionHref="/community" actionLabel="查看全部" />
      {feedItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {feedItems.map((item) => (
            <Link key={item.key} href={item.href} className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3 rounded-[12px] p-1.5 transition hover:bg-[hsl(var(--surface-muted)/0.68)]">
              <AvatarWithFrame
                src={profileContext.userAvatar}
                alt={profileContext.userName}
                fallback={getInitial(profileContext.userName)}
                className="h-8 w-8 border-2 border-background"
                avatarClassName="rounded-full object-cover"
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-[hsl(var(--brand-green))]">{item.tone}</span>
                <span className="mt-0.5 line-clamp-2 text-xs leading-4 text-foreground">{item.title}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{item.meta}</span>
              </span>
              <span className="relative h-11 w-[52px] overflow-hidden rounded-[10px] bg-[hsl(var(--surface-muted))]">
                {item.image ? (
                  <OptimizedImage src={item.image} alt="" fill variant="thumbnail" className="object-cover" />
                ) : (
                  <MessageCircle className="m-3 h-5 w-5 text-[hsl(var(--brand-blue))]" />
                )}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyBlock
          icon={MessageCircle}
          iconName="community"
          title="暂无社区动态"
          description="参加一个挑战，或给同伴的作品留下一条有帮助的观察。"
          href="/community?tab=challenges"
          action="去参加挑战"
        />
      )}
    </section>
  )
}

function LearningTimeline({
  profileContext,
  projects,
  observations,
  className,
}: {
  profileContext: ProfileContext
  projects: Project[]
  observations: ObservationEvent[]
  className?: string
}) {
  const dayLabels = getRecentDayLabels(6)
  const items = [
    { date: dayLabels[0], label: '加入探索', detail: profileContext.joinedAt, iconName: 'timeline' as const, active: true },
    { date: dayLabels[1], label: '发布作品', detail: projects[0]?.title || '准备第一个项目', iconName: 'emptyProjects' as const, active: projects.length > 0 },
    { date: dayLabels[2], label: '自然观察', detail: observations[0] ? `${getObservationTitle(observations[0])}` : '记录 3 条', iconName: 'observation' as const, active: observations.length > 0 },
    { date: dayLabels[3], label: '获得徽章', detail: '项目达人', iconName: 'liked' as const, active: true },
    { date: dayLabels[5], label: '经验提升', detail: '探索值持续成长', iconName: 'likes' as const, active: true },
  ]

  return (
    <section className={cn('surface-panel rounded-[20px] p-5', className)}>
      <SectionTitle iconName="timeline" title="学习轨迹" actionHref="/profile/library" actionLabel="查看详情" />
      <div className="mt-5 grid grid-cols-5 gap-2">
        {items.map((item, index) => {
          return (
            <div key={`${item.label}-${item.date}`} className="relative min-w-0 text-center">
              {index > 0 ? (
                <span className="absolute left-[-50%] top-5 h-0.5 w-full bg-[hsl(var(--surface-border))]" aria-hidden="true" />
              ) : null}
              <ProfileImageIcon
                name={item.iconName}
                variant="timeline"
                className={cn('relative z-10 mx-auto h-11 w-11', !item.active && 'opacity-55 grayscale')}
              />
              <span className="mt-2 block text-xs font-semibold text-muted-foreground">{item.date}</span>
              <span className="mt-1 block truncate text-xs font-bold text-foreground">{item.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{item.detail}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function GrowthTasksPanel({ tasks, completedTaskCount }: { tasks: GrowthTask[]; completedTaskCount: number }) {
  return (
    <section className="surface-panel rounded-[20px] p-5">
      <SectionTitle iconName="growth" title={`成长任务（${completedTaskCount}/5）`} actionHref="/profile/library" actionLabel="查看全部" />
      <div className="mt-5 space-y-3">
        {tasks.map((task) => (
          <GrowthTaskRow key={task.label} task={task} />
        ))}
      </div>
    </section>
  )
}

function GrowthTaskRow({ task }: { task: GrowthTask }) {
  return (
    <Link href={task.href} className="surface-subtle group block p-3 transition hover:border-[hsl(var(--surface-border-strong))] hover:bg-[hsl(var(--surface-muted)/0.82)]">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 text-[hsl(var(--brand-green))]', !task.done && 'text-muted-foreground')}>
          {task.done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{task.label}</span>
            <span className="shrink-0 text-xs font-semibold text-[hsl(var(--brand-green))]">{task.reward}</span>
          </span>
          <span className="mt-2 flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-border))]">
              <span className="block h-full rounded-full bg-[hsl(var(--brand-blue))]" style={{ width: `${task.progress}%` }} />
            </span>
            <span className="w-14 text-right text-xs font-medium text-muted-foreground">{task.progressLabel}</span>
          </span>
        </span>
      </div>
    </Link>
  )
}

function AchievementSummary({
  completedProjectsCount,
  observationsTotal,
  uniqueSpeciesCount,
  xp,
  level,
  compact = false,
}: {
  completedProjectsCount: number
  observationsTotal: number
  uniqueSpeciesCount: number
  xp: number
  level: number
  compact?: boolean
}) {
  const items = [
    { label: '完成项目', value: `${formatCompactNumber(completedProjectsCount)} 个`, iconName: 'projects' as const },
    { label: '自然观察', value: `${formatCompactNumber(observationsTotal)} 条`, iconName: 'observation' as const },
    { label: '识别物种', value: `${formatCompactNumber(uniqueSpeciesCount)} 种`, iconName: 'observation' as const },
  ]

  return (
    <section className={cn('surface-panel rounded-[20px] p-5', compact && 'mb-2')}>
      <SectionTitle iconName="achievement" title="成就总览" actionHref="/badges-preview" actionLabel="查看详情" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="surface-subtle p-3 text-center">
            <ProfileImageIcon name={item.iconName} className="mx-auto h-8 w-8 rounded-[9px]" />
            <div className="mt-2 text-base font-semibold tabular-nums text-foreground">{item.value}</div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[10px] border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-muted)/0.5)] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">累计经验值</span>
          <span className="font-extrabold text-[hsl(var(--brand-blue))]">{xp.toLocaleString()}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">全球排名</span>
          <span className="rounded-full bg-[hsl(var(--brand-blue)/0.12)] px-2.5 py-1 text-xs font-extrabold text-[hsl(var(--brand-blue))]">前 {Math.max(1, 20 - level)}%</span>
        </div>
      </div>
    </section>
  )
}

function ProjectShowcase({ projects, total, mobile = false }: { projects: Project[]; total: number; mobile?: boolean }) {
  if (projects.length === 0) {
    return (
      <EmptyBlock
        icon={Rocket}
        iconName="emptyProjects"
        title="你的创意实验室空空如也"
        description="把今天完成的小实验、模型或观察整理成作品，点亮你的第一个展示位。"
        href="/project"
        action="启动第一个 STEAM 项目"
      />
    )
  }

  const visibleProjects = projects.slice(0, mobile ? 6 : 4)

  return (
    <div className={cn('mt-4', mobile ? '-mx-1 overflow-x-auto px-1' : '')}>
      <div className={cn(mobile ? 'flex w-max gap-3 pb-1' : 'grid gap-4 md:grid-cols-2 xl:grid-cols-4')}>
        {visibleProjects.map((project) => (
          <MiniProjectCard key={project.id} project={project} mobile={mobile} />
        ))}
      </div>
      {total > visibleProjects.length ? (
        <p className="mt-3 text-xs text-muted-foreground">还有 {total - visibleProjects.length} 个作品在内容库中。</p>
      ) : null}
    </div>
  )
}

function MiniProjectCard({ project, mobile }: { project: Project; mobile: boolean }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className={cn('surface-card group block overflow-hidden transition hover:-translate-y-0.5 hover:border-[hsl(var(--surface-border-strong))]', mobile ? 'w-[176px]' : '')}
    >
      <div className={cn('relative overflow-hidden bg-[hsl(var(--surface-muted))]', mobile ? 'h-[96px]' : 'aspect-[16/10]')}>
        {project.image ? (
          <OptimizedImage src={project.image} alt={project.title} fill variant="card" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <FolderOpen className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">{project.title}</h3>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate rounded-[8px] bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 font-semibold text-[hsl(var(--brand-blue))]">
            {project.category || '项目'}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCompactNumber(project.views_count || 0)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" />
              {formatCompactNumber(project.likes || 0)}
            </span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function ObservationList({ observations, total, mobile = false }: { observations: ObservationEvent[]; total: number; mobile?: boolean }) {
  if (observations.length === 0) {
    return (
      <EmptyBlock
        icon={Leaf}
        iconName="observation"
        title="大自然正在呼唤"
        description="拍下校园、公园或窗边的自然线索，让这里成为你的发现图鉴。"
        href="/nature/submit"
        action="去记录今天见到的第一只鸟"
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
            className={cn('surface-card group block transition hover:bg-[hsl(var(--surface-muted)/0.82)]', mobile ? 'w-[172px] overflow-hidden' : 'p-3')}
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

function EmptyBlock({
  icon: Icon,
  iconName,
  title,
  description,
  href,
  action,
}: {
  icon: LucideIcon
  iconName?: ProfileIconName
  title: string
  description: string
  href: string
  action: string
}) {
  const imageSrc = iconName && iconName in EMPTY_STATE_IMAGE_SRC
    ? EMPTY_STATE_IMAGE_SRC[iconName as keyof typeof EMPTY_STATE_IMAGE_SRC]
    : null

  return (
    <div className="surface-subtle mt-4 flex min-h-[178px] flex-col justify-between px-4 py-4 text-left">
      <div className="flex items-start gap-3">
        {imageSrc ? (
          <span className="relative h-20 w-20 shrink-0 overflow-visible">
            <OptimizedImage src={imageSrc} alt="" fill variant="thumbnail" className="object-contain" />
          </span>
        ) : iconName ? (
          <ProfileImageIcon name={iconName} className="h-12 w-12" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-[hsl(var(--brand-blue)/0.1)] text-[hsl(var(--brand-blue))]">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-[hsl(var(--brand-blue)/0.1)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--brand-blue))]">
            下一步任务
          </span>
          <h3 className="mt-2 text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button asChild className="mt-4 h-9 w-fit rounded-full px-3 text-sm font-semibold">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  )
}
