'use client'

import type { ProfileTimelineIconName } from '@/lib/profile/timeline'
import { cn } from '@/lib/utils'

import {
  ProfileSpotIcon,
  PROFILE_SPOT_ICON_SIZES,
  profileTimelineSpotName,
  type ProfileSpotIconName,
} from './profile-spot-icons'

export { isProfileTimelineIconName } from './profile-spot-icons'

export const PROFILE_MILESTONE_ICON_SIZES = PROFILE_SPOT_ICON_SIZES

export function profileMilestoneIconFrameClass(size: keyof typeof PROFILE_SPOT_ICON_SIZES = 'md') {
  return cn('grid shrink-0 place-items-center overflow-visible', PROFILE_SPOT_ICON_SIZES[size])
}

export function ProfileTimelineIcon({
  name,
  className,
  size = 'md',
}: {
  name: ProfileTimelineIconName
  className?: string
  size?: keyof typeof PROFILE_SPOT_ICON_SIZES
}) {
  const spotName: ProfileSpotIconName = profileTimelineSpotName(name)

  return <ProfileSpotIcon name={spotName} size={size} className={className} />
}
