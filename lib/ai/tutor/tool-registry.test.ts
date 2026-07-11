import { describe, expect, it } from 'vitest'

import { buildTutorToolCallsFromPlan, getAvailableTutorTools } from '@/lib/ai/tutor/tool-registry'

describe('getAvailableTutorTools', () => {
  it('exposes pbl stage focus only in challenge stage context', () => {
    expect(
      getAvailableTutorTools({
        contextType: 'challenge',
        sceneCapabilities: ['focusChallengeStage'],
        stageIndex: 2,
      }).map((tool) => tool.name),
    ).toEqual(['pbl.focus_current_stage'])
  })

  it('exposes scratch highlight only when the current lesson step has scratch hints', () => {
    expect(
      getAvailableTutorTools({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 1,
      }).map((tool) => tool.name),
    ).toEqual(['course.focus_lesson_step'])

    expect(
      getAvailableTutorTools({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 1,
        scratchBlockKeywords: ['当绿旗被点击'],
      }).map((tool) => tool.name),
    ).toEqual(['course.focus_lesson_step', 'course.highlight_scratch_blocks'])
  })

  it('hides tools when the current scene does not expose the required capability', () => {
    expect(
      getAvailableTutorTools({
        contextType: 'course',
        lessonId: 42,
        lessonStepIndex: 1,
        scratchBlockKeywords: ['当绿旗被点击'],
      }),
    ).toEqual([])
  })

  it('exposes the minesweeper hint only when the playground handler is mounted', () => {
    expect(
      getAvailableTutorTools({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
      }).map((tool) => tool.name),
    ).toEqual(['playground.hint_minesweeper'])

    expect(getAvailableTutorTools({ contextType: 'global' })).toEqual([])
  })
})

describe('buildTutorToolCallsFromPlan', () => {
  it('builds validated scratch tool calls from planner selections', () => {
    expect(
      buildTutorToolCallsFromPlan({
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
      }),
    ).toEqual([
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
    ])
  })

  it('ignores unavailable planner selections', () => {
    expect(
      buildTutorToolCallsFromPlan({
        contextType: 'course',
        sceneCapabilities: ['focusCourseLessonStep'],
        lessonId: 42,
        lessonStepIndex: 2,
        selections: [
          {
            name: 'course.highlight_scratch_blocks',
            reason: 'stuck',
            targetItemIndex: 0,
          },
          {
            name: 'course.focus_lesson_step',
            reason: 'stuck',
            stepIndex: 2,
          },
        ],
      }),
    ).toEqual([
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: 42,
          stepIndex: 2,
          reason: 'stuck',
        },
      },
    ])
  })

  it('builds a validated minesweeper hint tool call', () => {
    expect(
      buildTutorToolCallsFromPlan({
        contextType: 'global',
        sceneCapabilities: ['hintMinesweeperCell'],
        selections: [{ name: 'playground.hint_minesweeper', reason: 'stuck' }],
      }),
    ).toEqual([
      {
        name: 'playground.hint_minesweeper',
        payload: { reason: 'stuck' },
      },
    ])
  })
})
