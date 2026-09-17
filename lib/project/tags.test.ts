import { describe, expect, it } from 'vitest'

import { isInternalProjectTag, visibleProjectTags } from './tags'

describe('isInternalProjectTag', () => {
  it('hides *-src:* tracking tags regardless of source prefix', () => {
    expect(isInternalProjectTag('qimeng-src:1071409')).toBe(true)
    expect(isInternalProjectTag('QIMENG-SRC:1')).toBe(true)
    expect(isInternalProjectTag('wanzhuan-src:123')).toBe(true)
    expect(isInternalProjectTag('WANZHUAN-SRC:123')).toBe(true)
    expect(isInternalProjectTag('jichuhaohua-src:456')).toBe(true)
    expect(isInternalProjectTag('gaopei-src:789')).toBe(true)
    expect(isInternalProjectTag('启蒙版')).toBe(false)
    expect(isInternalProjectTag('科学实验')).toBe(false)
    expect(isInternalProjectTag('玩转一')).toBe(false)
    expect(isInternalProjectTag('进阶款')).toBe(false)
    expect(isInternalProjectTag('基础款')).toBe(false)
    expect(isInternalProjectTag('豪华款')).toBe(false)
  })
})

describe('visibleProjectTags', () => {
  it('drops qimeng-src tags and keeps 启蒙版 plus topical tags', () => {
    expect(
      visibleProjectTags(['启蒙版', '预览', 'qimeng-src:1071409', '科学实验', '幼儿科学']),
    ).toEqual(['启蒙版', '预览', '科学实验', '幼儿科学'])
  })

  it('drops wanzhuan-src tags and keeps 玩转一 plus 进阶款', () => {
    expect(
      visibleProjectTags(['玩转一', '进阶款', 'wanzhuan-src:123', '科学实验']),
    ).toEqual(['玩转一', '进阶款', '科学实验'])
  })

  it('drops jichuhaohua-src and gaopei-src tags and keeps 基础款 plus 豪华款', () => {
    expect(
      visibleProjectTags([
        '基础款',
        '豪华款',
        'jichuhaohua-src:456',
        'gaopei-src:789',
        '科学实验',
      ]),
    ).toEqual(['基础款', '豪华款', '科学实验'])
  })

  it('trims, dedupes, and ignores blanks', () => {
    expect(visibleProjectTags([' 启蒙版 ', '启蒙版', '', null, '  '])).toEqual(['启蒙版'])
  })
})
