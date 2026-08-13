import { DashScopeError, dashScopeChatComplete } from '@/lib/ai/dashscope'
import type { StageAiFeedback } from '@/lib/mappers/types'
import {
  normalizeChallengeSubmissionDraft,
  type ChallengeSubmissionDraft,
} from '@/lib/pbl/challenge-submission-draft'
import {
  normalizeStageCoachActionResult,
  type StageCoachAction,
  type StageCoachActionResult,
} from '@/lib/pbl/stage-coach-actions'

export class StageCoachError extends Error {
  userMessage: string
  status?: number

  constructor(message: string, userMessage: string, status?: number) {
    super(message)
    this.name = 'StageCoachError'
    this.userMessage = userMessage
    this.status = status
  }
}

export interface StageCoachContext {
  challengeTitle: string
  drivingQuestion?: string | null
  constraints?: string[] | null
  stageTitle: string
  stageDescription: string
  stageHint?: string | null
  stageKind?: string | null
  currentStageIndex?: number
  totalStages?: number
  /** 学生在各阶段已记录的产出摘要（跨阶段记忆） */
  progressSummary?: string | null
}

export interface StageArtifact {
  notes?: string | null
  imageUrls: string[]
}

function compact(value: string | null | undefined, maxLength = 600) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function buildContextText(context: StageCoachContext) {
  const stagePosition =
    typeof context.currentStageIndex === 'number' && typeof context.totalStages === 'number'
      ? `（第 ${context.currentStageIndex + 1}/${context.totalStages} 步）`
      : ''
  return [
    `挑战：${compact(context.challengeTitle, 120)}`,
    context.drivingQuestion ? `驱动问题：${compact(context.drivingQuestion, 200)}` : '',
    context.constraints && context.constraints.length > 0
      ? `约束：${context.constraints.map((c) => compact(c, 80)).join('；')}`
      : '',
    `当前阶段${stagePosition}：${compact(context.stageTitle, 120)}`,
    `阶段目标：${compact(context.stageDescription, 400)}`,
    context.stageHint ? `已有提示：${compact(context.stageHint, 200)}` : '',
    context.progressSummary ? `\n【学生已完成的进度与产出】\n${compact(context.progressSummary, 1400)}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function toStageCoachError(error: unknown): StageCoachError {
  if (error instanceof StageCoachError) return error
  if (error instanceof DashScopeError) {
    if (error.code === 'missing_config') {
      return new StageCoachError(error.message, '服务端未配置 AI 指导密钥，请稍后再试。')
    }
    return new StageCoachError(error.message, 'AI 指导暂时不可用，请稍后再试。', error.status)
  }
  return error instanceof Error
    ? new StageCoachError(error.message, 'AI 指导暂时不可用，请稍后再试。')
    : new StageCoachError(String(error), 'AI 指导暂时不可用，请稍后再试。')
}

async function callDashScope(body: Record<string, unknown>, preferVision: boolean) {
  try {
    const { text } = await dashScopeChatComplete({
      role: preferVision ? 'pbl-vision' : 'pbl-text',
      payload: body,
    })
    return text
  } catch (error) {
    throw toStageCoachError(error)
  }
}

function parseFeedbackPayload(text: string): StageAiFeedback {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
      const toStrings = (value: unknown) =>
        Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 5) : []
      return {
        strengths: toStrings(parsed.strengths),
        gaps: toStrings(parsed.gaps),
        nextActions: toStrings(parsed.next_actions ?? parsed.nextActions),
        generatedAt: new Date().toISOString(),
      }
    } catch {
      // fall through
    }
  }

  throw new StageCoachError('Invalid feedback payload', 'AI 反馈格式异常，请稍后重试。')
}

function parseStageCoachActionPayload(
  text: string,
  action: StageCoachAction,
): StageCoachActionResult {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Partial<StageCoachActionResult>
      return normalizeStageCoachActionResult({ action, payload: parsed })
    } catch {
      // fall through
    }
  }

  throw new StageCoachError('Invalid coach action payload', '导师动作格式异常，请稍后重试。')
}

function getStageCoachActionInstruction(action: StageCoachAction) {
  if (action === 'breakdown') {
    return [
      '动作：拆题。把当前阶段拆成 3-4 个学生可以立刻回答的小问题。',
      'bullets 必须都是问题句或检查点，帮助学生明确先观察/比较/测试什么。',
      'followUp 给一个最小行动，不超过 30 字。',
    ].join('\n')
  }
  if (action === 'hint') {
    return [
      '动作：提示。给 2-3 条开放提示，不能直接给完整方案或替学生做决定。',
      'bullets 要结合阶段类型、已有记录和完成清单，提醒可尝试的观察、变量、证据或取舍。',
      'followUp 给一个可立即尝试的小动作，不超过 30 字。',
    ].join('\n')
  }
  return [
    '动作：总结。把学生当前阶段材料整理成 3-5 条阶段小结。',
    'bullets 需要区分已完成证据、关键发现、仍缺证据或下一步判断；材料不足时必须明说缺什么。',
    'followUp 说明下一处最该补的记录，不超过 30 字。',
  ].join('\n')
}

/**
 * 阶段受控导师动作：拆题 / 提示 / 总结。只返回可渲染 JSON，不直接改写学生产出。
 */
export async function generateStageCoachAction(
  context: StageCoachContext,
  artifact: StageArtifact,
  action: StageCoachAction,
): Promise<StageCoachActionResult> {
  const systemPrompt = [
    '你是青少年 STEAM 项目式学习(PBL)的引导老师，正在帮助学生推进当前阶段。',
    '只严格输出 JSON，不要额外文字。格式：{"action":"","title":"","bullets":[],"followUp":""}',
    'action 必须是 breakdown、hint 或 summary 之一；title 不超过 14 个中文字符。',
    'bullets 每条中文不超过 32 字，避免空话；followUp 不超过 36 字。',
    '原则：脚手架式引导，不直接给完整答案，不替学生决定唯一做法，不编造学生没记录的测试结果。',
    getStageCoachActionInstruction(action),
  ].join('\n')

  const content = await callDashScope(
    {
      response_format: { type: 'json_object' },
      temperature: action === 'hint' ? 0.55 : 0.35,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            buildContextText(context),
            `\n当前学生阶段产出：${compact(artifact.notes, 1600) || '（暂无文字记录）'}`,
            artifact.imageUrls.length > 0 ? `图片数量：${artifact.imageUrls.length}` : '',
            `\n请执行动作：${action}`,
          ].filter(Boolean).join('\n'),
        },
      ],
    },
    false,
  )

  if (!content.trim()) {
    throw new StageCoachError('Empty coach action', '导师没有给出内容，请稍后重试。')
  }

  return parseStageCoachActionPayload(content, action)
}

/**
 * 阶段产出反馈：读取文字 + 图片，给出 优点/缺口/下一步，不替学生做决定。
 */
export async function reviewStageArtifact(
  context: StageCoachContext,
  artifact: StageArtifact,
): Promise<StageAiFeedback> {
  const systemPrompt = [
    '你是青少年 PBL 引导老师，点评学生在当前阶段提交的产出（含图片与文字）。',
    '只严格输出 JSON：{"strengths":[],"gaps":[],"next_actions":[]}，不要额外文字。',
    '每个数组 1-3 条，每条中文不超过 40 字。',
    'strengths=做得好的点；gaps=对照阶段目标还缺什么；next_actions=可立刻尝试的下一步。',
    '只指出方向，不替学生给出完整答案；不要编造图片里没有的内容。',
    '结合阶段类型检查关键点：build_test 关注是否有测试数据、是否一次只改一个变量；iterate 关注是否说明取舍与前后对比。',
  ].join('\n')

  const hasImages = artifact.imageUrls.length > 0
  const userContent: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `${buildContextText({ ...context })}\n阶段类型：${context.stageKind || 'generic'}\n学生文字产出：${compact(artifact.notes, 1500) || '（无）'}\n请点评。`,
    },
  ]
  for (const url of artifact.imageUrls.slice(0, 5)) {
    userContent.push({ type: 'image_url', image_url: { url } })
  }

  const content = await callDashScope(
    {
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    },
    hasImages,
  )

  if (!content.trim()) {
    throw new StageCoachError('Empty feedback', 'AI 反馈为空，请稍后重试。')
  }

  return parseFeedbackPayload(content)
}

function parseSubmissionDraftPayload(text: string, fallback: ChallengeSubmissionDraft): ChallengeSubmissionDraft {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')

  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as Partial<ChallengeSubmissionDraft>
      return normalizeChallengeSubmissionDraft({
        fallback,
        draft: { ...parsed, source: 'ai' },
      })
    } catch {
      // fall through
    }
  }

  throw new StageCoachError('Invalid submission draft payload', 'AI 投稿草稿格式异常，请稍后重试。')
}

/**
 * 最终投稿草稿：把阶段产出整理成可编辑标题、说明、反思和 STEAM 收获。
 */
export async function generateChallengeSubmissionDraft(input: {
  contextText: string
  fallback: ChallengeSubmissionDraft
}): Promise<ChallengeSubmissionDraft> {
  const systemPrompt = [
    '你是青少年 STEAM 项目式学习(PBL)的写作整理助手。',
    '任务：把学生已经记录的阶段产出整理成最终挑战投稿草稿，不能编造没有依据的测试结果、图片内容或结论。',
    '只严格输出 JSON，不要额外文字。格式：',
    '{"title":"", "notes":"", "steamInsights":[{"key":"S|T|E|A|M","label":"","evidence":""}]}',
    'title 不超过 30 个中文字符，像作品名，不要写成口号。',
    'notes 使用中文，分为【作品说明】【反思记录】【STEAM 能力收获】三段；整体不超过 900 字。',
    'steamInsights 取 2-4 条，evidence 必须引用阶段记录里的具体行为、数据、取舍或证据。',
    '如果材料不足，明确写还需要补充什么，不要假装已经完成。',
  ].join('\n')

  const content = await callDashScope(
    {
      response_format: { type: 'json_object' },
      temperature: 0.35,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${input.contextText}\n\n【本地草稿兜底】\n${input.fallback.notes}`,
        },
      ],
    },
    false,
  )

  if (!content.trim()) {
    throw new StageCoachError('Empty submission draft', 'AI 投稿草稿为空，请稍后重试。')
  }

  return parseSubmissionDraftPayload(content, input.fallback)
}

export function getStageCoachUserMessage(error: unknown): string {
  if (error instanceof StageCoachError) return error.userMessage
  if (error instanceof DashScopeError) {
    if (error.code === 'missing_config') return '服务端未配置 AI 指导密钥，请稍后再试。'
  }
  return 'AI 指导暂时不可用，请稍后再试。'
}
