export const TUTOR_CONTEXT_TYPES = ['global', 'challenge', 'project', 'observation', 'course', 'species'] as const
export type TutorContextType = (typeof TUTOR_CONTEXT_TYPES)[number]

/** global 场景下的页面标识：让小迪在不同页面有不同的开场白与上下文 */
export const TUTOR_GLOBAL_SURFACES = [
  'home',
  'explore',
  'nature',
  'create',
  'courses',
  'community',
  'playground',
  'profile',
  'users',
] as const
export type TutorGlobalSurface = (typeof TUTOR_GLOBAL_SURFACES)[number]

export type TutorChatMessage = {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

export type TutorAudioRef = {
  slug: string
  label: string
  audioUrl: string
}

export type TutorSceneContext = {
  contextType: TutorContextType
  contextId: string
  title: string
  summary: string
  stageIndex?: number
  stageKind?: string | null
  suggestedImages?: string[]
  /** Scratch 课时：当前步骤可受控高亮提示的积木关键词 */
  scratchBlockKeywords?: string[]
  /** 当前场景可插入对话的鸟鸣音频 */
  availableAudios?: TutorAudioRef[]
  /** 仅 global 场景：当前页面标识 */
  surface?: TutorGlobalSurface
}

export type StudentProfileSnapshot = {
  displayName: string
  ageGroup: string | null
  level: number
  xp: number
  memberDays: number
  radarSummary: string
  statsSummary: string
  recentActivity: string
  text: string
}

export type TutorGreeting = {
  message: string
  quickPrompts: string[]
}

export type AiCreditStatus = {
  isMember: boolean
  walletBalance: number
  monthlyGrant: number
  freeDaily: number
  freeUsedToday: number
  freeRemainingToday: number
  grantPeriod: string
  dayResetAt: number
  canChat: boolean
}

export type AiCreditConsumeResult = {
  ok: boolean
  source?: 'wallet' | 'free'
  remaining?: number
  cost?: number
  error?: string
  resetAt?: number
  freeUsedToday?: number
  freeDaily?: number
}
