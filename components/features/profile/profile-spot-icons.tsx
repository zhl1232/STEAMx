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
  | 'plan-pbl'
  | 'plan-radar'
  | 'plan-playground'
  | 'plan-xp'

export const PROFILE_SPOT_ICON_SIZES = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-12 w-12 min-[390px]:h-[52px] min-[390px]:w-[52px]',
} as const

const PROFILE_SPOT_ICON_PIXELS: Record<keyof typeof PROFILE_SPOT_ICON_SIZES, number> = {
  sm: 40,
  md: 48,
  lg: 52,
}

const PROFILE_SPOT_ICON_SRC: Record<ProfileSpotIconName, string> = {
  'growth-quest': '/assets/profile-icons/growth-quest.webp',
  'exploring-map': '/assets/profile-icons/exploring-map.webp',
  'timeline-join': '/assets/profile-icons/timeline-join.webp',
  'timeline-projects': '/assets/profile-icons/timeline-projects.webp',
  'timeline-observation': '/assets/profile-icons/timeline-observation.webp',
  'timeline-achievement': '/assets/profile-icons/timeline-achievement.webp',
  'timeline-growth': '/assets/profile-icons/timeline-growth.webp',
  'plan-pbl': '/assets/profile-icons/plan-pbl.webp',
  'plan-radar': '/assets/profile-icons/plan-radar.webp',
  'plan-playground': '/assets/profile-icons/plan-playground.webp',
  'plan-xp': '/assets/profile-icons/plan-xp.webp',
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
  const pixelSize = PROFILE_SPOT_ICON_PIXELS[size]

  return (
    <span className={cn(profileIconFrameClass(size), className)}>
      <Image
        src={PROFILE_SPOT_ICON_SRC[name]}
        alt=""
        width={pixelSize}
        height={pixelSize}
        unoptimized
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
  const pixelSize = PROFILE_SPOT_ICON_PIXELS[size]

  return (
    <span className={cn(profileIconFrameClass(size), className)} aria-hidden={label ? undefined : true}>
      <Image
        src={src}
        alt=""
        width={pixelSize}
        height={pixelSize}
        unoptimized
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
