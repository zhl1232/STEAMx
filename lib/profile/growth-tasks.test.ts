import { describe, expect, it } from 'vitest'

import {
  countDistinctClaimedGrowthTaskRewards,
  getCompletedGrowthTaskCount,
  isAllGrowthTasksClaimed,
  resolveGrowthTasks,
  toGrowthTaskInput,
} from './growth-tasks'

describe('growth tasks', () => {
  it('builds first-week tasks from profile and stats input', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '',
        stats: {
          lessonsStarted: 1,
          lessonsCompleted: 0,
          worksPublished: 0,
          observationsSubmitted: 1,
        },
      }),
    )

    expect(tasks).toEqual([
      expect.objectContaining({
        id: 'start_first_lesson',
        progressLabel: '1/1',
        status: 'claimable',
        done: true,
      }),
      expect.objectContaining({
        id: 'complete_first_lesson',
        reward: '+20 经验',
        progressLabel: '0/1',
        status: 'in_progress',
        done: false,
      }),
      expect.objectContaining({
        id: 'publish_first_work',
        reward: '+30 经验',
        progressLabel: '0/1',
        status: 'in_progress',
        done: false,
      }),
      expect.objectContaining({
        id: 'write_bio',
        progressLabel: '待填写',
        status: 'in_progress',
        done: false,
      }),
      expect.objectContaining({
        id: 'submit_first_observation',
        progressLabel: '1/1',
        status: 'claimable',
        done: true,
      }),
    ])
  })

  it('marks claimed tasks and counts completed milestones', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '你好，我喜欢做实验',
        stats: {
          lessonsStarted: 3,
          lessonsCompleted: 2,
          worksPublished: 1,
          observationsSubmitted: 1,
        },
      }),
      new Set(['start_first_lesson', 'submit_first_observation']),
    )

    expect(tasks.find((task) => task.id === 'start_first_lesson')).toMatchObject({
      claimed: true,
      claimable: false,
      status: 'claimed',
    })
    expect(tasks.find((task) => task.id === 'publish_first_work')).toMatchObject({
      claimed: false,
      claimable: true,
      status: 'claimable',
    })
    expect(getCompletedGrowthTaskCount(tasks)).toBe(5)
  })

  it('falls back to projectsCompleted when worksPublished is missing', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '',
        stats: { projectsCompleted: 1 },
      }),
    )

    expect(tasks.find((task) => task.id === 'publish_first_work')).toMatchObject({
      done: true,
      status: 'claimable',
    })
  })

  it('treats whitespace-only bio as incomplete', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '   ',
        stats: null,
      }),
    )

    expect(tasks.find((task) => task.id === 'write_bio')).toMatchObject({
      progress: 0,
      done: false,
      status: 'in_progress',
    })
  })

  it('countDistinctClaimedGrowthTaskRewards ignores unknown resource_ids', () => {
    expect(
      countDistinctClaimedGrowthTaskRewards([
        { resource_id: 'write_bio' },
        { resource_id: 'write_bio' },
        { resource_id: 'bogus' },
        { resource_id: null },
      ]),
    ).toBe(1)
  })

  it('isAllGrowthTasksClaimed is true only when every task is claimed', () => {
    const input = toGrowthTaskInput({
      bio: 'hi',
      stats: {
        lessonsStarted: 1,
        lessonsCompleted: 1,
        worksPublished: 1,
        observationsSubmitted: 1,
      },
    })
    const partialClaimed = resolveGrowthTasks(input, new Set(['write_bio']))
    expect(isAllGrowthTasksClaimed(partialClaimed)).toBe(false)

    const allClaimed = resolveGrowthTasks(
      input,
      new Set([
        'start_first_lesson',
        'complete_first_lesson',
        'publish_first_work',
        'write_bio',
        'submit_first_observation',
      ]),
    )
    expect(isAllGrowthTasksClaimed(allClaimed)).toBe(true)
  })
})
