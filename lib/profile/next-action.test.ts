import { describe, expect, it } from 'vitest'

import type { Project } from '@/lib/mappers/types'
import type { ProfileTimelineEvent } from '@/lib/profile/timeline'
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
  })
})

describe('resolveProfileNextAction', () => {
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

  it('returns vacuum guidance for new users', () => {
    const action = resolveProfileNextAction(emptyInput)

    expect(action.variant).toBe('vacuum')
    expect(action.href).toBe('/project')
    expect(action.secondaryHref).toBe('/nature/submit')
  })

  it('shows latest timeline event when no exploring and not vacuum', () => {
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '已有作品')],
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
    const action = resolveProfileNextAction({
      ...emptyInput,
      myProjects: [makeProject(1, '作品')],
      profileTimelineEvents: [],
    })

    expect(action.variant).toBe('explore')
    expect(action.href).toBe('/explore')
  })
})
