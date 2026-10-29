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
      name: '纸张',
      amount: '',
      note: '自备',
    })
  })

  it('preserves explicit ranges and simple Chinese counts', () => {
    expect(getMaterialMeta('彩纸 3-4张')).toEqual({ name: '彩纸', amount: '3-4张' })
    expect(getMaterialMeta('一个气球')).toEqual({ name: '气球', amount: '一个' })
  })

  it('keeps dimensions as specifications and supports household quantities', () => {
    expect(getMaterialMeta('铝箔纸15×15厘米')).toEqual({ name: '铝箔纸', amount: '', note: '15×15厘米' })
    expect(getMaterialMeta('铝箔纸15×15厘米2张')).toEqual({ name: '铝箔纸', amount: '2张', note: '15×15厘米' })
    expect(getMaterialMeta('食盐20g')).toEqual({ name: '食盐', amount: '20g' })
    expect(getMaterialMeta('白纸两张')).toEqual({ name: '纸张', amount: '两张', note: '白纸' })
    expect(getMaterialMeta('画笔（大、中、小）')).toEqual({ name: '画笔', amount: '', note: '大、中、小' })
  })

  it('separates approximate, Chinese and indefinite quantities without confusing material names', () => {
    expect(getMaterialMeta('一盆清水')).toMatchObject({ name: '水', amount: '一盆' })
    expect(getMaterialMeta('白纸3～4张左右')).toMatchObject({ amount: '3～4张左右' })
    expect(getMaterialMeta('细绳1米以上')).toMatchObject({ amount: '1米以上' })
    expect(getMaterialMeta('少许食盐')).toMatchObject({ name: '食盐', amount: '少许' })
    expect(getMaterialMeta('硬币若干枚')).toMatchObject({ name: '硬币', amount: '若干枚' })
    expect(getMaterialMeta('颜料数色')).toMatchObject({ amount: '数色' })
    expect(getMaterialMeta('多肉植物').name).not.toBe('肉植物')
    expect(getMaterialMeta('铝箔纸15厘米×15厘米').amount).toBe('')
  })

  it('separates reviewed material states without guessing unknown adjectives', () => {
    expect(getMaterialMeta('旧的5角硬币')).toEqual({ name: '硬币', amount: '', note: '旧的5角' })
    expect(getMaterialMeta('旧的5角硬币2枚')).toEqual({ name: '硬币', amount: '2枚', note: '旧的5角' })
    expect(getMaterialMeta('常温自来水200ml')).toEqual({ name: '水', amount: '200ml', note: '常温自来水' })
    expect(getMaterialMeta('常温清水（取自同一水源）')).toEqual({ name: '水', amount: '', note: '常温清水；取自同一水源' })
    expect(getMaterialMeta('旧的未识别材料').name).toBe('旧的未识别材料')
    expect(getMaterialMeta('常温呈液态的食用油').name).toBe('常温呈液态的食用油')
  })

  it('does not treat a voltage as a material quantity', () => {
    expect(getMaterialMeta('1.5V电池')).toEqual({ name: '1.5V电池', amount: '' })
  })

  it('keeps approximation with the amount and separates quantity-only parentheses', () => {
    expect(getMaterialMeta('清水约150毫升')).toEqual({ name: '水', amount: '约150毫升', note: '清水' })
    expect(getMaterialMeta('面粉（2杯）')).toEqual({ name: '面粉', amount: '2杯' })
    expect(getMaterialMeta('直尺（30厘米）')).toEqual({ name: '直尺', amount: '', note: '30厘米' })
    expect(getMaterialMeta('水2杯（每杯200毫升）')).toEqual({ name: '水', amount: '2杯', note: '每杯200毫升' })
  })

  it('separates the final count while preserving capacity and compound quantities', () => {
    expect(getMaterialMeta('塑料瓶 500ml 2个')).toEqual({ name: '瓶子', amount: '2个', note: '塑料瓶；500ml' })
    expect(getMaterialMeta('红纸2张、蓝纸3张')).toEqual({ name: '红纸2张、蓝纸3张', amount: '' })
  })
})
