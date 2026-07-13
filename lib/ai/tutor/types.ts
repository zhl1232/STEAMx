import type { TutorSceneCapability } from '@/lib/ai/tutor/scene-capabilities'
import type { ScratchBlockCategory, ScratchBlockHintItem } from '@/lib/courses/scratch-hints'
import type { ScratchEditorContext } from '@/lib/courses/scratch-messages'

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

export const TUTOR_PLAYGROUND_GAME_KEYS = [
  'minesweeper',
  'gomoku',
  'life',
  '2048',
  '24game',
  'hanoi',
  'sudoku',
  'nqueens',
  'fifteen',
  'memory',
  'quickmath',
  'maze',
  'tangram',
  'nonogram',
  'ballsort',
  'balance',
  'symmetry',
  'circuit',
] as const
export type TutorPlaygroundGameKey = (typeof TUTOR_PLAYGROUND_GAME_KEYS)[number]

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
  /** Scratch 课时：面向孩子的「先找积木，再改参数」提示项 */
  scratchBlockItems?: ScratchBlockHintItem[]
  /** Scratch 课时：可优先打开的积木分类 */
  scratchBlockCategory?: ScratchBlockCategory
  /** Scratch 课时：当前步骤内正在提示第几个积木动作 */
  scratchBlockTargetItemIndex?: number
  /** Scratch 课时：当前步骤总共有多少个积木动作 */
  scratchBlockStepItemCount?: number
  /** Scratch 课时：编辑器当前选中的角色、角色列表与基础状态 */
  scratchEditorContext?: ScratchEditorContext
  /** 当前 scene 默认提供给 tutor tool 的前端能力 */
  sceneCapabilities?: TutorSceneCapability[]
  /** 当前场景可插入对话的鸟鸣音频 */
  availableAudios?: TutorAudioRef[]
  /** 仅 global 场景：当前页面标识 */
  surface?: TutorGlobalSurface
  /** 仅 playground surface：当前具体小游戏 */
  playgroundGameKey?: TutorPlaygroundGameKey
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
  learningSignalsSummary?: string
  /** Safe disclosure summary for questions like "can you see my profile/radar?" */
  dataAccessSummary?: string
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
