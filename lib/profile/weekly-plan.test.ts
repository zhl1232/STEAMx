import { describe, expect, it } from 'vitest'

import type { Challenge, Project } from '@/lib/mappers/types'
import type { NaturalObservationProgressSummary } from '@/lib/observations/progress'
import type { ProfileGrowthTask } from '@/lib/profile/growth-tasks'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
import type { SteamRadarWithGuidance } from '@/lib/profile/steam-radar'
import { buildWeeklyPlan, formatWeeklyPlanForTutor, getWeeklyPlanWeekStart } from './weekly-plan'

const now = new Date('2026-06-11T09:00:00.000Z')

function makeProject(id: number, title: string): Project {
  return {
    id,
    title,
    image: '',
    author: 'test',
    author_id: 'user-1',
    category: '科学',
    likes: 0,
  } as Project
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

function makeRadar(): SteamRadarWithGuidance {
  return {
    S: { raw: 0, display: 0, tier: 'none', guidance: '先完成一个科学项目' },
    T: { raw: 80, display: 80, tier: 'advanced', guidance: null },
    E: { raw: 80, display: 80, tier: 'advanced', guidance: null },
    A: { raw: 80, display: 80, tier: 'advanced', guidance: null },
    M: { raw: 80, display: 80, tier: 'advanced', guidance: null },
  }
}

function makeNatureProgress(): NaturalObservationProgressSummary {
  return {
    totalObservations: 1,
    uniqueSpeciesCount: 1,
    topicProgress: [
      {
        topic: 'all',
        label: '全部物种',
        total: 10,
        observedCount: 1,
        unobservedCount: 9,
        progressPercent: 10,
      },
    ],
    unobservedSpeciesPreview: [
      {
        id: 1,
        slug: 'egret',
        commonName: '白鹭',
        aliases: [],
        isActive: true,
      },
    ],
  }
}

function makeTimelineEvent(overrides: Partial<ProfileTimelineEvent> = {}): ProfileTimelineEvent {
  return {
    id: 'evt-1',
    kind: 'project_completed',
    occurredAt: '2026-06-10T04:00:00.000Z',
    dateLabel: '6.10',
    fullDateLabel: '2026/06/10 12:00',
    label: '完成项目',
    detail: '纸飞机挑战',
    href: '/project/1',
    iconName: 'projects',
    status: 'approved',
    ...overrides,
  }
}

const baseInput = {
  exploringProjects: [] as Project[],
  steamRadar: null,
  myProjects: [] as Project[],
  myObservations: [],
  profileTimelineEvents: null as ProfileTimelineEvent[] | null,
  now,
}

describe('getWeeklyPlanWeekStart', () => {
  it('returns Monday midnight in Asia/Shanghai as ISO time', () => {
    expect(getWeeklyPlanWeekStart(now)).toBe('2026-06-07T16:00:00.000Z')
  })
})

describe('buildWeeklyPlan', () => {
  it('builds a starter plan for empty profiles', () => {
    const plan = buildWeeklyPlan(baseInput)

    expect(plan.completedCount).toBe(0)
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps.map((step) => step.href)).toEqual(['/share', '/nature/submit', '/playground'])
  })

  it('prioritizes reward, PBL, exploring, course, and radar steps', () => {
    const challenge = {
      id: 8,
      title: '社区节水挑战',
      image: '',
      stages: [{ title: '测试方案', description: '测试' }],
    } as Challenge

    const plan = buildWeeklyPlan({
      ...baseInput,
      myProjects: [makeProject(1, '已有作品')],
      steamRadar: makeRadar(),
      exploringProjects: [makeProject(42, '太阳能小车')],
      growthTasks: [
        makeGrowthTask({
          id: 'submit_first_observation',
          label: '记录 1 条自然观察',
          href: '/nature/submit',
          done: true,
          claimable: true,
          status: 'claimable',
        }),
      ],
      inProgressPbl: {
        challenge,
        nextStageIndex: 0,
        nextStageTitle: '测试方案',
        completedStages: 1,
        totalStages: 3,
      },
      inProgressCourse: {
        courseId: 3,
        courseTitle: 'Scratch 入门',
        lessonId: 11,
        lessonTitle: '做一个接苹果游戏',
        completedLessons: 1,
        totalLessons: 5,
      },
      naturalObservationProgress: makeNatureProgress(),
    })

    expect(plan.steps.map((step) => step.type)).toEqual(['reward', 'pbl', 'exploring', 'course', 'radar'])
    expect(plan.steps[1].href).toBe('/pbl/8')
    expect(plan.steps[3].href).toBe('/courses/3/lessons/11')
  })

  it('keeps up to three done steps and fills the rest with todos', () => {
    const plan = buildWeeklyPlan({
      ...baseInput,
      myProjects: [makeProject(1, '已有作品')],
      steamRadar: makeRadar(),
      profileTimelineEvents: [
        makeTimelineEvent({ id: 'newest', occurredAt: '2026-06-11T03:00:00.000Z', label: '最新完成' }),
        makeTimelineEvent({ id: 'middle', occurredAt: '2026-06-10T03:00:00.000Z', label: '中间完成' }),
        makeTimelineEvent({ id: 'old', occurredAt: '2026-06-09T03:00:00.000Z', label: '较早完成' }),
        makeTimelineEvent({ id: 'older', occurredAt: '2026-06-08T03:00:00.000Z', label: '第四条' }),
      ],
    })

    expect(plan.steps).toHaveLength(5)
    expect(plan.completedCount).toBe(3)
    expect(plan.steps.slice(0, 3).map((step) => step.title)).toEqual(['最新完成', '中间完成', '较早完成'])
    expect(plan.steps.slice(0, 3).map((step) => step.actionLabel)).toEqual([
      '查看记录',
      '查看记录',
      '查看记录',
    ])
    expect(plan.steps[3].status).toBe('todo')
  })

  it('formats tutor summary with project chips', () => {
    const plan = buildWeeklyPlan({
      ...baseInput,
      myProjects: [makeProject(1, '已有作品')],
      exploringProjects: [makeProject(42, '太阳能小车')],
    })

    expect(formatWeeklyPlanForTutor(plan)).toContain('[project:42|太阳能小车]')
  })
})
