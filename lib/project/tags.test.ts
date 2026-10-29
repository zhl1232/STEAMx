import { describe, expect, it } from 'vitest'

import { isInternalProjectTag, visibleProjectTags, isGradeProjectTag, isSeriesSourceProjectTag, displayProjectTags, filterOptionProjectTags, sanitizeProjectTagsParam } from './tags'

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

const grades = ['幼儿园小班', '幼儿园中班', '幼儿园大班', '小班', '中班', '大班',
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级',
  '初中', '高中', '高一', '高二', '高三', '初一', '初二', '初三', '1年级', '9年级']

describe('public tag policies', () => {
  it.each(grades)('recognizes grade %s after trimming', (grade) => {
    expect(isGradeProjectTag(` ${grade} `)).toBe(true)
    expect(displayProjectTags([grade])).toEqual([])
    expect(sanitizeProjectTagsParam(grade)).toEqual([])
  })

  it.each([null, undefined, '', '幼儿科学', '初中物理实验', '科教版', '平衡'])('does not classify topic %s as a grade', (tag) => {
    expect(isGradeProjectTag(tag)).toBe(false)
  })

  it('hides only the specified series source label', () => {
    expect(isSeriesSourceProjectTag(' 科教版 ')).toBe(true)
    expect(isSeriesSourceProjectTag('启蒙版')).toBe(false)
    expect(isSeriesSourceProjectTag(null)).toBe(false)
  })

  it('separates display, options and internal-only visibility without mutating data', () => {
    const tags = Object.freeze(['科教版', ...grades, 'kejiao16a-src:1', ' 平衡 ', '平衡', '启蒙版'])
    const input = [...tags]
    expect(visibleProjectTags(input)).toEqual([...grades, '平衡', '启蒙版'])
    expect(displayProjectTags(input)).toEqual(['平衡', '启蒙版'])
    expect(filterOptionProjectTags(input)).toEqual(['平衡', '启蒙版'])
    expect(input).toEqual(tags)
    expect(displayProjectTags(null)).toEqual([])
    expect(filterOptionProjectTags(undefined)).toEqual([])
  })

  it.each([
    [null, []], [undefined, []], ['', []], ['初中', []],
    ['科教版,初中', []],
    [' 科教版 ,二年级,kejiao16a-src:1, 平衡 ,平衡,,', ['平衡']],
  ])('sanitizes legacy tags parameter %s', (value, expected) => {
    expect(sanitizeProjectTagsParam(value)).toEqual(expected)
  })
})
