import type { ObservationEvent, Project } from '@/lib/mappers/types'
import type { ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import type { ProfileStudyCheckInSummary } from '@/lib/profile/study-checkin'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

export type ProfileHomeData = {
  myProjects: Project[]
  myProjectsTotalCount: number
  followerCount: number
  followingCount: number
  totalLikesReceived: number
  steamRadar: SteamRadarWithGuidance | null
  profileTimelineEvents: ProfileTimelineEvent[]
  growthTasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  studyCheckInSummary: ProfileStudyCheckInSummary | null
}

const inflightByUserId = new Map<string, Promise<ProfileHomeData>>()

async function parseJsonResponse(response: Response) {
  return response.json().catch(() => ({}))
}

export async function fetchProfileHomeData(userId: string): Promise<ProfileHomeData> {
  const inflight = inflightByUserId.get(userId)
  if (inflight) {
    return inflight
  }

  const promise = (async () => {
    const [summaryRes, timelineRes, growthRes, observationsRes, checkinRes] = await Promise.all([
      fetch('/api/profile/summary'),
      fetch('/api/profile/timeline?limit=5'),
      fetch('/api/profile/growth-tasks/sync', { method: 'POST' }),
      fetch('/api/observations/mine?pageSize=6'),
      fetch('/api/profile/study-checkin'),
    ])

    const [summaryPayload, timelinePayload, growthPayload, observationsPayload, checkinPayload] =
      await Promise.all([
        parseJsonResponse(summaryRes),
        parseJsonResponse(timelineRes),
        parseJsonResponse(growthRes),
        parseJsonResponse(observationsRes),
        parseJsonResponse(checkinRes),
      ])

    if (!summaryRes.ok) {
      throw new Error(summaryPayload?.error || '个人主页摘要加载失败')
    }
    if (!timelineRes.ok) {
      throw new Error(timelinePayload?.error || '探索轨迹加载失败')
    }
    if (!growthRes.ok) {
      throw new Error(growthPayload?.error || '成长任务加载失败')
    }
    if (!observationsRes.ok) {
      throw new Error(observationsPayload?.error || '观察记录加载失败')
    }
    if (!checkinRes.ok) {
      throw new Error(checkinPayload?.error || '探索打卡加载失败')
    }

    const graduatedAt =
      typeof growthPayload?.graduatedAt === 'string' && growthPayload.graduatedAt
        ? growthPayload.graduatedAt
        : null

    return {
      myProjects: (summaryPayload?.myProjects as Project[] | undefined) || [],
      myProjectsTotalCount: Number(summaryPayload?.myProjectsTotalCount || 0),
      followerCount: Number(summaryPayload?.followerCount || 0),
      followingCount: Number(summaryPayload?.followingCount || 0),
      totalLikesReceived: Number(summaryPayload?.totalLikesReceived || 0),
      steamRadar: (summaryPayload?.radar as SteamRadarWithGuidance | null) || null,
      profileTimelineEvents: (timelinePayload?.events as ProfileTimelineEvent[] | undefined) || [],
      growthTasks: (growthPayload?.tasks as ProfileGrowthTask[] | undefined) || [],
      growthTasksGraduatedAt: graduatedAt,
      myObservations: (observationsPayload?.observations as ObservationEvent[] | undefined) || [],
      observationsTotal: Number(observationsPayload?.total || 0),
      studyCheckInSummary: (checkinPayload as ProfileStudyCheckInSummary | null) ?? null,
    }
  })().finally(() => {
    inflightByUserId.delete(userId)
  })

  inflightByUserId.set(userId, promise)
  return promise
}

export function invalidateProfileHomeData(userId: string) {
  inflightByUserId.delete(userId)
}
