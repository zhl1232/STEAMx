/** @vitest-environment node */

import { describe, expect, it } from 'vitest'
import {
  RECORD_TYPE_OPTIONS,
  STAGE_TAG_OPTIONS,
  matchesRecordTypeFilter,
  resolveRecordTypeId,
  resolveRecordTypeLabel,
  resolveStageLabel,
} from '@/lib/project/exploration-record-meta'

describe('exploration-record-meta', () => {
  it('resolveRecordTypeLabel prefers db field', () => {
    expect(resolveRecordTypeLabel({ recordType: 'insight', notes: '[观察记录] hello' })).toBe('成果展示')
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

  it('offers only 3 record types, observation first', () => {
    expect(RECORD_TYPE_OPTIONS.map((o) => o.label)).toEqual(['观察记录', '问题求助', '成果展示'])
    expect(STAGE_TAG_OPTIONS.map((o) => o.label)).toEqual(['植物生长'])
  })

  it('maps legacy type ids to merged types', () => {
    expect(resolveRecordTypeLabel({ recordType: 'discovery' })).toBe('观察记录')
    expect(resolveRecordTypeLabel({ recordType: 'decorate' })).toBe('成果展示')
    expect(resolveRecordTypeLabel({ recordType: 'insight' })).toBe('成果展示')
    expect(resolveRecordTypeLabel({ recordType: 'help' })).toBe('问题求助')
  })

  it('maps legacy notes prefix labels', () => {
    expect(resolveRecordTypeLabel({ notes: '[新发现] 发芽了' })).toBe('观察记录')
    expect(resolveRecordTypeLabel({ notes: '[心得分享] 好玩' })).toBe('成果展示')
    expect(resolveRecordTypeLabel({ notes: '[自定义] x' })).toBe('自定义')
  })

  it('filters merged types under the new type', () => {
    expect(matchesRecordTypeFilter({ recordType: 'discovery' }, 'observation')).toBe(true)
    expect(matchesRecordTypeFilter({ recordType: 'decorate' }, 'result')).toBe(true)
    expect(matchesRecordTypeFilter({ notes: '[心得分享] hi' }, 'result')).toBe(true)
    expect(matchesRecordTypeFilter({ notes: '[新发现] hi' }, 'help')).toBe(false)
    expect(matchesRecordTypeFilter({ stageLabel: '问题求助' }, 'help')).toBe(true)
  })

  it('hides stage labels that duplicate record types, keeps real stages', () => {
    expect(resolveStageLabel({ stageLabel: '布置美化' })).toBeUndefined()
    expect(resolveStageLabel({ notes: '浇水\n阶段：日常观察' })).toBeUndefined()
    expect(resolveStageLabel({ stageLabel: '植物生长' })).toBe('植物生长')
    expect(resolveRecordTypeId({ stageLabel: '日常观察' })).toBe('observation')
  })
})
