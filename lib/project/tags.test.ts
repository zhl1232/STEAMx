import { describe, expect, it } from 'vitest'

import { isInternalProjectTag, visibleProjectTags } from './tags'

describe('isInternalProjectTag', () => {
  it('hides qimeng-src:* tracking tags', () => {
    expect(isInternalProjectTag('qimeng-src:1071409')).toBe(true)
    expect(isInternalProjectTag('QIMENG-SRC:1')).toBe(true)
    expect(isInternalProjectTag('启蒙版')).toBe(false)
    expect(isInternalProjectTag('科学实验')).toBe(false)
  })
})

describe('visibleProjectTags', () => {
  it('drops qimeng-src tags and keeps 启蒙版 plus topical tags', () => {
    expect(
      visibleProjectTags(['启蒙版', '预览', 'qimeng-src:1071409', '科学实验', '幼儿科学']),
    ).toEqual(['启蒙版', '预览', '科学实验', '幼儿科学'])
  })

  it('trims, dedupes, and ignores blanks', () => {
    expect(visibleProjectTags([' 启蒙版 ', '启蒙版', '', null, '  '])).toEqual(['启蒙版'])
  })
})
