import {
  DASHSCOPE_COMPLETE_TIMEOUT_MS,
  DASHSCOPE_STREAM_TIMEOUT_MS,
  DashScopeError,
  dashScopeChatComplete,
  dashScopeChatCompletions,
  isDashScopeTimeoutError,
  parseDashScopeUsage,
  type DashScopeModelRole,
  type DashScopeTokenUsage,
} from '@/lib/ai/dashscope'

export class TutorEngineError extends Error {
  userMessage: string
  status?: number

  constructor(message: string, userMessage: string, status?: number) {
    super(message)
    this.name = 'TutorEngineError'
    this.userMessage = userMessage
    this.status = status
  }
}

export type TutorEngineMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[]
}

type TutorModelMode = 'text' | 'planner'

export type TutorTokenUsage = DashScopeTokenUsage

export type TutorEngineTelemetry = {
  model: string
  usage: TutorTokenUsage | null
  visionFallback: boolean
}

export type TutorEngineOptions = {
  modelMode?: TutorModelMode
  /** Visual-only callers must not turn a failed image request into a text-only guess. */
  allowVisionFallback?: boolean
  /** Internal planners use a deterministic, short response. */
  temperature?: number
  maxTokens?: number
  /** 覆盖默认超时（毫秒）。 */
  timeoutMs?: number
  /** 视觉调用失败、即将降级为纯文本重试时触发（用于提示用户/退差价）。 */
  onVisionFallback?: () => void
  /** 调用成功结束后回传模型与 token 用量，供计费与观测记录。 */
  onTelemetry?: (telemetry: TutorEngineTelemetry) => void
}

function tutorRole(preferVision: boolean, mode: TutorModelMode): DashScopeModelRole {
  if (preferVision) return 'tutor-vision'
  return mode === 'planner' ? 'tutor-planner' : 'tutor-text'
}

function toTutorEngineError(error: unknown): TutorEngineError {
  if (error instanceof TutorEngineError) return error
  if (error instanceof DashScopeError) {
    if (error.code === 'missing_config') {
      return new TutorEngineError(error.message, '服务端未配置 AI 密钥，请稍后再试。')
    }
    if (error.code === 'timeout') {
      return new TutorEngineError(error.message, '小迪响应超时，请稍后再试。', 504)
    }
    return new TutorEngineError(error.message, '小迪暂时不可用，请稍后再试。', error.status)
  }
  if (isDashScopeTimeoutError(error)) {
    return new TutorEngineError('DashScope stream timed out', '小迪响应超时，请稍后再试。', 504)
  }
  return error instanceof Error
    ? new TutorEngineError(error.message, '小迪暂时不可用，请稍后再试。')
    : new TutorEngineError(String(error), '小迪暂时不可用，请稍后再试。')
}

function throwTutorEngineError(error: unknown): never {
  throw toTutorEngineError(error)
}

function buildDashScopeMessages(
  systemPrompt: string,
  messages: TutorEngineMessage[],
  options: { includeImages?: boolean; visionFallbackNote?: boolean } = {},
) {
  const includeImages = options.includeImages ?? true
  let activeImageIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && (messages[i].images?.length ?? 0) > 0) {
      activeImageIndex = i
      break
    }
  }

  const dsMessages: Array<Record<string, unknown>> = [{ role: 'system', content: systemPrompt }]

  messages.forEach((m, i) => {
    const imageCount = m.images?.length ?? 0
    const attachImages = includeImages && i === activeImageIndex && imageCount > 0
    if (attachImages) {
      const content: Array<Record<string, unknown>> = [
        { type: 'text', text: m.content || '请看看我的产出。' },
      ]
      for (const url of (m.images ?? []).slice(0, 4)) {
        content.push({ type: 'image_url', image_url: { url } })
      }
      dsMessages.push({ role: 'user', content })
    } else {
      // 视觉降级重试时，对本应带图的这条消息如实说明图片不可用，
      // 避免模型假装看过图片作答。
      const fallbackNote =
        options.visionFallbackNote && i === activeImageIndex
          ? `${m.content || '（附了产出图片）'}（附了 ${imageCount} 张图片，但这次图片没能加载成功；请如实说明看不到图片，并请学生用文字补充关键信息）`
          : null
      const note =
        m.role === 'user' && imageCount > 0
          ? fallbackNote ?? `${m.content || '（附了产出图片）'}（附了 ${imageCount} 张图片）`
          : m.content
      dsMessages.push({ role: m.role, content: note })
    }
  })

  return { dsMessages, wantImages: activeImageIndex >= 0, activeImageIndex }
}

