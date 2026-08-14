import { describe, expect, it } from 'vitest'

import {
  checkMessagePrivacyGate,
  checkStrangerMessageGate,
  containsContactInfo,
  getMessageQuotaBeforeReply,
  resolveMessageRelationship,
  MUTUAL_FOLLOW_MESSAGE_LIMIT,
  STRANGER_MESSAGE_LIMIT,
} from './stranger-gate'

describe('resolveMessageRelationship', () => {
  it('treats a one-way follow as a stranger', () => {
    expect(resolveMessageRelationship({ hasReply: false, isMutualFollow: false })).toBe('stranger')
  })

  it('upgrades mutual followers', () => {
    expect(resolveMessageRelationship({ hasReply: false, isMutualFollow: true })).toBe('mutual_follow')
  })

  it('lets a reply outrank the follow relationship', () => {
    expect(resolveMessageRelationship({ hasReply: true, isMutualFollow: false })).toBe('replied')
  })
})

describe('getMessageQuotaBeforeReply', () => {
  it('grows the quota as the relationship warms up', () => {
    expect(getMessageQuotaBeforeReply('stranger')).toBe(STRANGER_MESSAGE_LIMIT)
    expect(getMessageQuotaBeforeReply('mutual_follow')).toBe(MUTUAL_FOLLOW_MESSAGE_LIMIT)
    expect(getMessageQuotaBeforeReply('replied')).toBeNull()
  })
})

describe('containsContactInfo', () => {
  it.each([
    '加我 https://example.com',
    '看 www.example.com',
    '邮箱 kid@example.com',
    '打 13800138000',
  ])('flags %s', (content) => {
    expect(containsContactInfo(content)).toBe(true)
  })

  it('leaves normal greetings alone', () => {
    expect(containsContactInfo('你好，我也喜欢搭积木！')).toBe(false)
  })
})

describe('checkMessagePrivacyGate', () => {
  it('blocks everyone when messaging is turned off', () => {
    expect(checkMessagePrivacyGate({ privacy: 'nobody', relationship: 'replied' })).toMatchObject({
      allowed: false,
      status: 403,
    })
  })

  it('requires a mutual follow for followers_only', () => {
    expect(checkMessagePrivacyGate({ privacy: 'followers_only', relationship: 'stranger' })).toMatchObject({
      allowed: false,
      status: 403,
    })
    expect(checkMessagePrivacyGate({ privacy: 'followers_only', relationship: 'mutual_follow' })).toEqual({
      allowed: true,
    })
  })

  it('does not cut off a conversation the receiver already replied to', () => {
    expect(checkMessagePrivacyGate({ privacy: 'followers_only', relationship: 'replied' })).toEqual({
      allowed: true,
    })
  })

  it('lets everyone through on the open setting', () => {
    expect(checkMessagePrivacyGate({ privacy: 'everyone', relationship: 'stranger' })).toEqual({ allowed: true })
  })
})

describe('checkStrangerMessageGate', () => {
  it('allows the first stranger message and blocks the second', () => {
    expect(checkStrangerMessageGate({ relationship: 'stranger', sentBeforeReply: 0, content: '你好' })).toEqual({
      allowed: true,
    })
    const blocked = checkStrangerMessageGate({ relationship: 'stranger', sentBeforeReply: 1, content: '在吗' })
    expect(blocked).toMatchObject({ allowed: false, status: 429 })
    expect(blocked.allowed === false && blocked.error).toContain('互相关注')
  })

  it('gives mutual followers three tries before a reply', () => {
    expect(checkStrangerMessageGate({ relationship: 'mutual_follow', sentBeforeReply: 2, content: '你好' })).toEqual({
      allowed: true,
    })
    expect(checkStrangerMessageGate({ relationship: 'mutual_follow', sentBeforeReply: 3, content: '你好' })).toMatchObject({
      allowed: false,
      status: 429,
    })
  })

  it('drops the quota once the receiver replies', () => {
    expect(checkStrangerMessageGate({ relationship: 'replied', sentBeforeReply: 99, content: '你好' })).toEqual({
      allowed: true,
    })
  })

  it('blocks contact info for the whole stranger stage, not just the first message', () => {
    expect(checkStrangerMessageGate({ relationship: 'stranger', sentBeforeReply: 0, content: '加我 qq@example.com' })).toMatchObject({
      allowed: false,
      status: 400,
    })
  })

  it('allows links once the conversation is two-way', () => {
    expect(checkStrangerMessageGate({ relationship: 'replied', sentBeforeReply: 5, content: '看这个 https://example.com' })).toEqual({
      allowed: true,
    })
  })
})
