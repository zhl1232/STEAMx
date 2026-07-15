import { describe, expect, it } from 'vitest'

import { checkContent, filterContent, isClean } from '@/lib/content-filter'

describe('checkContent', () => {
  it('passes clean text untouched', () => {
    expect(checkContent('今天我用 Scratch 做了一个接水果的小游戏')).toEqual({
      passed: true,
      matched: [],
      filtered: '今天我用 Scratch 做了一个接水果的小游戏',
    })
  })

  it('treats empty input as clean', () => {
    expect(checkContent('')).toEqual({ passed: true, matched: [], filtered: '' })
  })

  it('flags a Chinese sensitive word and masks it', () => {
    const result = checkContent('这是赌博广告')
    expect(result.passed).toBe(false)
    expect(result.matched).toContain('赌博')
    expect(result.filtered).toBe('这是**广告')
  })

  it('de-dupes repeated matches but masks every occurrence', () => {
    const result = checkContent('赌博又赌博')
    expect(result.passed).toBe(false)
    expect(result.matched).toEqual(['赌博'])
    expect(result.filtered).toBe('**又**')
  })

  it('matches English words case-insensitively', () => {
    const result = checkContent('what the DAMN thing')
    expect(result.passed).toBe(false)
    expect(result.matched).toContain('damn')
    expect(result.filtered).toBe('what the **** thing')
  })

  it('normalises full-width characters before matching', () => {
    // "ｄａｍｎ" is the full-width form of "damn"
    const result = checkContent('say ｄａｍｎ now')
    expect(result.passed).toBe(false)
    expect(result.matched).toContain('damn')
    expect(result.filtered).toBe('say **** now')
  })

  it('collects multiple distinct matches across languages', () => {
    const result = checkContent('赌博 and damn together')
    expect(result.passed).toBe(false)
    expect(result.matched).toEqual(expect.arrayContaining(['赌博', 'damn']))
    expect(result.matched).toHaveLength(2)
  })

  it('masks the union of overlapping ranges', () => {
    // 老虎机 and 老虎 both exist? only 老虎机 is a word — ensure the full word is masked
    const result = checkContent('玩老虎机很危险')
    expect(result.passed).toBe(false)
    expect(result.matched).toContain('老虎机')
    expect(result.filtered).toBe('玩***很危险')
  })
})

describe('filterContent', () => {
  it('returns only the masked string', () => {
    expect(filterContent('这是赌博广告')).toBe('这是**广告')
  })

  it('returns clean text unchanged', () => {
    expect(filterContent('画一只小猫')).toBe('画一只小猫')
  })
})

describe('isClean', () => {
  it('is true for clean text', () => {
    expect(isClean('我的作品叫太空冒险')).toBe(true)
  })

  it('is false when a sensitive word is present', () => {
    expect(isClean('刷单兼职招募')).toBe(false)
  })
})
