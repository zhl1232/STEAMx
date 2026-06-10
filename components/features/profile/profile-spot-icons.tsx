'use client'

import Image from 'next/image'

import type { ProfileTimelineIconName } from '@/lib/profile/timeline'
import { cn } from '@/lib/utils'

export type ProfileSpotIconName =
  | 'growth-quest'
  | 'exploring-map'
  | 'timeline-join'
  | 'timeline-projects'
  | 'timeline-observation'
  | 'timeline-achievement'
  | 'timeline-growth'

export const PROFILE_SPOT_ICON_SIZES = {
  sm: 'h-10 w-10',
  md: 'h-11 w-11',
} as const

const PROFILE_SPOT_ICON_SRC: Record<ProfileSpotIconName, string> = {
  'growth-quest': '/assets/profile-icons/growth-quest.webp',
  'exploring-map': '/assets/profile-icons/exploring-map.webp',
  'timeline-join': '/assets/profile-icons/timeline-join.webp',
  'timeline-projects': '/assets/profile-icons/timeline-projects.webp',
  'timeline-observation': '/assets/profile-icons/timeline-observation.webp',
  'timeline-achievement': '/assets/profile-icons/timeline-achievement.webp',
  'timeline-growth': '/assets/profile-icons/timeline-growth.webp',
}

export const PROFILE_ACTION_GRID_ICONS = {
  content: '/assets/profile-icons/action-content.webp',
  wallet: '/assets/profile-icons/action-wallet.webp',
  shop: '/assets/profile-icons/action-shop.webp',
  invite: '/assets/profile-icons/action-invite.webp',
  messages: '/assets/profile-icons/action-messages.webp',
} as const

const TIMELINE_TO_SPOT: Record<ProfileTimelineIconName, ProfileSpotIconName> = {
  timeline: 'timeline-join',
  projects: 'timeline-projects',
  observation: 'timeline-observation',
  achievement: 'timeline-achievement',
  growth: 'timeline-growth',
}

function profileIconFrameClass(size: keyof typeof PROFILE_SPOT_ICON_SIZES = 'md') {
  return cn(
    'profile-spot-icon relative grid shrink-0 place-items-center overflow-hidden',
    PROFILE_SPOT_ICON_SIZES[size],
  )
}

export function ProfileSpotIcon({
  name,
  className,
  size = 'md',
}: {
  name: ProfileSpotIconName
  className?: string
  size?: keyof typeof PROFILE_SPOT_ICON_SIZES
}) {
  return (
    <span className={cn(profileIconFrameClass(size), className)}>
      <Image
        src={PROFILE_SPOT_ICON_SRC[name]}
        alt=""
        width={44}
        height={44}
        className="h-full w-full object-contain"
        aria-hidden
      />
    </span>
  )
}

export function ProfileModuleIcon({
  src,
  className,
  size = 'md',
  label,
}: {
  src: string
  className?: string
  size?: keyof typeof PROFILE_SPOT_ICON_SIZES
  label?: string
}) {
  return (
    <span className={cn(profileIconFrameClass(size), className)} aria-hidden={label ? undefined : true}>
      <Image
        src={src}
        alt=""
        width={44}
        height={44}
        className="h-full w-full object-contain"
        aria-hidden={!!label}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

export function profileTimelineSpotName(name: ProfileTimelineIconName): ProfileSpotIconName {
  return TIMELINE_TO_SPOT[name]
}

export function isProfileTimelineIconName(name: string): name is ProfileTimelineIconName {
  return name in TIMELINE_TO_SPOT
}
