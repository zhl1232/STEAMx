import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  sampleAutoInteractionDelayMs,
  sampleCollectionCount,
  sampleLikeCount,
  sampleReplyCount,
} from './auto-interactions'

describe('auto interaction sampling', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('weights the default 5-10 minute delay bucket highest', () => {
    const values = [0.20, 0.50]
    const delayMs = sampleAutoInteractionDelayMs(() => values.shift() ?? 0)

    expect(delayMs).toBe(7.5 * 60_000)
  })

  it('clamps sampled delays to configured min and max minutes', () => {
    vi.stubEnv('AUTO_INTERACTION_MIN_DELAY_MINUTES', '6')
    vi.stubEnv('AUTO_INTERACTION_MAX_DELAY_MINUTES', '8')

    const lowBucketDelay = sampleAutoInteractionDelayMs(() => 0)
    const highBucketDelay = sampleAutoInteractionDelayMs(() => 0.99)

    expect(lowBucketDelay).toBe(6 * 60_000)
    expect(highBucketDelay).toBe(8 * 60_000)
  })

  it('uses AUTO_REPLY_RATE before selecting reply count', () => {
    vi.stubEnv('AUTO_REPLY_RATE', '0.8')

    expect(sampleReplyCount(() => 0.81)).toBe(0)
    expect(sampleReplyCount(() => 0.1)).toBe(1)
  })

  it('caps sampled like and collection counts to the planned maxima', () => {
    expect(sampleLikeCount(() => 0.99)).toBeLessThanOrEqual(5)
    expect(sampleCollectionCount(() => 0.995)).toBe(3)
  })
})
