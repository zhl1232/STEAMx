import { describe, expect, it } from 'vitest'

import {
  SCRATCH_MESSAGE_SOURCE,
  SCRATCH_PARENT_SOURCE,
  isScratchHostMessage,
} from '@/lib/courses/scratch-messages'

describe('isScratchHostMessage', () => {
  it('accepts every known host message type carrying the host source tag', () => {
    const types = [
      'SCRATCH_READY',
      'PROJECT_LOADED',
      'PROJECT_SAVED',
      'PROJECT_SAVE_DATA',
      'EDITOR_CONTEXT',
    ]

    for (const type of types) {
      expect(isScratchHostMessage({ type, source: SCRATCH_MESSAGE_SOURCE })).toBe(true)
    }
  })

  it('rejects a message whose source is not the host source', () => {
    expect(
      isScratchHostMessage({ type: 'SCRATCH_READY', source: SCRATCH_PARENT_SOURCE }),
    ).toBe(false)
    expect(isScratchHostMessage({ type: 'SCRATCH_READY' })).toBe(false)
  })

  it('rejects a correctly-sourced message with an unknown type', () => {
    expect(
      isScratchHostMessage({ type: 'SOMETHING_ELSE', source: SCRATCH_MESSAGE_SOURCE }),
    ).toBe(false)
  })

  it('rejects a message missing its type entirely', () => {
    expect(isScratchHostMessage({ source: SCRATCH_MESSAGE_SOURCE })).toBe(false)
  })

  it('rejects non-object inputs without throwing', () => {
    expect(isScratchHostMessage(null)).toBe(false)
    expect(isScratchHostMessage(undefined)).toBe(false)
    expect(isScratchHostMessage('SCRATCH_READY')).toBe(false)
    expect(isScratchHostMessage(42)).toBe(false)
    expect(isScratchHostMessage(true)).toBe(false)
  })

  it('narrows the type so host-message fields are reachable', () => {
    const data: unknown = {
      type: 'PROJECT_SAVE_DATA',
      base64: 'abc',
      source: SCRATCH_MESSAGE_SOURCE,
    }

    if (isScratchHostMessage(data) && data.type === 'PROJECT_SAVE_DATA') {
      expect(data.base64).toBe('abc')
    } else {
      throw new Error('expected data to be narrowed to a host message')
    }
  })
})
