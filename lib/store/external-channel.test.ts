import { describe, expect, it } from 'vitest'

import {
  isStoreContextKey,
  normalizeStoreContextKeys,
  normalizeTaobaoUrl,
} from '@/lib/store/external-channel'

describe('store external channel helpers', () => {
  it('only accepts HTTPS Taobao/Tmall links', () => {
    expect(normalizeTaobaoUrl('https://item.taobao.com/item.htm?id=123')).toBe('https://item.taobao.com/item.htm?id=123')
    expect(normalizeTaobaoUrl('https://detail.tmall.com/item.htm?id=456')).toBe('https://detail.tmall.com/item.htm?id=456')
    expect(normalizeTaobaoUrl('http://item.taobao.com/item.htm?id=123')).toBeNull()
    expect(normalizeTaobaoUrl('https://taobao.com.evil.example/item?id=123')).toBeNull()
    expect(normalizeTaobaoUrl('https://item.taobao.com.evil.example/item?id=123')).toBeNull()
  })

  it('normalizes and de-duplicates contextual placement keys', () => {
    expect(isStoreContextKey('course:12')).toBe(true)
    expect(isStoreContextKey('project:abc_1')).toBe(true)
    expect(isStoreContextKey('course:')).toBe(false)
    expect(normalizeStoreContextKeys('course:12, project:3 course:12 invalid')).toEqual(['course:12', 'project:3'])
  })
})
