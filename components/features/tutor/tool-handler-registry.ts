'use client'

import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { TutorToolCall, TutorToolName } from '@/lib/ai/tutor/tool-calls'

export type TutorToolHandler = (toolCall: TutorToolCall) => void | Promise<void>

export type TutorToolHandlerContext = {
  focusChallengeStage?: (toolCall: Extract<TutorToolCall, { name: 'pbl.focus_current_stage' }>) => void | Promise<void>
  focusCourseLessonStep?: (
    toolCall: Extract<TutorToolCall, { name: 'course.focus_lesson_step' | 'course.highlight_scratch_blocks' }>,
  ) => void | Promise<void>
  hintMinesweeperCell?: (
    toolCall: Extract<TutorToolCall, { name: 'playground.hint_minesweeper' }>,
  ) => void | Promise<void>
}

type TutorToolHandlerDefinition = {
  name: TutorToolName
  resolve: (context: TutorToolHandlerContext) => TutorToolHandler | null
}

const TUTOR_TOOL_HANDLER_REGISTRY: TutorToolHandlerDefinition[] = [
  {
    name: 'pbl.focus_current_stage',
    resolve: (context) => {
      if (!context.focusChallengeStage) return null
      return (toolCall) => {
        if (toolCall.name !== 'pbl.focus_current_stage') return
        return context.focusChallengeStage?.(toolCall)
      }
    },
  },
  {
    name: 'course.focus_lesson_step',
    resolve: (context) => {
      if (!context.focusCourseLessonStep) return null
      return (toolCall) => {
        if (toolCall.name !== 'course.focus_lesson_step') return
        return context.focusCourseLessonStep?.(toolCall)
      }
    },
  },
  {
    name: 'course.highlight_scratch_blocks',
    resolve: (context) => {
      if (!context.focusCourseLessonStep) return null
      return (toolCall) => {
        if (toolCall.name !== 'course.highlight_scratch_blocks') return
        return context.focusCourseLessonStep?.(toolCall)
      }
    },
  },
  {
    name: 'playground.hint_minesweeper',
    resolve: (context) => {
      if (!context.hintMinesweeperCell) return null
      return (toolCall) => {
        if (toolCall.name !== 'playground.hint_minesweeper') return
        return context.hintMinesweeperCell?.(toolCall)
      }
    },
  },
]

export function getTutorSceneCapabilities(context: TutorToolHandlerContext): TutorSceneCapability[] {
  const capabilities: TutorSceneCapability[] = []
  if (context.focusChallengeStage) capabilities.push('focusChallengeStage')
  if (context.focusCourseLessonStep) capabilities.push('focusCourseLessonStep')
  if (context.hintMinesweeperCell) capabilities.push('hintMinesweeperCell')
  return capabilities
}

export function buildTutorToolHandlers(context: TutorToolHandlerContext) {
  const handlers: Partial<Record<TutorToolName, TutorToolHandler>> = {}
  for (const definition of TUTOR_TOOL_HANDLER_REGISTRY) {
    const handler = definition.resolve(context)
    if (handler) handlers[definition.name] = handler
  }
  return handlers
}
