import type { ObservationEvent, Project, Work } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import {
  buildExploringActivityMap,
  type ExploringActivityMeta,
} from '@/lib/profile/exploring-projects-card'
import type { ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import { fetchProfileSummary } from '@/lib/profile/profile-summary-client'
import type { ProfileStudyCheckInSummary } from '@/lib/profile/study-checkin'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'

export type ProfileHomeSection = 'timeline' | 'growthTasks' | 'observations' | 'studyCheckIn' | 'exploringProjects'

export type ProfileHomeData = {
  failedSections?: ProfileHomeSection[]
  myProjects: Project[]
  myProjectsTotalCount: number
  myWorks: Work[]
  myWorksTotalCount: number
  followerCount: number
  followingCount: number
  totalLikesReceived: number
  steamRadar: SteamRadarWithGuidance | null
  exploringProjects: Project[]
  exploringLastActivityByProjectId: Record<number, string>
  profileTimelineEvents: ProfileTimelineEvent[]
  growthTasks: ProfileGrowthTask[]
  growthTasksGraduatedAt: string | null
  myObservations: ObservationEvent[]
  observationsTotal: number
  naturalObservationProgress: NaturalObservationProgressSummary | null
  studyCheckInSummary: ProfileStudyCheckInSummary | null
}

/** Retain the last successful values while keeping each failed area's error state. */
export function mergeProfileHomeData(previous: ProfileHomeData | undefined, next: ProfileHomeData): ProfileHomeData {
  if (!previous || !next.failedSections?.length) return next

  const merged = { ...next }
  for (const section of next.failedSections) {
    switch (section) {
      case 'timeline':
        merged.profileTimelineEvents = previous.profileTimelineEvents
        break
      case 'growthTasks':
        merged.growthTasks = previous.growthTasks
        merged.growthTasksGraduatedAt = previous.growthTasksGraduatedAt
        break
      case 'observations':
        merged.myObservations = previous.myObservations
        merged.observationsTotal = previous.observationsTotal
        break
      case 'studyCheckIn':
        merged.studyCheckInSummary = previous.studyCheckInSummary
        break
      case 'exploringProjects':
        merged.exploringProjects = previous.exploringProjects
        merged.exploringLastActivityByProjectId = previous.exploringLastActivityByProjectId
        break
    }
  }
  return merged
}

const inflightByUserId = new Map<string, Promise<ProfileHomeData>>()

async function fetchSection<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = await response.json()
  if (!response.ok || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('个人中心区域加载失败')
  }
  return payload as T
}

export async function fetchProfileHomeData(userId: string): Promise<ProfileHomeData> {
  const inflight = inflightByUserId.get(userId)
  if (inflight) {
    return inflight
  }

  const promise = (async () => {
    const [summaryResult, timelineResult, growthResult, observationsResult, checkinResult, exploringResult] = await Promise.allSettled([
      fetchProfileSummary(userId),
      fetchSection<{ events?: ProfileTimelineEvent[] }>('/api/profile/timeline?limit=5'),
      fetchSection<{ tasks?: ProfileGrowthTask[]; graduatedAt?: string | null }>('/api/profile/growth-tasks/sync', { method: 'POST' }),
      fetchSection<{ observations?: ObservationEvent[]; total?: number }>('/api/observations/mine?pageSize=6'),
      fetchSection<ProfileStudyCheckInSummary>('/api/profile/study-checkin'),
      fetchSection<{ projects?: Project[]; explorations?: ExploringActivityMeta[] }>('/api/profile/projects?type=exploring'),
    ])

    // Identity and outcome totals must never be replaced with an empty profile.
    if (summaryResult.status === 'rejected') throw summaryResult.reason
    const summary = summaryResult.value
    const failedSections: ProfileHomeSection[] = []
    function sectionValue<T>(section: ProfileHomeSection, result: PromiseSettledResult<T>): T | null {
      if (result.status === 'fulfilled') return result.value
      failedSections.push(section)
      return null
    }
    const timelinePayload = sectionValue('timeline', timelineResult)
    const growthPayload = sectionValue('growthTasks', growthResult)
    const observationsPayload = sectionValue('observations', observationsResult)
    const checkinPayload = sectionValue('studyCheckIn', checkinResult)
    const exploringPayload = sectionValue('exploringProjects', exploringResult)

    const graduatedAt =
      typeof growthPayload?.graduatedAt === 'string' && growthPayload.graduatedAt
        ? growthPayload.graduatedAt
        : null

    return {
      failedSections,
      myProjects: summary.myProjects,
      myProjectsTotalCount: summary.myProjectsTotalCount,
      myWorks: summary.myWorks,
      myWorksTotalCount: summary.myWorksTotalCount,
      followerCount: summary.followerCount,
      followingCount: summary.followingCount,
      totalLikesReceived: summary.totalLikesReceived,
      steamRadar: summary.steamRadar,
      exploringProjects: exploringPayload?.projects ?? [],
      exploringLastActivityByProjectId: buildExploringActivityMap(
        exploringPayload?.explorations,
      ),
      profileTimelineEvents: timelinePayload?.events ?? [],
      growthTasks: growthPayload?.tasks ?? [],
      growthTasksGraduatedAt: graduatedAt,
      myObservations: observationsPayload?.observations ?? [],
      observationsTotal: Number(observationsPayload?.total || 0),
      naturalObservationProgress: summary.naturalObservationProgress,
      studyCheckInSummary: checkinPayload,
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
