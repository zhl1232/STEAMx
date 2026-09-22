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

  it('does not invent a count for a material without an explicit quantity', () => {
    expect(getMaterialMeta('量杯')).toEqual({
      name: '量杯',
      amount: '',
    })
  })

  it('keeps notes without inventing an amount', () => {
    expect(getMaterialMeta('纸（自备）')).toEqual({
      name: '纸',
      amount: '',
      note: '自备',
    })
  })

  it('preserves explicit ranges and simple Chinese counts', () => {
    expect(getMaterialMeta('彩纸 3-4张')).toEqual({ name: '彩纸', amount: '3-4张' })
    expect(getMaterialMeta('一个气球')).toEqual({ name: '气球', amount: '一个' })
  })

  it('does not treat a voltage as a material quantity', () => {
    expect(getMaterialMeta('1.5V电池')).toEqual({ name: '1.5V电池', amount: '' })
  })

  it('preserves both capacity and count when a row has multiple quantities', () => {
    expect(getMaterialMeta('塑料瓶 500ml 2个')).toEqual({ name: '塑料瓶 500ml 2个', amount: '' })
    expect(getMaterialMeta('红纸2张、蓝纸3张')).toEqual({ name: '红纸2张、蓝纸3张', amount: '' })
  })
})
