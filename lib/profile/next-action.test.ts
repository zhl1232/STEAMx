import { describe, expect, it } from 'vitest'

import type { Project, Work } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import type { ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { isExploreVacuum, resolveProfileNextAction } from './next-action'

function makeProject(id: number, title: string): Project {
  return {
    id,
    title,
    image: '',
    author: 'test',
    author_id: 'user-1',
    category: 'science',
    likes: 0,
    views_count: 0,
  } as Project
}

function makeTimelineEvent(overrides: Partial<ProfileTimelineEvent> = {}): ProfileTimelineEvent {
  return {
    id: 'evt-1',
    kind: 'project_completed',
    occurredAt: '2026-05-01T00:00:00.000Z',
    dateLabel: '5月1日',
    fullDateLabel: '2026年5月1日',
    label: '完成项目',
    detail: '纸飞机挑战',
    href: '/project/1',
    iconName: 'projects',
    status: 'neutral',
    ...overrides,
  }
}

function makeGrowthTask(overrides: Partial<ProfileGrowthTask> = {}): ProfileGrowthTask {
  return {
    id: 'publish_first_project',
    label: '发布 1 个项目',
    href: '/share',
    rewardXp: 20,
    reward: '+20 经验',
    target: 1,
    currentValue: 0,
    progressLabel: '0/1',
    progress: 0,
    done: false,
    claimed: false,
    claimable: false,
    status: 'in_progress',
    ...overrides,
  }
}

function makeRadar(overrides: Partial<SteamRadarWithGuidance> = {}): SteamRadarWithGuidance {
  return {
    S: { raw: 0, display: 0, tier: 'none', guidance: '还没探索过科学领域' },
    T: { raw: 40, display: 18, tier: 'foundation', guidance: '完成一个技术项目' },
    E: { raw: 110, display: 42, tier: 'foundation', guidance: '完成一个工程项目' },
    A: { raw: 160, display: 56, tier: 'foundation', guidance: '完成一个艺术项目' },
    M: { raw: 210, display: 66, tier: 'intermediate', guidance: '完成一个数学项目' },
    ...overrides,
  }
}

function makeNatureProgress(): NaturalObservationProgressSummary {
  return {
    totalObservations: 2,
    uniqueSpeciesCount: 1,
    topicProgress: [
      {
        topic: 'all',
        label: '全部物种',
        total: 12,
        observedCount: 1,
        unobservedCount: 11,
        progressPercent: 8,
      },
    ],
    unobservedSpeciesPreview: [
      {
        id: 7,
        slug: 'egret',
        commonName: '白鹭',
        aliases: [],
        isActive: true,
      },
    ],
  }
}

const emptyInput = {
  exploringProjects: [] as Project[],
  steamRadar: null,
  myProjects: [] as Project[],
  myObservations: [],
  profileTimelineEvents: null as ProfileTimelineEvent[] | null,
}

describe('isExploreVacuum', () => {
  it('returns true when radar, projects, and observations are all empty', () => {
    expect(isExploreVacuum(emptyInput)).toBe(true)
  })

  it('returns false when any content exists', () => {
    expect(isExploreVacuum({ ...emptyInput, myProjects: [makeProject(1, 'A')] })).toBe(false)
    expect(isExploreVacuum({
      ...emptyInput,
      myWorks: [{ id: 1 }] as Work[],
    })).toBe(false)
  })

  it('treats all-zero radar as empty but non-zero radar as existing progress', () => {
    expect(isExploreVacuum({ ...emptyInput, steamRadar: makeRadar({
      T: { raw: 0, display: 0, tier: 'none', guidance: null },
      E: { raw: 0, display: 0, tier: 'none', guidance: null },
      A: { raw: 0, display: 0, tier: 'none', guidance: null },
      M: { raw: 0, display: 0, tier: 'none', guidance: null },
    }) })).toBe(true)

    expect(isExploreVacuum({ ...emptyInput, steamRadar: makeRadar() })).toBe(false)
  })
})

describe('resolveProfileNextAction', () => {
  it('prioritizes claimable growth task rewards', () => {
    const action = resolveProfileNextAction({
      ...emptyInput,
      growthTasks: [
        makeGrowthTask({
          id: 'submit_first_observation',
          label: '记录 1 条自然观察',
          href: '/nature/submit',
          rewardXp: 10,
          reward: '+10 经验',
          done: true,
          claimable: true,
          status: 'claimable',
        }),
      ],
    })

    expect(action.variant).toBe('reward')
    expect(action.actionLabel).toBe('领取奖励')
    expect(action.growthTaskId).toBe('submit_first_observation')
  })

  it('prioritizes exploring project', () => {
    const action = resolveProfileNextAction({
      ...emptyInput,
      exploringProjects: [makeProject(42, '太阳能小车'), makeProject(43, '风铃')],
    })

    expect(action.variant).toBe('exploring')
    expect(action.title).toBe('太阳能小车')
    expect(action.href).toBe('/project/42/records')
    expect(action.actionLabel).toBe('继续探索')
    expect(action.secondaryHref).toBe('/profile/library?tab=exploring')
  })

  it('shows an unfinished growth task before generic onboarding', () => {
    const action = resolveProfileNextAction({
      ...emptyInput,
      growthTasks: [makeGrowthTask()],
    })

    expect(action.variant).toBe('growth')
    expect(action.href).toBe('/share')
    expect(action.actionLabel).toBe('去完成')
  })

  it('returns vacuum guidance for new users', () => {
    const action = resolveProfileNextAction(emptyInput)

    expect(action.variant).toBe('vacuum')
    expect(action.href).toBe('/project')
    expect(action.secondaryHref).toBe('/nature/submit')
  })

  it('recommends the weakest STEAM dimension before timeline review', () => {
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '已有作品')],
      steamRadar: makeRadar(),
      profileTimelineEvents: [makeTimelineEvent()],
    })

    expect(action.variant).toBe('radar')
    expect(action.title).toBe('科学能力补给')
    expect(action.href).toBe('/explore?category=%E7%A7%91%E5%AD%A6')
  })

  it('recommends unobserved species after radar is healthy', () => {
    const healthyRadar = makeRadar({
      S: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      T: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      E: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      A: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      M: { raw: 400, display: 80, tier: 'advanced', guidance: null },
    })
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '已有作品')],
      steamRadar: healthyRadar,
      naturalObservationProgress: makeNatureProgress(),
    })

    expect(action.variant).toBe('nature')
    expect(action.title).toBe('寻找白鹭')
    expect(action.href).toBe('/nature/species?status=unobserved')
    expect(action.secondaryHref).toBe('/nature/submit')
  })

  it('shows latest timeline event when no exploring and not vacuum', () => {
    const healthyRadar = makeRadar({
      S: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      T: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      E: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      A: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      M: { raw: 400, display: 80, tier: 'advanced', guidance: null },
    })
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '已有作品')],
      steamRadar: healthyRadar,
      profileTimelineEvents: [
        makeTimelineEvent({ id: 'old', label: '旧事件', href: '/old' }),
        makeTimelineEvent({ id: 'new', label: '最新完成', detail: '机器人', href: '/project/9' }),
      ],
    })

    expect(action.variant).toBe('timeline')
    expect(action.title).toBe('最新完成')
    expect(action.href).toBe('/project/9')
  })

  it('falls back to explore', () => {
    const healthyRadar = makeRadar({
      S: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      T: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      E: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      A: { raw: 400, display: 80, tier: 'advanced', guidance: null },
      M: { raw: 400, display: 80, tier: 'advanced', guidance: null },
    })
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '作品')],
      steamRadar: healthyRadar,
      profileTimelineEvents: [],
    })

    expect(action.variant).toBe('explore')
    expect(action.href).toBe('/explore')
  })
})
