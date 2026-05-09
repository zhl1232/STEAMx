import { describe, expect, it } from 'vitest'

import { buildProfileTimelineEvents, formatProfileTimelineDateLabels } from './timeline'

describe('profile timeline', () => {
  it('sorts real events by occurred time and keeps only actual rows', () => {
    const events = buildProfileTimelineEvents({
      accountCreatedAt: '2026-02-27T02:00:00.000Z',
      projects: [
        {
          id: 10,
          title: '风力小车',
          createdAt: '2026-05-03T01:00:00.000Z',
          status: 'approved',
        },
      ],
      observations: [
        {
          id: 20,
          title: '白头鹎',
          observedAt: '2026-05-04T01:00:00.000Z',
          status: 'approved',
        },
      ],
    })

    expect(events.map((event) => event.label)).toEqual(['自然观察', '发布作品', '加入探索'])
    expect(events[0]).toMatchObject({
      detail: '白头鹎',
      href: '/nature/observations/20',
      statusLabel: '已通过',
    })
  })

  it('falls back to the account creation event when there is no learning activity', () => {
    const events = buildProfileTimelineEvents({
      accountCreatedAt: '2026-02-27T02:00:00.000Z',
      projects: [],
      observations: [],
      badges: [],
      xpLogs: [],
    })

    expect(events).toEqual([
      expect.objectContaining({
        id: 'account:created',
        label: '加入探索',
        detail: '开始记录 STEAM 探索',
      }),
    ])
  })

  it('attaches matching XP logs to project, observation, and challenge events', () => {
    const events = buildProfileTimelineEvents({
      completedProjects: [
        {
          id: 1,
          projectId: 101,
          projectTitle: '纸桥承重',
          completedAt: '2026-05-03T01:00:00.000Z',
          status: 'approved',
        },
      ],
      observations: [
        {
          id: 202,
          title: '喜鹊',
          observedAt: '2026-05-04T01:00:00.000Z',
          status: 'approved',
        },
      ],
      challengeSubmissions: [
        {
          id: 3,
          challengeId: 303,
          challengeTitle: '蚂蚁观察挑战',
          createdAt: '2026-05-05T01:00:00.000Z',
          status: 'approved',
        },
      ],
      xpLogs: [
        {
          id: 'xp-project',
          actionType: 'complete_project',
          resourceId: '101',
          xpAmount: 50,
          createdAt: '2026-05-03T02:00:00.000Z',
        },
        {
          id: 'xp-observation',
          actionType: 'submit_observation',
          resourceId: '202',
          xpAmount: 10,
          createdAt: '2026-05-04T02:00:00.000Z',
        },
        {
          id: 'xp-challenge',
          actionType: 'complete_challenge',
          resourceId: '303',
          xpAmount: 40,
          createdAt: '2026-05-05T02:00:00.000Z',
        },
      ],
    })

    expect(events.find((event) => event.kind === 'project_completed')).toMatchObject({ xpAmount: 50 })
    expect(events.find((event) => event.kind === 'observation_submitted')).toMatchObject({ xpAmount: 10 })
    expect(events.find((event) => event.kind === 'challenge_completed')).toMatchObject({ xpAmount: 40 })
    expect(events.filter((event) => event.kind === 'xp_gained')).toHaveLength(0)
  })

  it('keeps standalone daily login and growth task XP as experience events', () => {
    const events = buildProfileTimelineEvents({
      xpLogs: [
        {
          id: 'daily',
          actionType: 'daily_login',
          resourceId: '2026-05-07',
          xpAmount: 12,
          createdAt: '2026-05-07T01:00:00.000Z',
        },
        {
          id: 'task',
          actionType: 'profile_growth_task',
          resourceId: 'submit_first_observation',
          xpAmount: 10,
          createdAt: '2026-05-06T01:00:00.000Z',
        },
        {
          id: 'comment',
          actionType: 'comment_project',
          resourceId: '55',
          xpAmount: 1,
          createdAt: '2026-05-05T01:00:00.000Z',
        },
      ],
    })

    expect(events.map((event) => event.detail)).toEqual(['每日探索签到', '记录 1 条自然观察'])
    expect(events.every((event) => event.kind === 'xp_gained')).toBe(true)
  })

  it('formats dates in the profile timeline time zone', () => {
    expect(formatProfileTimelineDateLabels('2026-05-06T16:30:00.000Z')).toEqual({
      dateLabel: '5.07',
      fullDateLabel: '2026/05/07 00:30',
    })
  })
})
