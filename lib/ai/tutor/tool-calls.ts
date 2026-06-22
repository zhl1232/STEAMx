import type { TutorContextType } from '@/lib/ai/tutor/types'

export const TUTOR_TOOL_NAMES = ['pbl.focus_current_stage', 'course.focus_lesson_step'] as const

export type TutorToolName = (typeof TUTOR_TOOL_NAMES)[number]

export type PblFocusCurrentStageToolPayload = {
  stageIndex: number
  reason: 'stuck' | 'next_step' | 'review'
}

export type CourseFocusLessonStepToolPayload = {
  lessonId: number
  stepIndex: number
  reason: 'stuck' | 'next_step'
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

type BuildTutorToolCallsInput = {
  contextType: TutorContextType
  stageIndex?: number
  lessonId?: number
  lessonStepIndex?: number
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

function detectCourseStepFocusReason(content: string): CourseFocusLessonStepToolPayload['reason'] | null {
  const normalized = content.trim()
  if (!normalized) return null
  if (/下一步|接下来/.test(normalized)) return 'next_step'
  if (STUCK_PATTERNS.some((pattern) => pattern.test(normalized))) return 'stuck'
  return null
}

export function buildTutorToolCalls(input: BuildTutorToolCallsInput): TutorToolCall[] {
  if (input.contextType === 'course') {
    if (typeof input.lessonId !== 'number') return []
    if (typeof input.lessonStepIndex !== 'number') return []

    const reason = detectCourseStepFocusReason(input.content)
    if (!reason) return []

    return [
      {
        name: 'course.focus_lesson_step',
        payload: {
          lessonId: input.lessonId,
          stepIndex: input.lessonStepIndex,
          reason,
        },
      },
    ]
  }

  if (input.contextType !== 'challenge') return []
  if (typeof input.stageIndex !== 'number') return []

  const reason = detectPblFocusReason(input.content)
  if (!reason) return []

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
