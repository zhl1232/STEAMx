import { describe, expect, it } from 'vitest'

import { sanitizeTutorReply } from '@/lib/ai/tutor/reasoning-output'

describe('sanitizeTutorReply', () => {
  it('removes a complete reasoning block', () => {
    expect(sanitizeTutorReply('<think>先分析一下</think>答案在这里')).toBe('答案在这里')
  })

  it('removes a leading trace when only the closing tag is present', () => {
    expect(sanitizeTutorReply('先分析一下\n</think>答案在这里')).toBe('答案在这里')
  })

  it('removes an unclosed reasoning block', () => {
    expect(sanitizeTutorReply('答案前的思考<think>不要泄漏')).toBe('答案前的思考')
  })

  it.each([
    ['<reasoning>内部分析</reasoning>答案', '答案'],
    ['<think>内部<think>嵌套</think>内部</think>答案', '答案'],
    ['内部一</think>内部二</think>答案', '答案'],
    ['答案<thi', '答案'],
    ['答案</reason', '答案'],
    ['答案<think data-mode="hidden"', '答案'],
    ['2 < 3，所以选较小的数。', '2 < 3，所以选较小的数。'],
  ])('sanitizes malformed and nested reasoning: %s', (input, expected) => {
    expect(sanitizeTutorReply(input)).toBe(expected)
  })

  it('leaves an ordinary reply unchanged', () => {
    expect(sanitizeTutorReply('可以用小苏打和白醋做气泡实验。')).toBe('可以用小苏打和白醋做气泡实验。')
  })
})
