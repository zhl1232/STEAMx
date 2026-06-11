import type { StageAiFeedback } from '@/lib/mappers/types'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_TEXT_MODEL = 'qwen3.7-plus'
const DEFAULT_VISION_MODEL = 'qwen3.7-plus'

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

function getConfig(preferVision: boolean) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = preferVision
    ? process.env.DASHSCOPE_VISION_MODEL || DEFAULT_VISION_MODEL
    : process.env.DASHSCOPE_TEXT_MODEL || process.env.DASHSCOPE_VISION_MODEL || DEFAULT_TEXT_MODEL

  if (!apiKey) {
    throw new StageCoachError(
      'Missing DASHSCOPE_API_KEY',
      '服务端未配置 AI 指导密钥，请稍后再试。',
    )
  }

  return { apiKey, baseUrl, model }
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

async function callDashScope(body: Record<string, unknown>, preferVision: boolean) {
  const { apiKey, baseUrl, model } = getConfig(preferVision)

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, ...body }),
  })

  const raw = await response.json().catch(() => null)
  if (!response.ok) {
    throw new StageCoachError(
      `DashScope request failed (${response.status})`,
      'AI 指导暂时不可用，请稍后再试。',
      response.status,
    )
  }

  const content = (raw as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message?.content

  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
        ? (item as { text: string }).text
        : ''))
      .join('\n')
  }
  return ''
}

/**
 * 阶段答疑：苏格拉底式引导，不直接给完整方案。
 */
export async function coachStageQa(context: StageCoachContext, question: string): Promise<string> {
  const systemPrompt = [
    '你是青少年 STEAM 项目式学习(PBL)的引导老师，帮助学生推进当前阶段。',
    '原则：苏格拉底式优先——先用一两个问题点拨方向，再给具体但开放的建议，最后可给一个可立即尝试的小动作。',
    '严禁直接给出完整答案或替学生做决定；要保留探究空间。',
    '语气贴近青少年、简短、鼓励，使用中文，控制在 120 字以内。',
    '不要提"AI、模型、平台、算法"，不要使用 Markdown 标题或代码块。',
  ].join('\n')

  const content = await callDashScope(
    {
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `${buildContextText(context)}\n\n学生的问题：${compact(question, 1000)}`,
        },
      ],
    },
    false,
  )

  const reply = content.trim()
  if (reply.length < 2) {
    throw new StageCoachError('Empty coach reply', 'AI 指导没有给出内容，请换个说法再试。')
  }
  return reply
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

export function getStageCoachUserMessage(error: unknown): string {
  if (error instanceof StageCoachError) return error.userMessage
  return 'AI 指导暂时不可用，请稍后再试。'
}

export interface TutorChatMessage {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

/**
 * 持续对话的 AI 学习导师（agent 风格）：保留完整上下文，结合当前挑战与阶段，
 * 苏格拉底式引导、可点评学生贴出的图片产出，不直接代做。
 */
export async function chatWithTutor(
  context: StageCoachContext,
  messages: TutorChatMessage[],
): Promise<string> {
  const systemPrompt = [
    '你叫「小迪」，是青少年 STEAM 项目式学习(PBL)的 AI 学习导师，正在一对一陪伴这名学生完成下面这个挑战。',
    '人设：友好、有耐心、像大哥哥/大姐姐，会鼓励，偶尔用一个表情。中文回答，单条尽量不超过 140 字。',
    '你有记忆：下面给出了这名学生在各阶段已经记录的产出，以及你们之前的对话。回答时要结合"学生已经做了什么"，',
    '可以具体引用他/她写过的内容（例如"你在第1步提到的…"），让建议贴合他的项目，而不是泛泛而谈。',
    '方法：苏格拉底式优先——先点拨方向或反问，再给开放但具体的建议，最后给一个能立刻尝试的小动作；不要直接给完整答案或替学生做决定。',
    '引导节奏：判断学生现在卡在哪、下一步该做什么；当他这一步已经写得比较完整时，鼓励他保存并"完成这步"进入下一阶段；当还缺关键内容（如该阶段要求的测试数据、对比、取舍说明）时，温和地提醒补上。',
    '当学生贴出图片或描述了产出时，结合当前阶段目标，指出做得好的点、还缺什么、下一步可以试什么。',
    '紧扣这个挑战与"当前阶段"的目标和约束；不跑题。不要使用 Markdown 标题或代码块；不要提"模型/平台/算法"。',
    '',
    '【当前上下文】',
    buildContextText(context),
    `当前阶段类型：${context.stageKind || 'generic'}`,
  ].join('\n')

  // 只给"最新一条用户消息"带图，历史图片转成文字备注，避免每轮重复抓取旧图。
  let lastUserIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      lastUserIndex = i
      break
    }
  }

  const buildMessages = (includeImages: boolean): Array<Record<string, unknown>> => {
    const dsMessages: Array<Record<string, unknown>> = [{ role: 'system', content: systemPrompt }]
    messages.forEach((m, i) => {
      const imageCount = m.images?.length ?? 0
      const attachImages = includeImages && i === lastUserIndex && imageCount > 0
      if (attachImages) {
        const content: Array<Record<string, unknown>> = [{ type: 'text', text: m.content || '请看看我这一步的产出。' }]
        for (const url of (m.images ?? []).slice(0, 4)) {
          content.push({ type: 'image_url', image_url: { url } })
        }
        dsMessages.push({ role: 'user', content })
      } else {
        const note = m.role === 'user' && imageCount > 0
          ? `${m.content || '（我贴了产出图片）'}（附了 ${imageCount} 张图片）`
          : m.content
        dsMessages.push({ role: m.role, content: note })
      }
    })
    return dsMessages
  }

  const wantImages = (messages[lastUserIndex]?.images?.length ?? 0) > 0

  let reply = ''
  try {
    reply = await callDashScope({ temperature: 0.7, messages: buildMessages(wantImages) }, wantImages)
  } catch (error) {
    // 视觉调用失败（常见于无法下载图片）时，降级为纯文本重试，导师仍能基于文字描述回复。
    if (wantImages) {
      reply = await callDashScope({ temperature: 0.7, messages: buildMessages(false) }, false)
    } else {
      throw error
    }
  }

  const text = reply.trim()
  if (text.length < 1) {
    throw new StageCoachError('Empty tutor reply', '导师没有给出内容，请换个说法再试。')
  }
  return text
}
