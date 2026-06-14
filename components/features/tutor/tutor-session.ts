import type {
  AiCreditStatus,
  TutorChatMessage,
  TutorContextType,
  TutorGlobalSurface,
  TutorGreeting,
} from '@/lib/ai/tutor/types'

export const TUTOR_SESSION_STALE_MS = 5 * 60 * 1000

export type TutorSessionQueryInput = {
  userId: string
  contextType: TutorContextType
  contextId: string
  stageIndex?: number
  lessonId?: number
  surface?: TutorGlobalSurface
}

export type TutorSessionPayload = {
  messages?: TutorChatMessage[]
  quota?: AiCreditStatus | null
  greeting?: TutorGreeting | null
  conversation?: {
    id: string
    title: string
    createdAt: string
  }
  scene?: {
    title?: string
    contextType?: TutorContextType
    suggestedImages?: string[]
  }
  hasNotebook?: boolean
}

export function tutorSessionQueryKey(input: TutorSessionQueryInput) {
  return [
    'tutor-session',
    input.userId,
    input.contextType,
    input.contextId,
    input.stageIndex ?? null,
    input.lessonId ?? null,
    input.surface ?? null,
  ] as const
}

export function buildTutorChatParams(input: Omit<TutorSessionQueryInput, 'userId'>) {
  const params = new URLSearchParams({
    contextType: input.contextType,
    contextId: input.contextId,
  })
  if (typeof input.stageIndex === 'number') params.set('stageIndex', String(input.stageIndex))
  if (typeof input.lessonId === 'number') params.set('lessonId', String(input.lessonId))
  if (input.surface) params.set('surface', input.surface)
  return params
}

export async function fetchTutorSession(input: TutorSessionQueryInput): Promise<TutorSessionPayload> {
  const res = await fetch(`/api/tutor/chat?${buildTutorChatParams(input)}`)
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(typeof payload.error === 'string' ? payload.error : '小迪会话加载失败')
  }
  return res.json()
}
