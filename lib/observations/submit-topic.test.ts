import { describe, expect, it } from 'vitest'

import {
  getObservationSubmitTopicCopy,
  normalizeObservationSubmitTopic,
  observationSubmitTopicFromNatureTopic,
} from './submit-topic'

describe('observation submit topic', () => {
  it('normalizes supported submit topics and defaults to birds', () => {
    expect(normalizeObservationSubmitTopic('insects')).toBe('insects')
    expect(normalizeObservationSubmitTopic('plants')).toBe('plants')
    expect(normalizeObservationSubmitTopic('birds')).toBe('birds')
    expect(normalizeObservationSubmitTopic('fungi')).toBe('birds')
    expect(normalizeObservationSubmitTopic(undefined)).toBe('birds')
  })

  it('maps nature topics to submit topics', () => {
    expect(observationSubmitTopicFromNatureTopic('insects')).toBe('insects')
    expect(observationSubmitTopicFromNatureTopic('plants')).toBe('plants')
    expect(observationSubmitTopicFromNatureTopic('birds')).toBe('birds')
    expect(observationSubmitTopicFromNatureTopic('fungi')).toBe('birds')
    expect(observationSubmitTopicFromNatureTopic(null)).toBe('birds')
  })

  it('provides topic-specific copy', () => {
    expect(getObservationSubmitTopicCopy('insects').label).toBe('昆虫')
    expect(getObservationSubmitTopicCopy('insects').subjectUnit).toBe('一只昆虫')
  })
})
