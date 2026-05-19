/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { groupCompletionsByExplorer } from '@/lib/project/group-exploration-records'
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
    completedAt: '2026-01-01',
    ...partial,
  }
}

describe('groupCompletionsByExplorer', () => {
  it('groups posts by user and sorts timeline ascending inside group', () => {
    const groups = groupCompletionsByExplorer([
      mockCompletion({ id: 1, userId: 'u1', completedAtIso: '2026-01-03T00:00:00Z' }),
      mockCompletion({ id: 2, userId: 'u1', completedAtIso: '2026-01-01T00:00:00Z' }),
      mockCompletion({ id: 3, userId: 'u2', completedAtIso: '2026-01-02T00:00:00Z' }),
    ])

    expect(groups).toHaveLength(2)
    const u1 = groups.find((g) => g.userId === 'u1')
    expect(u1?.posts.map((p) => p.id)).toEqual([2, 1])
  })
})
