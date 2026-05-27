import { describe, expect, it } from 'vitest'

import { computeConsensusUiState } from './consensus-ui'
import type { ObservationIdentification } from '@/lib/mappers/types'

const aiVote: ObservationIdentification = {
  id: 1,
  speciesId: 10,
  commonName: '红尾伯劳',
  source: 'ai',
  confidence: 0.9,
  createdAt: '2026-05-14T00:00:00.000Z',
}

const ownerVote: ObservationIdentification = {
  id: 2,
  speciesId: 10,
  commonName: '红尾伯劳',
  source: 'human',
  identifierUserId: 'owner',
  createdAt: '2026-05-14T01:00:00.000Z',
}

describe('computeConsensusUiState', () => {
  it('shows partial progress for owner plus AI only', () => {
    const state = computeConsensusUiState([aiVote, ownerVote], 'owner', null, 'needs_id')
    expect(state.progress).toBe(0.5)
    expect(state.progressLabel).toBe('1/2')
    expect(state.leadingCommonName).toBe('红尾伯劳')
  })

  it('shows full progress when confirmed', () => {
    const state = computeConsensusUiState(
      [aiVote, ownerVote],
      'owner',
      { speciesId: 10, commonName: '红尾伯劳', behaviorTags: [] },
      'community_confirmed',
    )
    expect(state.progress).toBe(1)
    expect(state.summary).toContain('已达成')
  })
})
