import { describe, expect, it } from 'vitest'
import { carryTutorMessages, tutorDisplayMessages, type TutorDisplayMessage } from './tutor-carryover'
import { tutorSheetSummary } from './tutor-mobile-sheet'

describe('tutor carryover', () => {
  it('keeps the latest 20 completed display entries including older dividers', () => {
    const messages: TutorDisplayMessage[] = Array.from({ length: 25 }, (_, i) => ({ role: 'assistant', content: `${i}` }))
    messages[10] = { role: 'divider', content: '现在在：旧页面' }
    messages.push({ role: 'assistant', content: '未完成', streaming: true })
    const carried = carryTutorMessages(messages)
    expect(carried).toHaveLength(20)
    expect(carried[0].content).toBe('5')
    expect(carried).toContainEqual(messages[10])
    expect(carried.at(-1)?.content).toBe('24')
  })
  it('deduplicates by role and content and updates only the new divider title', () => {
    const carried: TutorDisplayMessage[] = [{ role: 'assistant', content: '答案' }, { role: 'divider', content: '现在在：旧页' }]
    const messages = [{ role: 'assistant' as const, content: '答案' }, { role: 'user' as const, content: '答案' }]
    expect(tutorDisplayMessages(carried, messages).map((m) => m.content)).toEqual(['答案', '现在在：旧页', '现在在：新页面', '答案'])
    const display = tutorDisplayMessages(carried, messages, '小车')
    expect(display[2].content).toBe('现在在：小车')
    expect(tutorSheetSummary(display)).toBe('小迪：答案')
    expect(tutorDisplayMessages([], [], '小车')).toEqual([])
  })
})
