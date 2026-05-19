/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import {
  explorationRecordDomId,
  getExplorationRecordHref,
  parseHighlightCompletionId,
} from '@/lib/project/exploration-record-links'

describe('exploration-record-links', () => {
  it('builds record href with highlight query', () => {
    expect(getExplorationRecordHref(12, 34)).toBe('/project/12/records?highlight=34')
  })

  it('parses valid highlight id', () => {
    expect(parseHighlightCompletionId('42')).toBe(42)
  })

  it('rejects invalid highlight id', () => {
    expect(parseHighlightCompletionId('')).toBeNull()
    expect(parseHighlightCompletionId('abc')).toBeNull()
    expect(parseHighlightCompletionId('0')).toBeNull()
  })

  it('builds stable dom id', () => {
    expect(explorationRecordDomId(7)).toBe('exploration-record-7')
  })
})
