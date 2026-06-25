import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/tutor/engine', () => ({
  chatWithTutorComplete: vi.fn(),
}))

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import { planTutorToolDecision, shouldPlanTutorToolDecision } from '@/lib/ai/tutor/tool-call-planner'

describe('planTutorToolDecision', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('builds scratch tool calls from planner selections', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"reason":"next_step","selections":[{"name":"course.focus_lesson_step","reason":"next_step","stepIndex":2},{"name":"course.highlight_scratch_blocks","reason":"next_step","stepIndex":2,"targetItemIndex":1}]}',
    )

    await expect(
      planTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        lessonStepCount: 5,
        scratchBlockKeywords: ['当绿旗被点击', '说 你好!'],
        scratchBlockItems: [
          { label: '当绿旗被点击', findLabel: '当绿旗被点击', category: 'events' },
          { label: '说 出发啦！', findLabel: '说 你好!', category: 'looks', editHint: '把文字改成「出发啦！」' },
        ],
        scratchBlockTargetItemIndex: 0,
        content: '我把前一个做好了',
      }),
    ).resolves.toEqual({
      reason: 'next_step',
      selections: [
        {
          name: 'course.focus_lesson_step',
          reason: 'next_step',
          stepIndex: 2,
        },
        {
          name: 'course.highlight_scratch_blocks',
          reason: 'next_step',
          stepIndex: 2,
          targetItemIndex: 1,
        },
      ],
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
              { label: '说 出发啦！', findLabel: '说 你好!', category: 'looks', editHint: '把文字改成「出发啦！」' },
            ],
            targetItemIndex: 1,
            category: undefined,
            reason: 'next_step',
          },
        },
      ],
    })
  })

  it('builds pbl tool calls from planner selections', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"reason":"review","selections":[{"name":"pbl.focus_current_stage","reason":"review"}]}',
    )

    await expect(
      planTutorToolDecision({
        contextType: 'challenge',
        sceneCapabilities: ['focusChallengeStage'],
        stageIndex: 1,
        content: '你看看我这一步做得怎么样',
      }),
    ).resolves.toEqual({
      reason: 'review',
      selections: [
        {
          name: 'pbl.focus_current_stage',
          reason: 'review',
        },
      ],
      toolCalls: [
        {
          name: 'pbl.focus_current_stage',
          payload: {
            stageIndex: 1,
            reason: 'review',
          },
        },
      ],
    })
  })

  it('returns null when no tools are available in the current context', async () => {
    await expect(
      planTutorToolDecision({
        contextType: 'global',
        content: '下一步',
      }),
    ).resolves.toBeNull()

    expect(chatWithTutorComplete).not.toHaveBeenCalled()
  })

  it('tells the planner when all Scratch sub-actions are already present', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"reason":"next_step","selections":[{"name":"course.focus_lesson_step","reason":"next_step","stepIndex":3}]}',
    )

    await planTutorToolDecision({
      contextType: 'course',
      sceneCapabilities: ['focusCourseLessonStep'],
      lessonId: 42,
      lessonStepIndex: 2,
      lessonStepCount: 5,
      scratchBlockKeywords: [],
      scratchBlockItems: [],
      scratchBlockStepItemCount: 2,
      content: '下一步',
    })

    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).toContain('当前待提示 Scratch 子动作数：0')
    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).toContain('通常只需要聚焦下一课时步骤')
  })

  it('filters out planner tools that are unavailable in the current scene', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"reason":"next_step","selections":[{"name":"course.highlight_scratch_blocks","reason":"next_step","targetItemIndex":1},{"name":"course.focus_lesson_step","reason":"next_step","stepIndex":3}]}',
    )

    await expect(
      planTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        lessonStepCount: 5,
        content: '下一步',
      }),
    ).resolves.toEqual({
      reason: 'next_step',
      selections: [
        {
          name: 'course.focus_lesson_step',
          reason: 'next_step',
          stepIndex: 3,
        },
      ],
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
    })
  })
})

describe('shouldPlanTutorToolDecision', () => {
  it('uses planner for explicit page-action requests when tools are available', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        scratchBlockKeywords: ['当绿旗被点击', '说 你好!'],
        content: '下一步',
      }),
    ).toBe(true)
  })

  it('uses planner for implicit scratch completion-style messages', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        scratchBlockKeywords: ['当绿旗被点击', '说 你好!'],
        scratchBlockItems: [
          { label: '当绿旗被点击', findLabel: '当绿旗被点击', category: 'events' },
          { label: '说 出发啦！', findLabel: '说 你好!', category: 'looks', editHint: '把文字改成「出发啦！」' },
        ],
        scratchBlockTargetItemIndex: 0,
        content: '我把前一个做好了',
      }),
    ).toBe(true)
  })

  it('uses planner for non-Scratch tutor tools too', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'challenge',
        sceneCapabilities: ['focusChallengeStage'],
        stageIndex: 1,
        content: '我做好了',
      }),
    ).toBe(true)
  })

  it('does not use planner when no page tools are available', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'challenge',
        stageIndex: 1,
        content: '我做好了',
      }),
    ).toBe(false)
  })
})
