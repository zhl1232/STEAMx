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
          projectsPublished: 1,
          projectsCompleted: 0,
          observationsSubmitted: 1,
          consecutiveDays: 2,
        },
      }),
    )

    expect(tasks).toEqual([
      expect.objectContaining({
        id: 'write_bio',
        progressLabel: '待填写',
        status: 'in_progress',
        done: false,
      }),
      expect.objectContaining({
        id: 'publish_first_project',
        reward: '+20 经验',
        progressLabel: '1/1',
        status: 'claimable',
        done: true,
      }),
      expect.objectContaining({
        id: 'complete_first_project',
        progressLabel: '0/1',
        status: 'in_progress',
        done: false,
      }),
      expect.objectContaining({
        id: 'submit_first_observation',
        progressLabel: '1/1',
        status: 'claimable',
        done: true,
      }),
      expect.objectContaining({
        id: 'explore_three_days',
        progressLabel: '2/3',
        status: 'in_progress',
        done: false,
      }),
    ])
  })

  it('marks claimed tasks and counts completed milestones', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '你好，我喜欢做实验',
        stats: {
          projectsPublished: 2,
          projectsCompleted: 1,
          observationsSubmitted: 1,
          consecutiveDays: 3,
        },
      }),
      new Set(['publish_first_project', 'submit_first_observation']),
    )

    expect(tasks.find((task) => task.id === 'publish_first_project')).toMatchObject({
      claimed: true,
      claimable: false,
      status: 'claimed',
    })
    expect(tasks.find((task) => task.id === 'complete_first_project')).toMatchObject({
      claimed: false,
      claimable: true,
      status: 'claimable',
    })
    expect(getCompletedGrowthTaskCount(tasks)).toBe(5)
  })

  it('treats whitespace-only bio as incomplete', () => {
    const tasks = resolveGrowthTasks(
      toGrowthTaskInput({
        bio: '   ',
        stats: null,
      }),
    )

    expect(tasks[0]).toMatchObject({
      id: 'write_bio',
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
        projectsPublished: 1,
        projectsCompleted: 1,
        observationsSubmitted: 1,
        consecutiveDays: 3,
      },
    })
    const partialClaimed = resolveGrowthTasks(input, new Set(['write_bio']))
    expect(isAllGrowthTasksClaimed(partialClaimed)).toBe(false)

    const allClaimed = resolveGrowthTasks(
      input,
      new Set([
        'write_bio',
        'publish_first_project',
        'complete_first_project',
        'submit_first_observation',
        'explore_three_days',
      ]),
    )
    expect(isAllGrowthTasksClaimed(allClaimed)).toBe(true)
  })
})
