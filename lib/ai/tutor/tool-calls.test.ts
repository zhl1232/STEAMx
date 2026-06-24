import { describe, expect, it } from 'vitest'

import { buildTutorToolCalls } from '@/lib/ai/tutor/tool-calls'

describe('buildTutorToolCalls', () => {
  it('emits a PBL stage focus tool call when the student is stuck in a challenge stage', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'challenge',
        stageIndex: 2,
        content: '我卡住了，不知道下一步怎么做',
      }),
    ).toEqual([
      {
        name: 'pbl.focus_current_stage',
        payload: {
          stageIndex: 2,
          reason: 'next_step',
        },
      },
    ])
  })

  it('uses review reason when the student asks for feedback', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'challenge',
        stageIndex: 1,
        content: '请看看我这一步的产出，给点反馈',
      }),
    ).toEqual([
      {
        name: 'pbl.focus_current_stage',
        payload: {
          stageIndex: 1,
          reason: 'review',
        },
      },
    ])
  })

  it('does not emit tool calls outside challenge stage context', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'global',
        stageIndex: 0,
        content: '我卡住了',
      }),
    ).toEqual([])

    expect(
      buildTutorToolCalls({
        contextType: 'challenge',
        content: '我卡住了',
      }),
    ).toEqual([])
  })

  it('does not emit tool calls for normal PBL questions', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'challenge',
        stageIndex: 0,
        content: '遮阳模型可以用哪些材料？',
      }),
    ).toEqual([])
  })

  it('emits a course lesson step focus tool call when the student asks for help in a lesson', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'course',
        lessonId: 42,
        lessonStepIndex: 1,
        scratchBlockKeywords: ['重复执行', '说 你好!'],
        scratchBlockItems: [
          { label: '重复执行', findLabel: '重复执行' },
          { label: '说 出发啦！', findLabel: '说 你好!', editHint: '把文字改成「出发啦！」' },
        ],
        scratchBlockCategory: 'control',
        content: '我卡住了，这一步不知道怎么做',
      }),
    ).toEqual([
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: 42,
          stepIndex: 1,
          reason: 'stuck',
        },
      },
      {
        name: 'course.highlight_scratch_blocks',
        payload: {
          lessonId: 42,
          stepIndex: 1,
          keywords: ['重复执行', '说 你好!'],
          items: [
            { label: '重复执行', findLabel: '重复执行' },
            { label: '说 出发啦！', findLabel: '说 你好!', editHint: '把文字改成「出发啦！」' },
          ],
          category: 'control',
          reason: 'stuck',
        },
      },
    ])
  })

  it('does not emit course tool calls without a lesson page context', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'course',
        content: '我卡住了',
      }),
    ).toEqual([])
  })
})
