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

  it('does not emit tool calls when the active context lacks required state', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'global',
        stageIndex: 0,
        content: '我卡住了',
      }),
    ).toEqual([])

    expect(
      buildTutorToolCalls({
        contextType: 'course',
        content: '我卡住了',
      }),
    ).toEqual([])
  })

  it('emits a course lesson step focus tool call when the student is stuck in a Scratch lesson', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'course',
        lessonId: 12,
        lessonStepIndex: 3,
        content: '我卡住了，这一步不会做',
      }),
    ).toEqual([
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: 12,
          stepIndex: 3,
          reason: 'stuck',
        },
      },
    ])
  })

  it('uses next_step reason for course lesson next-step prompts', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'course',
        lessonId: 12,
        lessonStepIndex: 1,
        content: '下一步该做什么？',
      }),
    ).toEqual([
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: 12,
          stepIndex: 1,
          reason: 'next_step',
        },
      },
    ])
  })

  it('does not emit course tool calls without the current lesson step', () => {
    expect(
      buildTutorToolCalls({
        contextType: 'course',
        lessonId: 12,
        content: '下一步该做什么？',
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
})
