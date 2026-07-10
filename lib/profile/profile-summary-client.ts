import type { Project, Work } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

export type ProfileSummaryData = {
  myProjects: Project[]
  myProjectsTotalCount: number
  myWorks: Work[]
  myWorksTotalCount: number
  followerCount: number
  followingCount: number
  likedProjectsCount: number
  collectedProjectsCount: number
  completedProjectsCount: number
  totalLikesReceived: number
  naturalObservationProgress: NaturalObservationProgressSummary | null
  steamRadar: SteamRadarWithGuidance | null
}

const inflightByUserId = new Map<string, Promise<ProfileSummaryData>>()

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}))
}

export const profileSummaryQueryKey = (userId: string | undefined) =>
  ['profile', 'summary', userId] as const

export async function fetchProfileSummary(_userId: string): Promise<ProfileSummaryData> {
  const inflight = inflightByUserId.get(_userId)
  if (inflight) {
    return inflight
  }

  const promise = (async () => {
    const response = await fetch('/api/profile/summary')
    const payload = await parseJsonResponse(response)

    if (!response.ok) {
      throw new Error(payload?.error || '个人主页摘要加载失败')
    }

    return {
      myProjects: (payload?.myProjects as Project[] | undefined) || [],
      myProjectsTotalCount: Number(payload?.myProjectsTotalCount || 0),
      myWorks: (payload?.myWorks as Work[] | undefined) || [],
      myWorksTotalCount: Number(payload?.myWorksTotalCount || 0),
      followerCount: Number(payload?.followerCount || 0),
      followingCount: Number(payload?.followingCount || 0),
      likedProjectsCount: Number(payload?.likedProjectsCount || 0),
      collectedProjectsCount: Number(payload?.collectedProjectsCount || 0),
      completedProjectsCount: Number(payload?.completedProjectsCount || 0),
      totalLikesReceived: Number(payload?.totalLikesReceived || 0),
      naturalObservationProgress:
        (payload?.naturalObservationProgress as NaturalObservationProgressSummary | null | undefined) || null,
      steamRadar: (payload?.radar as SteamRadarWithGuidance | null) || null,
    }
  })().finally(() => {
    inflightByUserId.delete(_userId)
  })

  inflightByUserId.set(_userId, promise)
  return promise
}

export function invalidateProfileSummary(userId: string) {
  inflightByUserId.delete(userId)
}
