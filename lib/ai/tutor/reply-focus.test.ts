import { describe, expect, it } from 'vitest'

import { buildTutorReplyFocusSummary } from '@/lib/ai/tutor/reply-focus'

describe('buildTutorReplyFocusSummary', () => {
  it('pins the reply to the highlighted Scratch sub-action when next step stays in the same lesson step', () => {
    const summary = buildTutorReplyFocusSummary({
      previousLessonStepIndex: 2,
      toolCalls: [
        {
          name: 'course.focus_lesson_step',
          payload: {
            lessonId: 42,
            stepIndex: 2,
            reason: 'next_step',
          },
        },
        {
          name: 'course.highlight_scratch_blocks',
          payload: {
            lessonId: 42,
            stepIndex: 2,
            keywords: ['当绿旗被点击', '说 你好!'],
            items: [
              { label: '当绿旗被点击', findLabel: '当绿旗被点击', category: 'events' },
              {
                label: '说 出发啦！',
                findLabel: '说 你好!',
                category: 'looks',
                editHint: '把文字改成「出发啦！」',
              },
            ],
            targetItemIndex: 1,
            reason: 'next_step',
          },
        },
      ],
    })

    expect(summary).toContain('第3步的第2/2个 Scratch 动作')
    expect(summary).toContain('不是下一课时步骤')
    expect(summary).toContain('[[block:looks|说 你好!]]')
    expect(summary).toContain('拖出后把文字改成「出发啦！」')
    expect(summary).toContain('不要讲第4步')
  })

  it('returns an empty summary when no Scratch highlight tool was emitted', () => {
    expect(
      buildTutorReplyFocusSummary({
        previousLessonStepIndex: 2,
        toolCalls: [
          {
            name: 'course.focus_lesson_step',
            payload: {
              lessonId: 42,
              stepIndex: 3,
              reason: 'next_step',
            },
          },
        ],
      }),
    ).toBe('')
  })

  it('keeps the minesweeper reply aligned with the browser-only board result', () => {
    const summary = buildTutorReplyFocusSummary({
      toolCalls: [
        {
          name: 'playground.hint_minesweeper',
          payload: { reason: 'stuck' },
        },
      ],
    })

    expect(summary).toContain('只根据已翻开的数字、旗子和隐藏格')
    expect(summary).toContain('不会高亮答案格')
    expect(summary).toContain('不要编造坐标、直接说哪格安全/是雷')
    expect(summary).toContain('没有偷看未公开的雷图')
  })
})
