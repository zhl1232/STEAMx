import { describe, expect, it } from 'vitest'
import { carryTutorMessages, tutorDisplayMessages, type TutorDisplayMessage } from './tutor-carryover'
import { tutorSheetSummary } from './tutor-mobile-sheet'

describe('tutor carryover', () => {
  it('keeps the latest 20 completed chat bubbles and drops trail dividers', () => {
    const messages: TutorDisplayMessage[] = Array.from({ length: 25 }, (_, i) => ({ role: 'assistant', content: `${i}` }))
    messages[10] = { role: 'divider', content: '现在在：旧页面' }
    messages.push({ role: 'assistant', content: '未完成', streaming: true })
    const carried = carryTutorMessages(messages)
    expect(carried).toHaveLength(20)
    expect(carried[0].content).toBe('4')
    expect(carried.every((message) => message.role !== 'divider')).toBe(true)
    expect(carried.map((message) => message.content)).not.toContain('现在在：旧页面')
    expect(carried.at(-1)?.content).toBe('24')
  })

  it('deduplicates by role and content without injecting browse-trail markers', () => {
    const carried: TutorDisplayMessage[] = [{ role: 'assistant', content: '答案' }, { role: 'divider', content: '现在在：旧页' }]
    const messages = [{ role: 'assistant' as const, content: '答案' }, { role: 'user' as const, content: '答案' }]
    expect(tutorDisplayMessages(carried, messages).map((m) => m.content)).toEqual(['答案', '答案'])
    expect(tutorDisplayMessages(carried, messages).every((m) => m.role !== 'divider')).toBe(true)
    expect(tutorDisplayMessages(carried, messages, '小车').map((m) => m.content)).toEqual(['答案', '答案'])
    expect(tutorDisplayMessages(carried, messages, '小车').map((m) => m.content).join('\n')).not.toContain('现在在')
    expect(tutorSheetSummary(tutorDisplayMessages(carried, messages))).toBe('小迪：答案')
    expect(tutorDisplayMessages([], [], '小车')).toEqual([])
  })
})
