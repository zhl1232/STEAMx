import { describe, expect, it } from 'vitest'

import {
  isQualifyingAiObservedSpecies,
  mergeObservedSpeciesEventLinks,
  observedSpeciesIdsFromEventLinks,
} from './observed-species-progress'

describe('isQualifyingAiObservedSpecies', () => {
  it('accepts confidence at or above the default threshold', () => {
    expect(isQualifyingAiObservedSpecies(0.8)).toBe(true)
    expect(isQualifyingAiObservedSpecies(0.91)).toBe(true)
  })

  it('rejects low or missing confidence', () => {
    expect(isQualifyingAiObservedSpecies(0.79)).toBe(false)
    expect(isQualifyingAiObservedSpecies(null)).toBe(false)
    expect(isQualifyingAiObservedSpecies(undefined)).toBe(false)
  })
})

describe('mergeObservedSpeciesEventLinks', () => {
  it('includes community consensus species', () => {
    const links = mergeObservedSpeciesEventLinks(
      [{ species_id: 10, observation_event_id: 1 }],
      [],
    )

    expect(observedSpeciesIdsFromEventLinks(links)).toEqual(new Set([10]))
    expect(links.get(10)).toEqual([1])
  })

  it('includes high-confidence AI species when consensus is missing', () => {
    const links = mergeObservedSpeciesEventLinks(
      [],
      [{ species_id: 20, observation_event_id: 2, source: 'ai', confidence: 0.86 }],
    )

    expect(observedSpeciesIdsFromEventLinks(links)).toEqual(new Set([20]))
  })

  it('prefers consensus over AI for the same event', () => {
    const links = mergeObservedSpeciesEventLinks(
      [{ species_id: 10, observation_event_id: 1 }],
      [{ species_id: 20, observation_event_id: 1, source: 'ai', confidence: 0.95 }],
    )

    expect(observedSpeciesIdsFromEventLinks(links)).toEqual(new Set([10]))
  })

  it('ignores low-confidence AI identifications', () => {
    const links = mergeObservedSpeciesEventLinks(
      [],
      [{ species_id: 30, observation_event_id: 3, source: 'ai', confidence: 0.72 }],
    )

    expect(observedSpeciesIdsFromEventLinks(links).size).toBe(0)
  })
})