export async function chatWithTutorComplete(
  systemPrompt: string,
  messages: TutorEngineMessage[],
  options?: TutorEngineOptions,
): Promise<string> {
  const { wantImages } = buildDashScopeMessages(systemPrompt, messages)
  const mode = options?.modelMode ?? 'text'
  const timeoutMs = options?.timeoutMs ?? DASHSCOPE_COMPLETE_TIMEOUT_MS

  const call = async (includeImages: boolean) => {
    const { dsMessages } = buildDashScopeMessages(systemPrompt, messages, {
      includeImages,
      visionFallbackNote: wantImages && !includeImages,
    })
    const result = await dashScopeChatComplete({
      role: tutorRole(includeImages && wantImages, mode),
      timeoutMs,
      payload: {
        temperature: options?.temperature ?? 0.7,
        ...(typeof options?.maxTokens === 'number' ? { max_tokens: options.maxTokens } : {}),
        messages: dsMessages,
      },
    })

    return {
      model: result.model,
      usage: result.usage,
      text: result.text,
    }
  }

  let result: Awaited<ReturnType<typeof call>>
  let visionFallback = false
  try {
    result = await call(wantImages)
  } catch (error) {
    if (wantImages && options?.allowVisionFallback !== false) {
      visionFallback = true
      options?.onVisionFallback?.()
      try {
        result = await call(false)
      } catch (fallbackError) {
        throwTutorEngineError(fallbackError)
      }
    } else {
      throwTutorEngineError(error)
    }
  }

  if (!result.text) {
    throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
  }

  options?.onTelemetry?.({ model: result.model, usage: result.usage, visionFallback })
  return result.text
}

export async function* streamChatWithTutor(
  systemPrompt: string,
  messages: TutorEngineMessage[],
  options?: TutorEngineOptions,
): AsyncGenerator<string, string, undefined> {
  const { wantImages } = buildDashScopeMessages(systemPrompt, messages)
  const mode = options?.modelMode ?? 'text'
  const timeoutMs = options?.timeoutMs ?? DASHSCOPE_STREAM_TIMEOUT_MS

  const streamOnce = async function* (
    includeImages: boolean,
  ): AsyncGenerator<string, { text: string; model: string; usage: TutorTokenUsage | null }, undefined> {
    const { dsMessages } = buildDashScopeMessages(systemPrompt, messages, {
      includeImages,
      visionFallbackNote: wantImages && !includeImages,
    })
    const { response, model } = await dashScopeChatCompletions({
      role: tutorRole(includeImages && wantImages, mode),
      timeoutMs,
      payload: {
        temperature: options?.temperature ?? 0.7,
        stream: true,
        stream_options: { include_usage: true },
        messages: dsMessages,
      },
    })

    if (!response.body) {
      throw new TutorEngineError('DashScope stream missing body', '小迪暂时不可用，请稍后再试。')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''
    let usage: TutorTokenUsage | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>
              usage?: unknown
            }
            const parsedUsage = parseDashScopeUsage(parsed.usage)
            if (parsedUsage) usage = parsedUsage
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              full += delta
              yield delta
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch (error) {
      if (isDashScopeTimeoutError(error) || error instanceof DashScopeError) {
        throwTutorEngineError(error)
      }
      throw error
    }

    return { text: full.trim(), model, usage }
  }

  const drain = async function* (
    gen: ReturnType<typeof streamOnce>,
    onYield?: () => void,
  ): AsyncGenerator<string, { text: string; model: string; usage: TutorTokenUsage | null }, undefined> {
    while (true) {
      const { value, done } = await gen.next()
      if (done) return value
      if (value) {
        onYield?.()
        yield value
      }
    }
  }

  let yieldedAny = false

  try {
    const result = yield* drain(streamOnce(wantImages), () => {
      yieldedAny = true
    })
    if (!result.text) {
      throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
    }
    options?.onTelemetry?.({ model: result.model, usage: result.usage, visionFallback: false })
    return result.text
  } catch (error) {
    // 仅在视觉模型「还没输出任何内容」就失败时降级为纯文本重试；
    // 已经吐出一半内容再重播会让前端出现拼接的重复文本。
    if (wantImages && !yieldedAny && options?.allowVisionFallback !== false) {
      options?.onVisionFallback?.()
      try {
        const result = yield* drain(streamOnce(false))
        if (!result.text) {
          throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
        }
        options?.onTelemetry?.({ model: result.model, usage: result.usage, visionFallback: true })
        return result.text
      } catch (fallbackError) {
        throwTutorEngineError(fallbackError)
      }
    }
    throwTutorEngineError(error)
  }
}

