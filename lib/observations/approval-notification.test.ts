import { describe, expect, it } from 'vitest'
import { buildObservationApprovedNotice, getNextFindNoun } from './approval-notification'

describe('observation approval notice', () => {
  it('adapts the next suggestion to the topic', () => {
    expect(getNextFindNoun('birds')).toBe('鸟')
    expect(getNextFindNoun('insects')).toBe('昆虫')
    expect(getNextFindNoun(undefined)).toBe('自然生物')
  })
  it('mentions xp and the lit species', () => {
    expect(buildObservationApprovedNotice({ speciesName: '麻雀', topic: 'birds', xpAwarded: 10 }).content)
      .toBe('你的观察审核通过了，+10 经验，图鉴已点亮「麻雀」。再找一种鸟试试？')
  })
})
