import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/tutor/engine', () => ({
  chatWithTutorComplete: vi.fn(),
}))

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import {
  planTutorToolDecision,
  shouldPlanTutorToolDecision,
  type PlannerInput,
} from '@/lib/ai/tutor/tool-call-planner'

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

  it('builds a minesweeper hint tool call for the playground scene', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"reason":"stuck","selections":[{"name":"playground.hint_minesweeper","reason":"stuck"}]}',
    )

    await expect(
      planTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '我卡住了，帮我看看哪一格能确定',
      }),
    ).resolves.toMatchObject({
      toolCalls: [
        {
          name: 'playground.hint_minesweeper',
          payload: { reason: 'stuck' },
        },
      ],
    })

    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).toContain('普通扫雷知识问答不触发')
    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).not.toContain('我卡住了，帮我看看哪一格能确定')
    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[1]?.[0]?.content).toContain('我卡住了，帮我看看哪一格能确定')
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

  it('lets the model decline ordinary Scratch concept questions', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue('{"selections":[]}')

    await expect(
      planTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        scratchBlockKeywords: ['重复执行'],
        content: '重复执行积木有什么作用？',
      }),
    ).resolves.toMatchObject({ selections: [], toolCalls: [] })

    expect(chatWithTutorComplete).toHaveBeenCalled()
  })

  it('lets the model decline ordinary minesweeper knowledge questions', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue('{"selections":[]}')

    await expect(
      planTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '扫雷里数字 2 表示什么？',
      }),
    ).resolves.toMatchObject({ selections: [], toolCalls: [] })

    expect(chatWithTutorComplete).toHaveBeenCalled()
  })

  it('lets the model decline general minesweeper safety concepts', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue('{"selections":[]}')

    await expect(
      planTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '怎么判断一个格子是否安全？',
      }),
    ).resolves.toMatchObject({ selections: [], toolCalls: [] })

    expect(chatWithTutorComplete).toHaveBeenCalled()
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
  const baseScratchCourseInput: Omit<PlannerInput, 'content'> = {
    contextType: 'course' as const,
    sceneCapabilities: ['focusCourseLessonStep'],
    lessonId: 42,
    lessonStepIndex: 2,
    scratchBlockKeywords: ['移动 10 步', '重复执行'],
    scratchBlockItems: [
      { label: '移动 10 步', findLabel: '移动 10 步', category: 'motion' as const },
      { label: '重复执行', findLabel: '重复执行', category: 'control' as const },
    ],
  }

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

  it.each([
    '帮我打开运动分类并高亮移动 10 步积木',
    '我找不到重复执行积木，帮我定位一下',
    '检查这一步还缺哪块积木',
  ])('uses planner for explicit Scratch page-action intent: %s', (content) => {
    expect(
      shouldPlanTutorToolDecision({
        ...baseScratchCourseInput,
        content,
      }),
    ).toBe(true)
  })

  it.each([
    '什么是广播消息积木？',
    'Scratch 变量和列表有什么区别？',
    '重复执行和重复执行直到有什么区别？',
  ])('still exposes the model planner for ordinary Scratch knowledge intent: %s', (content) => {
    expect(
      shouldPlanTutorToolDecision({
        ...baseScratchCourseInput,
        content,
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

  it('uses the capability check for non-Scratch tutor tools too', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'challenge',
        sceneCapabilities: ['focusChallengeStage'],
        stageIndex: 1,
        content: '我做好了',
      }),
    ).toBe(true)
  })

  it('uses planner when the minesweeper page exposes its local hint handler', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '哪一格安全？',
      }),
    ).toBe(true)
  })

  it.each([
    '这一局下一步怎么点？',
    '帮我看看当前棋盘有没有能确定的格子',
    '这格安全吗？',
  ])('uses planner for explicit minesweeper page-action intent: %s', (content) => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content,
      }),
    ).toBe(true)
  })

  it.each([
    '扫雷里旗子有什么用？',
    '数字 1 周围代表几个雷？',
    '为什么扫雷第一步通常不会炸？',
  ])('still exposes the model planner for ordinary minesweeper knowledge intent: %s', (content) => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content,
      }),
    ).toBe(true)
  })

  it('uses planner when a Scratch learner explicitly asks to locate a block', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        scratchBlockKeywords: ['移到 x: 0 y: 0'],
        content: '移到 x y 积木在哪里？',
      }),
    ).toBe(true)
  })

  it('does not make the capability check depend on message keywords', () => {
    expect(
      shouldPlanTutorToolDecision({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        scratchBlockKeywords: ['重复执行'],
        content: '重复执行积木有什么作用？',
      }),
    ).toBe(true)

    expect(
      shouldPlanTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '扫雷里数字 2 表示什么？',
      }),
    ).toBe(true)

    expect(
      shouldPlanTutorToolDecision({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        content: '怎么判断一个格子是否安全？',
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
