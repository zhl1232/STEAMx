export const STAGE_COACH_ACTIONS = ['breakdown', 'hint', 'summary'] as const

export type StageCoachAction = (typeof STAGE_COACH_ACTIONS)[number]

export interface StageCoachActionResult {
  action: StageCoachAction
  title: string
  bullets: string[]
  followUp: string
  generatedAt?: string
}

const ACTION_TITLE: Record<StageCoachAction, string> = {
  breakdown: '拆成几个小问题',
  hint: '给一点提示',
  summary: '整理这一步',
}

const ACTION_FOLLOW_UP: Record<StageCoachAction, string> = {
  breakdown: '先挑一个最容易回答的问题写进产出记录。',
  hint: '选一条提示试试看，再补一张过程图或一组数据。',
  summary: '把还缺的证据补上，再决定是否完成这步。',
}

function cleanText(value: unknown, maxLength = 80) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function isStageCoachAction(value: unknown): value is StageCoachAction {
  return typeof value === 'string' && STAGE_COACH_ACTIONS.includes(value as StageCoachAction)
}

export function normalizeStageCoachActionResult(input: {
  action: StageCoachAction
  payload?: Partial<StageCoachActionResult> | null
}): StageCoachActionResult {
  const action = isStageCoachAction(input.payload?.action) ? input.payload.action : input.action
  const rawBullets = Array.isArray(input.payload?.bullets) ? input.payload?.bullets : []
  const bullets = rawBullets
    .map((item) => cleanText(item, 70))
    .filter(Boolean)
    .slice(0, action === 'summary' ? 5 : 4)

  return {
    action,
    title: cleanText(input.payload?.title, 28) || ACTION_TITLE[action],
    bullets: bullets.length > 0 ? bullets : [ACTION_FOLLOW_UP[action]],
    followUp: cleanText(input.payload?.followUp, 90) || ACTION_FOLLOW_UP[action],
    generatedAt: typeof input.payload?.generatedAt === 'string'
      ? input.payload.generatedAt
      : new Date().toISOString(),
  }
}

