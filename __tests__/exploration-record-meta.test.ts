/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import {
  matchesRecordTypeFilter,
  resolveRecordTypeLabel,
  resolveStageLabel,
} from '@/lib/project/exploration-record-meta'

describe('exploration-record-meta', () => {
  it('resolveRecordTypeLabel prefers db field', () => {
    expect(resolveRecordTypeLabel({ recordType: 'insight', notes: '[观察记录] hello' })).toBe('心得分享')
  })

  it('resolveRecordTypeLabel parses notes prefix when db empty', () => {
    expect(resolveRecordTypeLabel({ recordType: null, notes: '[观察记录] hello' })).toBe('观察记录')
  })

  it('resolveStageLabel returns undefined when no data', () => {
    expect(resolveStageLabel({ stageLabel: null, notes: 'plain text' })).toBeUndefined()
  })

  it('matchesRecordTypeFilter matches db record_type', () => {
    expect(matchesRecordTypeFilter({ recordType: 'help', notes: '' }, 'help')).toBe(true)
    expect(matchesRecordTypeFilter({ recordType: 'help', notes: '' }, 'insight')).toBe(false)
  })

  it('does not match without record_type or notes prefix', () => {
    expect(matchesRecordTypeFilter({ recordType: null, notes: 'no prefix' }, 'insight')).toBe(false)
  })
})
