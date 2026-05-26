import { describe, expect, it } from 'vitest'

import {
  calculateIdentificationConsensus,
  selectAiIdentification,
} from './identifications'

describe('selectAiIdentification', () => {
  it('selects a consistent high-confidence AI vote across images', () => {
    expect(selectAiIdentification([
      { status: 'passed', speciesCandidates: [{ speciesId: 10, confidence: 0.82 }] },
      { status: 'passed', speciesCandidates: [{ speciesId: 10, confidence: 0.91 }] },
    ])).toEqual({ speciesId: 10, confidence: 0.91 })
  })

  it('does not create an AI vote for low confidence or conflicting photos', () => {
    expect(selectAiIdentification([
      { status: 'passed', speciesCandidates: [{ speciesId: 10, confidence: 0.79 }] },
    ])).toBeNull()
    expect(selectAiIdentification([
      { status: 'passed', speciesCandidates: [{ speciesId: 10, confidence: 0.86 }] },
      { status: 'passed', speciesCandidates: [{ speciesId: 20, confidence: 0.88 }] },
    ])).toBeNull()
  })

  it('uses the highest-confidence candidate when the provider response is unsorted', () => {
    expect(selectAiIdentification([
      { status: 'passed', speciesCandidates: [{ speciesId: 9, confidence: 0.4 }, { speciesId: 3, confidence: 0.91 }] },
    ])).toEqual({ speciesId: 3, confidence: 0.91 })
  })
})

describe('calculateIdentificationConsensus', () => {
  it('does not confirm the observer and AI alone', () => {
    expect(calculateIdentificationConsensus([
      { speciesId: 10, source: 'ai', identifierUserId: null },
      { speciesId: 10, source: 'human', identifierUserId: 'owner' },
    ], 'owner')).toEqual({ status: 'needs_id', confirmedSpeciesId: null })
  })

  it('confirms AI supported by a non-owner or two human identifiers', () => {
    expect(calculateIdentificationConsensus([
      { speciesId: 10, source: 'ai', identifierUserId: null },
      { speciesId: 10, source: 'human', identifierUserId: 'community-user' },
    ], 'owner').status).toBe('community_confirmed')
    expect(calculateIdentificationConsensus([
      { speciesId: 10, source: 'human', identifierUserId: 'owner' },
      { speciesId: 10, source: 'human', identifierUserId: 'community-user' },
    ], 'owner').status).toBe('community_confirmed')
  })

  it('keeps a record unresolved when active votes conflict', () => {
    expect(calculateIdentificationConsensus([
      { speciesId: 10, source: 'ai', identifierUserId: null },
      { speciesId: 10, source: 'human', identifierUserId: 'community-user' },
      { speciesId: 20, source: 'human', identifierUserId: 'owner' },
    ], 'owner')).toEqual({ status: 'needs_id', confirmedSpeciesId: null })
  })
})
