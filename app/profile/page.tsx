'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useEffectEvent, useState } from 'react'
import { ArrowUpRight, Sparkles } from 'lucide-react'

import { BadgeGalleryDialog } from '@/components/features/gamification/badge-gallery-dialog'
import { BadgeIcon } from '@/components/features/gamification/badge-icon'
import { EditProfileDialog } from '@/components/features/profile/edit-profile-dialog'
import { LevelGuideDialog } from '@/components/features/gamification/level-guide-dialog'
import { LevelProgress } from '@/components/features/gamification/level-progress'
import { ProfileSkeleton } from '@/components/features/profile/profile-skeleton'
import { ProfileHeader } from '@/components/profile/profile-header'
import { CoinIcon } from '@/components/icons/coin-icon'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Button } from '@/components/ui/button'
import { RoleBadge } from '@/components/ui/role-badge'
import { useAuth } from '@/context/auth-context'
import { BADGES, useGamification } from '@/context/gamification-context'
import { useToast } from '@/hooks/use-toast'
import { getBadgesForDisplay } from '@/lib/gamification/badges'
import { logger } from '@/lib/logger'
import { getDefaultAvatarPath } from '@/lib/profile/avatar-options'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { getNameColorClassName } from '@/lib/shop/items'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/utils/user'

const SteamRadarChart = dynamic(
  () => import('@/components/features/profile/steam-radar-chart').then((mod) => mod.SteamRadarChart),
  {
    loading: () => <div className="surface-panel min-h-[320px] rounded-[28px]" />,
  },
)

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const { unlockedBadges, userBadgeDetails, coins = 0 } = useGamification()
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null)
  const [myProjectsTotalCount, setMyProjectsTotalCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [totalLikesReceived, setTotalLikesReceived] = useState(0)
  const [steamRadar, setSteamRadar] = useState<SteamRadarWithGuidance | null>(null)

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

        setMyProjectsTotalCount(Number(payload?.myProjectsTotalCount || 0))
        setFollowerCount(Number(payload?.followerCount || 0))
        setFollowingCount(Number(payload?.followingCount || 0))
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
  const level = Math.floor(Math.sqrt((profile?.xp || 0) / 100)) + 1
  const featuredBadges =
    unlockedBadges.size > 0 ? getBadgesForDisplay(BADGES, unlockedBadges, 5) : BADGES.slice(0, 5)

  return isDesktopViewport ? (
    <div className="page-shell py-8">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <div className="space-y-6">
          <section className="surface-panel overflow-hidden">
            <div className="bg-gradient-to-r from-background/95 via-background/90 to-primary/[0.08] px-6 py-7 sm:px-7 sm:py-8 lg:px-8">
              <p className="section-kicker">我的看板</p>
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
                      className="absolute -bottom-2 -right-1 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-background/95 px-3 py-1 text-sm font-semibold text-foreground shadow-sm ring-1 ring-primary/10 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Lv.{level}
                      <ArrowUpRight className="h-3 w-3 text-primary/65" />
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
                            'text-3xl font-semibold tracking-tight',
                            getNameColorClassName(profile?.equipped_name_color_id ?? null) || 'text-foreground',
                          )}
                        >
                          {userName}
                        </h1>
                      </div>

                      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                        {profile?.bio || '个人看板'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild variant="outline" className="h-11 rounded-2xl px-5 text-sm font-semibold">
                        <Link href="/coins">
                          <CoinIcon className="mr-2 h-[18px] w-[18px] text-amber-500" />
                          我的硬币 {coins.toLocaleString()}
                        </Link>
                      </Button>
                      <Button asChild variant="outline" className="h-11 rounded-2xl px-5 text-sm font-semibold">
                        <Link href="/profile/library">我的内容</Link>
                      </Button>
                      <EditProfileDialog>
                        <Button variant="outline" className="h-11 rounded-2xl px-5 text-sm font-semibold">
                          编辑资料
                        </Button>
                      </EditProfileDialog>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: '作品', value: myProjectsTotalCount, href: '/profile/library' },
                      { label: '粉丝', value: followerCount, href: '/profile/followers' },
                      { label: '关注', value: followingCount, href: '/profile/following' },
                      { label: '获赞', value: totalLikesReceived, href: '/profile/likes' },
                    ].map((stat) => (
                      <Link
                        key={stat.label}
                        href={stat.href}
                        className="group surface-subtle relative rounded-[22px] border border-transparent px-4 py-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/80 hover:shadow-[0_12px_30px_-24px_rgba(37,99,235,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:text-left"
                      >
                        <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-primary/45 transition-all group-hover:text-primary" />
                        <div className="text-lg font-semibold tabular-nums text-foreground">{stat.value}</div>
                        <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{stat.label}</span>
                          <span className="text-[10px] text-primary/75">查看</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div>
            {steamRadar ? (
              <SteamRadarChart initialRadar={steamRadar} />
            ) : (
              <section className="surface-panel p-6">
                <div className="flex min-h-[320px] flex-col justify-center">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">STEAM 雷达图</h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                    还没有足够的数据来绘制雷达图。完成项目和挑战后，这里会更有参考价值。
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>

        <aside className="space-y-6">
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
              当前等级和经验进度。
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
                  seriesKey={badge.seriesKey}
                  size="sm"
                  className="h-8 w-8"
                  showGlow={false}
                  locked={!unlockedBadges.has(badge.id)}
                />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  ) : (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <div className="px-4 pt-4">
        <ProfileHeader
          user={user}
          profile={profile}
          myProjectsCount={myProjectsTotalCount}
          totalLikesReceived={totalLikesReceived}
          followerCount={followerCount}
          followingCount={followingCount}
          worksEntryHref="/profile/library"
          worksEntryLabel="我的内容"
          statLinks={{
            works: '/profile/library',
            followers: '/profile/followers',
            following: '/profile/following',
            likes: '/profile/likes',
          }}
        />
      </div>

      <div className="space-y-4 px-4 py-4">
        {steamRadar ? (
          <SteamRadarChart initialRadar={steamRadar} />
        ) : (
          <section className="surface-panel rounded-[28px] p-5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">STEAM 雷达图</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              还没有足够的数据来绘制雷达图。完成项目和挑战后，这里会更有参考价值。
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
