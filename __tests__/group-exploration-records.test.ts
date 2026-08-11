/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import {
  filterExplorationRecordGroups,
  groupCompletionsByExploration,
} from '@/lib/project/group-exploration-records'
import type { ProjectCompletion } from '@/lib/mappers/types'

function mockCompletion(
  partial: Partial<ProjectCompletion> & Pick<ProjectCompletion, 'id' | 'userId'>,
): ProjectCompletion {
  return {
    projectId: 1,
    author: 'Tester',
    proofImages: [],
    isPublic: true,
    likes: 0,
    coins: 0,
    completedAt: '2026-01-01',
    ...partial,
  }
}

describe('groupCompletionsByExploration', () => {
  it('groups posts by exploration and sorts the timeline ascending', () => {
    const groups = groupCompletionsByExploration([
      mockCompletion({ id: 1, userId: 'u1', explorationId: 10, completedAtIso: '2026-01-03T00:00:00Z' }),
      mockCompletion({ id: 2, userId: 'u1', explorationId: 10, completedAtIso: '2026-01-01T00:00:00Z' }),
      mockCompletion({ id: 3, userId: 'u1', explorationId: 11, completedAtIso: '2026-01-02T00:00:00Z' }),
    ])

    expect(groups).toHaveLength(2)
    const firstExploration = groups.find((group) => group.explorationId === 10)
    expect(firstExploration?.posts.map((post) => post.id)).toEqual([2, 1])
  })

  it('uses the final record as representative even when it is not the latest input row', () => {
    const groups = groupCompletionsByExploration([
      mockCompletion({
        id: 4,
        userId: 'u1',
        explorationId: 12,
        recordKind: 'final',
        completedAtIso: '2026-01-02T00:00:00Z',
      }),
      mockCompletion({
        id: 5,
        userId: 'u1',
        explorationId: 12,
        recordKind: 'progress',
        completedAtIso: '2026-01-03T00:00:00Z',
      }),
    ])

    expect(groups[0].representative.id).toBe(4)
    expect(groups[0].finalPost?.id).toBe(4)
  })

  it('keeps final metadata when a type filter hides the untyped final row', () => {
    const groups = groupCompletionsByExploration([
      mockCompletion({
        id: 6,
        userId: 'u1',
        explorationId: 13,
        recordKind: 'final',
        completedAtIso: '2026-01-03T00:00:00Z',
      }),
      mockCompletion({
        id: 7,
        userId: 'u1',
        explorationId: 13,
        recordKind: 'progress',
        recordType: 'observation',
        completedAtIso: '2026-01-02T00:00:00Z',
      }),
    ])

    const filtered = filterExplorationRecordGroups(groups, 'observation')

    expect(filtered).toHaveLength(1)
    expect(filtered[0].posts.map((post) => post.id)).toEqual([7])
    expect(filtered[0].finalPost?.id).toBe(6)
    expect(filtered[0].representative.id).toBe(6)
  })
})
