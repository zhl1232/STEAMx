import type { XiaoDiState } from '@/components/features/tutor/xiaodi'

export type TutorMascotFeedback = 'success' | 'error'

export type TutorMascotStateInput = {
  recording: boolean
  feedback: TutorMascotFeedback | null
  working: boolean
  speaking: boolean
  thinking: boolean
}

/**
 * Resolve the visible XiaoDi state from concurrent tutor signals.
 * Priority: listening > error > working > speaking > success > thinking > idle.
 * speaking 高于 success，避免自动朗读时被成功反馈动画挡住。
 */
export function resolveTutorMascotState(input: TutorMascotStateInput): XiaoDiState {
  if (input.recording) return 'listening'
  if (input.feedback === 'error') return 'error'
  if (input.working) return 'working'
  if (input.speaking) return 'speaking'
  if (input.feedback === 'success') return 'success'
  if (input.thinking) return 'thinking'
  return 'idle'
}
