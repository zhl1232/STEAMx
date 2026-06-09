'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, Users } from 'lucide-react'

import { FollowButton } from '@/components/features/social/follow-button'
import { ProfileUserListSkeleton } from '@/components/features/profile/profile-user-list-skeleton'
import { AvatarWithFrame } from '@/components/ui/avatar-with-frame'
import { Button } from '@/components/ui/button'
import { MobilePageHeader } from '@/components/ui/mobile-page-header'
import { RoleBadge } from '@/components/ui/role-badge'
import { logger } from '@/lib/logger'
import { getNameColorClassName } from '@/lib/shop/items'
import { cn } from '@/lib/utils'

type FollowPageType = 'followers' | 'following'

interface ProfileListItem {
  id: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  equipped_avatar_frame_id: string | null
  equipped_name_color_id: string | null
}

export function ProfileUserListPage({
  type,
  title,
  emptyTitle,
  emptyDescription,
}: {
  type: FollowPageType
  title: string
  emptyTitle: string
  emptyDescription: string
}) {
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    const loadProfiles = async () => {
      setIsLoading(true)

      try {
        const response = await fetch(`/api/profile/follows?type=${type}`, { signal: controller.signal })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload?.error || '列表加载失败')
        }

        if (controller.signal.aborted) return

        setProfiles((payload?.profiles as ProfileListItem[]) || [])
        setTotal(Number(payload?.total || 0))
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') return
        logger.error(`Failed to load ${type}`, { error })
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void loadProfiles()

    return () => controller.abort()
  }, [type])

  if (isLoading) {
    return <ProfileUserListSkeleton title={title} />
  }

  return (
    <div className="page-shell pb-24 pt-6 md:py-8">
      <div className="md:hidden">
        <MobilePageHeader title={title} fallbackHref="/profile" />
      </div>

      <div className="space-y-6">
        <section className="hidden overflow-hidden md:block">
          <div className="surface-panel flex items-center gap-3 px-6 py-5">
            <Button asChild variant="ghost" size="icon" shape="square" className="h-10 w-10">
              <Link href="/profile" aria-label="返回个人主页">
                <ChevronLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{total} 人</p>
            </div>
          </div>
        </section>

        {profiles.length === 0 ? (
          <section className="surface-panel px-6 py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">{emptyTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
          </section>
        ) : (
          <div className="space-y-4">
            {profiles.map((profile) => {
              const displayName = profile.display_name || '匿名用户'

              return (
                <Link
                  key={profile.id}
                  href={`/users/${profile.id}`}
                  className="surface-panel block rounded-[var(--radius-lg)] px-4 py-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="flex items-start gap-4">
                    <AvatarWithFrame
                      src={profile.avatar_url}
                      alt={displayName}
                      fallback={displayName[0]?.toUpperCase() || 'U'}
                      avatarFrameId={profile.equipped_avatar_frame_id}
                      className="h-14 w-14"
                      avatarClassName="rounded-full object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {profile.role && profile.role !== 'user' ? <RoleBadge role={profile.role as never} size="sm" /> : null}
                        <div
                          className={cn(
                            'text-base font-semibold text-foreground',
                            getNameColorClassName(profile.equipped_name_color_id ?? null) || '',
                          )}
                        >
                          {displayName}
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {profile.bio || '这个人还没有补充个人简介。'}
                      </p>
                    </div>

                    <div className="shrink-0" onClick={(event) => event.preventDefault()}>
                      <FollowButton targetUserId={profile.id} className="px-4" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
