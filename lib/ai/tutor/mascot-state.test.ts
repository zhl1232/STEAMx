import { describe, expect, it } from 'vitest'

import { resolveTutorMascotState } from '@/lib/ai/tutor/mascot-state'

const base = {
  recording: false,
  feedback: null,
  working: false,
  speaking: false,
  thinking: false,
} as const

describe('resolveTutorMascotState', () => {
  it('returns idle when no signals are active', () => {
    expect(resolveTutorMascotState(base)).toBe('idle')
  })

  it('lets recording override every other signal', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        recording: true,
        feedback: 'error',
        working: true,
        speaking: true,
        thinking: true,
      }),
    ).toBe('listening')
  })

  it('lets error feedback override working and speaking', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        feedback: 'error',
        working: true,
        speaking: true,
        thinking: true,
      }),
    ).toBe('error')
  })

  it('lets speaking override success feedback so auto-read is visible', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        feedback: 'success',
        speaking: true,
        thinking: true,
      }),
    ).toBe('speaking')
  })

  it('shows success when not speaking or working', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        feedback: 'success',
        thinking: true,
      }),
    ).toBe('success')
  })

  it('lets working override thinking and speaking', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        working: true,
        speaking: true,
        thinking: true,
      }),
    ).toBe('working')
  })

  it('keeps speaking over thinking when there is no feedback', () => {
    expect(
      resolveTutorMascotState({
        ...base,
        speaking: true,
        thinking: true,
      }),
    ).toBe('speaking')
  })

  it('returns thinking when only thinking is active', () => {
    expect(resolveTutorMascotState({ ...base, thinking: true })).toBe('thinking')
  })
})
