import type { ScratchBlockCategory, ScratchBlockHintItem } from '@/lib/courses/scratch-hints'

export const TUTOR_TOOL_NAMES = [
  'pbl.focus_current_stage',
  'course.focus_lesson_step',
  'course.highlight_scratch_blocks',
  'playground.hint_minesweeper',
] as const

export type TutorToolName = (typeof TUTOR_TOOL_NAMES)[number]
export type TutorToolReason = 'stuck' | 'next_step' | 'review'

export type PblFocusCurrentStageToolPayload = {
  stageIndex: number
  reason: TutorToolReason
}

export type CourseFocusLessonStepToolPayload = {
  lessonId: number
  stepIndex: number
  reason: TutorToolReason
}

export type CourseHighlightScratchBlocksToolPayload = {
  lessonId: number
  stepIndex: number
  keywords: string[]
  items?: ScratchBlockHintItem[]
  targetItemIndex?: number
  category?: ScratchBlockCategory
  reason: TutorToolReason
}

export type PlaygroundHintMinesweeperToolPayload = {
  reason: TutorToolReason
}

export type TutorToolCall =
  | {
      name: 'pbl.focus_current_stage'
      payload: PblFocusCurrentStageToolPayload
    }
  | {
      name: 'course.focus_lesson_step'
      payload: CourseFocusLessonStepToolPayload
    }
  | {
      name: 'course.highlight_scratch_blocks'
      payload: CourseHighlightScratchBlocksToolPayload
    }
  | {
      name: 'playground.hint_minesweeper'
      payload: PlaygroundHintMinesweeperToolPayload
    }
