import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { parseFeishuContent, validImageKey } from './message-content'
const mentions = [{ key: '@_user_1', id: { open_id: 'ou_bot' }, name: '客服' }, { key: '@_user_2', id: { open_id: 'ou_staff' }, name: '小王' }]
const parse = (type: string, body: unknown, list: unknown = mentions) => parseFeishuContent(type, JSON.stringify(body), list, 'ou_bot')
describe('Feishu receive content', () => {
  it('removes actual bot placeholders while preserving binding commands and other mentions', () => {
    expect(parse('text', { text: '@_user_1 绑定客服 @_user_2' })).toEqual({ text: '绑定客服 @小王', imageKeys: [], mentionedBot: true })
    expect(parse('text', { text: '普通聊天' })).toEqual({ text: '普通聊天', imageKeys: [], mentionedBot: false })
  })
  it('parses official unlocalized rich posts with title, links, mentions and images', () => {
    expect(parse('post', { title: '回复', content: [[{ tag: 'at', user_id: 'ou_bot' }, { tag: 'text', text: ' 请看' }, { tag: 'a', text: '说明', href: 'https://example.com' }], [{ tag: 'img', image_key: 'img_v3_a-b' }], [{ tag: 'at', user_id: '@_user_2' }]] })).toEqual({ text: '回复\n 请看说明\n\n@小王', imageKeys: ['img_v3_a-b'], mentionedBot: true })
  })
  it('preserves legacy SDK mention keys and ordinary unknown mentions', () => {
    expect(parse('text', { text: '@_bot 绑定客服 @someone' }, [{ key: '@_bot', id: { open_id: 'ou_bot' } }])).toEqual({ text: '绑定客服 @someone', imageKeys: [], mentionedBot: true })
    expect(parse('text', { text: '@_user_9 hello' })).toEqual({ text: '@_user_9 hello', imageKeys: [], mentionedBot: false })
  })
  it('rejects post bot IDs without authenticating mention metadata', () => {
    expect(() => parse('post', { content: [[{ tag: 'at', user_id: 'ou_bot' }, { tag: 'text', text: 'reply' }]] }, [])).toThrow(/^event_invalid$/)
    expect(() => parse('post', { content: [[{ tag: 'at', user_id: '@_unknown' }, { tag: 'text', text: 'reply' }]] })).toThrow(/^event_invalid$/)
  })
  it('rejects duplicate images instead of silently dropping attachments', () => {
    expect(() => parse('post', { content: [[{ tag: 'img', image_key: 'img_a' }, { tag: 'img', image_key: 'img_a' }]] })).toThrow(/^event_invalid$/)
  })
  it('accepts localized posts and standalone images without inventing a bot mention', () => {
    expect(parse('post', { zh_cn: { content: [[{ tag: 'at', user_id: '@_user_1' }, { tag: 'img', image_key: 'img_a' }]] } })).toEqual({ text: '', imageKeys: ['img_a'], mentionedBot: true })
    expect(parse('image', { image_key: 'img_a' }, undefined)).toEqual({ text: '', imageKeys: ['img_a'], mentionedBot: false })
  })
  it('enforces text and unique image limits without truncating', () => {
    expect(parse('text', { text: '好'.repeat(2000) }).text).toHaveLength(2000)
    expect(() => parse('text', { text: '好'.repeat(2001) })).toThrow('event_invalid')
    expect(parse('post', { content: [[...['a', 'b', 'c'].map(key => ({ tag: 'img', image_key: `img_${key}` }))]] }).imageKeys).toHaveLength(3)
    expect(() => parse('post', { content: [[...['a', 'b', 'c', 'd'].map(key => ({ tag: 'img', image_key: `img_${key}` }))]] })).toThrow('event_invalid')
  })
  it.each([
    ['file', { file_key: 'private' }], ['image', { image_key: 'img_x/path' }], ['post', { content: [[{ tag: 'media', file_key: 'private' }]] }],
    ['post', { content: [[{ tag: 'text', text: 'valid' }, { tag: 'img' }]] }], ['post', { content: ['bad-row'] }], ['text', { text: 3 }],
  ])('rejects unsupported or malformed %s content', (type, body) => {
    expect(() => parse(type, body)).toThrow(/^event_invalid$/)
  })
  it('rejects malformed JSON and duplicate placeholder identities', () => {
    expect(() => parseFeishuContent('text', '{secret', [], 'ou_bot')).toThrow(/^event_invalid$/)
    expect(() => parse('text', { text: '@_user_1 reply' }, [...mentions, mentions[0]])).toThrow(/^event_invalid$/)
  })
  it('validates resource keys without allowing paths or query strings', () => {
    expect(validImageKey('img_v3_abc-123')).toBe(true)
    for (const value of ['img_', 'img_x?y', 'img_x/y', `img_${'a'.repeat(241)}`]) expect(validImageKey(value)).toBe(false)
  })
})
