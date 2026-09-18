import { describe, expect, it } from 'vitest'

import { getMaterialMeta } from './material-meta'

describe('getMaterialMeta', () => {
  it('keeps the 自备 checklist instead of treating 1个 as the line amount', () => {
    expect(getMaterialMeta('自备（小碗1个、盘子1个）')).toEqual({
      name: '自备：小碗1个、盘子1个',
      amount: '',
      note: '小碗1个、盘子1个',
    })
  })

  it('expands 自备 notes that are a list without counts', () => {
    expect(getMaterialMeta('自备（碗、水盆、开水、清水）')).toEqual({
      name: '自备：碗、水盆、开水、清水',
      amount: '',
      note: '碗、水盆、开水、清水',
    })
  })

  it('keeps a plain 量杯 as a named item with a default count', () => {
    expect(getMaterialMeta('量杯')).toEqual({
      name: '量杯',
      amount: '1 个',
    })
  })

  it('keeps 纸（自备） as the item name with a 自备 note', () => {
    expect(getMaterialMeta('纸（自备）')).toEqual({
      name: '纸',
      amount: '适量',
      note: '自备',
    })
  })
})