function formatTutorTranscript(messages: Array<{ role: string; content: string }>) {
  return messages
    .map((m) => `${m.role === 'user' ? '学生' : '小迪'}：${m.content.slice(0, 300)}`)
    .join('\n')
}

/** 摘要类任务的共享出口：planner 模型 + 低温 + 失败回退旧文本 */
async function summarizeWithModel(input: {
  system: string
  user: string
  maxChars: number
  fallback: string
}): Promise<string> {
  try {
    const { text } = await dashScopeChatComplete({
      role: 'tutor-planner',
      timeoutMs: DASHSCOPE_COMPLETE_TIMEOUT_MS,
      payload: {
        temperature: 0.3,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      },
    })
    return text.slice(0, input.maxChars) || input.fallback
  } catch {
    return input.fallback
  }
}

/** 用户级 notebook 默认字数上限；活跃学生可放宽（见 memory.resolveNotebookCharLimit） */
export const NOTEBOOK_DEFAULT_CHAR_LIMIT = 600

export async function summarizeNotebook(
  previousNotebook: string,
  recentMessages: Array<{ role: string; content: string }>,
  maxChars = NOTEBOOK_DEFAULT_CHAR_LIMIT,
): Promise<string> {
  return summarizeWithModel({
    system: `你是小迪的内部笔记本助手。把旧笔记与新对话合并成一份不超过 ${maxChars} 字的中文记忆摘要，记录：学生偏好、技能强弱、正在做的事、沟通风格、需要记住的约定。只输出摘要正文，不要标题。`,
    user: `【旧笔记】\n${previousNotebook || '（空）'}\n\n【新对话】\n${formatTutorTranscript(recentMessages)}`,
    maxChars,
    fallback: previousNotebook,
  })
}

/** 会话滚动摘要字数上限 */
export const CONVERSATION_SUMMARY_CHAR_LIMIT = 400

/** 把滑出上下文窗口的早期会话消息折叠进滚动摘要 */
export async function summarizeConversationWindow(
  previousSummary: string,
  olderMessages: Array<{ role: string; content: string }>,
): Promise<string> {
  return summarizeWithModel({
    system: `你是小迪的会话摘要助手。把旧摘要与即将滑出上下文窗口的对话合并成一份不超过 ${CONVERSATION_SUMMARY_CHAR_LIMIT} 字的中文摘要，按时间顺序记录：聊过的话题、学生的关键进展或作品状态、双方的约定与未完成事项。只输出摘要正文，不要标题。`,
    user: `【旧摘要】\n${previousSummary || '（空）'}\n\n【滑出窗口的对话】\n${formatTutorTranscript(olderMessages)}`,
    maxChars: CONVERSATION_SUMMARY_CHAR_LIMIT,
    fallback: previousSummary,
  })
}

export function getTutorEngineUserMessage(error: unknown): string {
  if (error instanceof TutorEngineError) return error.userMessage
  if (error instanceof DashScopeError) {
    if (error.code === 'missing_config') return '服务端未配置 AI 密钥，请稍后再试。'
    if (error.code === 'timeout') return '小迪响应超时，请稍后再试。'
  }
  return '小迪暂时不可用，请稍后再试。'
}
