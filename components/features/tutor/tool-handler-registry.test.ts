import { describe, expect, it, vi } from 'vitest'

import { buildTutorToolHandlers, getTutorSceneCapabilities } from '@/components/features/tutor/tool-handler-registry'

describe('buildTutorToolHandlers', () => {
  it('wires challenge tools to the challenge focus capability', async () => {
    const focusChallengeStage = vi.fn()
    const handlers = buildTutorToolHandlers({
      focusChallengeStage,
    })

    await handlers['pbl.focus_current_stage']?.({
      name: 'pbl.focus_current_stage',
      payload: {
        stageIndex: 1,
        reason: 'review',
      },
    })

    expect(focusChallengeStage).toHaveBeenCalledWith({
      name: 'pbl.focus_current_stage',
      payload: {
        stageIndex: 1,
        reason: 'review',
      },
    })
  })

  it('wires both course tools to the shared course focus capability', async () => {
    const focusCourseLessonStep = vi.fn()
    const handlers = buildTutorToolHandlers({
      focusCourseLessonStep,
    })

    await handlers['course.focus_lesson_step']?.({
      name: 'course.focus_lesson_step',
      payload: {
        lessonId: 42,
        stepIndex: 2,
        reason: 'next_step',
      },
    })
    await handlers['course.highlight_scratch_blocks']?.({
      name: 'course.highlight_scratch_blocks',
      payload: {
        lessonId: 42,
        stepIndex: 2,
        keywords: ['说 你好!'],
        reason: 'stuck',
      },
    })

    expect(focusCourseLessonStep).toHaveBeenNthCalledWith(1, {
      name: 'course.focus_lesson_step',
      payload: {
        lessonId: 42,
        stepIndex: 2,
        reason: 'next_step',
      },
    })
    expect(focusCourseLessonStep).toHaveBeenNthCalledWith(2, {
      name: 'course.highlight_scratch_blocks',
      payload: {
        lessonId: 42,
        stepIndex: 2,
        keywords: ['说 你好!'],
        reason: 'stuck',
      },
    })
  })

  it('only exposes handlers for capabilities provided by the current screen', () => {
    const handlers = buildTutorToolHandlers({})
    expect(handlers).toEqual({})
  })
})

describe('getTutorSceneCapabilities', () => {
  it('derives scene capabilities from the current page-provided abilities', () => {
    expect(
      getTutorSceneCapabilities({
        focusChallengeStage: vi.fn(),
        focusCourseLessonStep: vi.fn(),
      }),
    ).toEqual(['focusChallengeStage', 'focusCourseLessonStep'])
  })
})
