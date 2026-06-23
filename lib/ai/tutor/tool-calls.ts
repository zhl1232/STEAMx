import type { TutorContextType } from '@/lib/ai/tutor/types'
import type { ScratchBlockCategory } from '@/lib/courses/scratch-hints'

export const TUTOR_TOOL_NAMES = [
  'pbl.focus_current_stage',
  'course.focus_lesson_step',
  'course.highlight_scratch_blocks',
] as const

export type TutorToolName = (typeof TUTOR_TOOL_NAMES)[number]

export type PblFocusCurrentStageToolPayload = {
  stageIndex: number
  reason: 'stuck' | 'next_step' | 'review'
}

export type CourseFocusLessonStepToolPayload = {
  lessonId: number
  stepIndex: number
  reason: 'stuck' | 'next_step' | 'review'
}

export type CourseHighlightScratchBlocksToolPayload = {
  lessonId: number
  stepIndex: number
  keywords: string[]
  category?: ScratchBlockCategory
  reason: 'stuck' | 'next_step' | 'review'
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

type BuildTutorToolCallsInput = {
  contextType: TutorContextType
  stageIndex?: number
  lessonId?: number
  lessonStepIndex?: number
  scratchBlockKeywords?: string[]
  scratchBlockCategory?: ScratchBlockCategory
  content: string
}

const STUCK_PATTERNS = [
  /卡住/,
  /不会/,
  /不知道/,
  /没思路/,
  /没想法/,
  /做不下去/,
  /怎么办/,
  /下一步/,
  /接下来/,
  /从哪/,
  /从哪里/,
]

const REVIEW_PATTERNS = [
  /看看/,
  /检查/,
  /反馈/,
  /评价/,
  /改进/,
]

function detectPblFocusReason(content: string): PblFocusCurrentStageToolPayload['reason'] | null {
  const normalized = content.trim()
  if (!normalized) return null
  if (REVIEW_PATTERNS.some((pattern) => pattern.test(normalized))) return 'review'
  if (/下一步|接下来/.test(normalized)) return 'next_step'
  if (STUCK_PATTERNS.some((pattern) => pattern.test(normalized))) return 'stuck'
  return null
}

export function buildTutorToolCalls(input: BuildTutorToolCallsInput): TutorToolCall[] {
  const reason = detectPblFocusReason(input.content)
  if (!reason) return []

  if (input.contextType === 'course' && typeof input.lessonId === 'number') {
    const stepIndex = typeof input.lessonStepIndex === 'number' ? input.lessonStepIndex : 0
    const toolCalls: TutorToolCall[] = [
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: input.lessonId,
          stepIndex,
          reason,
        },
      },
    ]
    const keywords = (input.scratchBlockKeywords ?? []).filter((keyword) => keyword.trim().length > 0).slice(0, 4)
    if (keywords.length > 0) {
      toolCalls.push({
        name: 'course.highlight_scratch_blocks',
        payload: {
          lessonId: input.lessonId,
          stepIndex,
          keywords,
          category: input.scratchBlockCategory,
          reason,
        },
      })
    }
    return toolCalls
  }

  if (input.contextType !== 'challenge') return []
  if (typeof input.stageIndex !== 'number') return []

  return [
    {
      name: 'pbl.focus_current_stage',
      payload: {
        stageIndex: input.stageIndex,
        reason,
      },
    },
  ]
}
