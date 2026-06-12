import type { StudentProfileSnapshot, TutorGreeting, TutorSceneContext } from '@/lib/ai/tutor/types'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_TEXT_MODEL = 'qwen3.7-plus'
const DEFAULT_VISION_MODEL = 'qwen3.7-plus'
const DEFAULT_FLASH_MODEL = 'qwen-flash'
const GREETING_TIMEOUT_MS = 3500

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

function getConfig(preferVision: boolean, useFlash = false) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  let model = process.env.DASHSCOPE_TEXT_MODEL || DEFAULT_TEXT_MODEL
  if (useFlash) {
    model = process.env.DASHSCOPE_FLASH_MODEL || DEFAULT_FLASH_MODEL
  } else if (preferVision) {
    model = process.env.DASHSCOPE_VISION_MODEL || DEFAULT_VISION_MODEL
  }

  if (!apiKey) {
    throw new TutorEngineError(
      'Missing DASHSCOPE_API_KEY',
      '服务端未配置 AI 密钥，请稍后再试。',
    )
  }

  return { apiKey, baseUrl, model }
}

function buildDashScopeMessages(systemPrompt: string, messages: TutorEngineMessage[]) {
  let lastUserIndex = -1
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') {
      lastUserIndex = i
      break
    }
  }

  const dsMessages: Array<Record<string, unknown>> = [{ role: 'system', content: systemPrompt }]

  messages.forEach((m, i) => {
    const imageCount = m.images?.length ?? 0
    const attachImages = i === lastUserIndex && imageCount > 0
    if (attachImages) {
      const content: Array<Record<string, unknown>> = [
        { type: 'text', text: m.content || '请看看我的产出。' },
      ]
      for (const url of (m.images ?? []).slice(0, 4)) {
        content.push({ type: 'image_url', image_url: { url } })
      }
      dsMessages.push({ role: 'user', content })
    } else {
      const note =
        m.role === 'user' && imageCount > 0
          ? `${m.content || '（附了产出图片）'}（附了 ${imageCount} 张图片）`
          : m.content
      dsMessages.push({ role: m.role, content: note })
    }
  })

  return { dsMessages, wantImages: (messages[lastUserIndex]?.images?.length ?? 0) > 0, lastUserIndex }
}

function parseContent(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) {
    return raw
      .map((item) =>
        item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
          ? (item as { text: string }).text
          : '',
      )
      .join('\n')
  }
  return ''
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const match = trimmed.match(/\{[\s\S]*\}/)
  return match?.[0] ?? trimmed
}

export async function generateTutorGreeting(input: {
  profile: StudentProfileSnapshot
  scene: TutorSceneContext
  notebook: string | null
}): Promise<TutorGreeting> {
  const { apiKey, baseUrl, model } = getConfig(false, true)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GREETING_TIMEOUT_MS)

  try {
    const notebookText = input.notebook?.trim()
      ? `\n【小迪的笔记本】\n${input.notebook.trim().slice(0, 500)}`
      : ''
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.55,
        messages: [
          {
            role: 'system',
            content: [
              '你只为「小迪」生成聊天面板的开场白 JSON，不要输出其他文字。',
              '格式必须是 {"message":"...","quickPrompts":["...","...","..."]}。',
              'message 用中文 1-2 句，不超过 60 字，像真人导师自然打招呼；最多 1 个表情，可以不用。',
              'quickPrompts 给 2-3 个中文短问题，每个不超过 12 字。',
              '称呼学生时只用学生画像中「昵称：」后面的名字；「小迪」是 AI 导师自己的名字，绝对不能用来称呼学生。',
              '结合学生画像、笔记本和当前页面资源；禁止照抄英文枚举、@、ID、字段名或内部标签。',
              '如果页面有音频、步骤、材料清单等真实资源，可以自然提一句让学生对照页面使用；不要编造页面没有的资源。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              '【学生画像】',
              input.profile.text,
              notebookText,
              '',
              `【当前场景：${input.scene.contextType} — ${input.scene.title}】`,
              input.scene.summary.slice(0, 1200),
            ].join('\n'),
          },
        ],
      }),
    })

    const raw = await response.json().catch(() => null)
    if (!response.ok) {
      throw new TutorEngineError(
        `DashScope greeting failed (${response.status})`,
        '小迪暂时不可用，请稍后再试。',
        response.status,
      )
    }

    const content = parseContent(
      (raw as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content,
    )
    const parsed = JSON.parse(extractJsonObject(content)) as Partial<TutorGreeting>
    if (typeof parsed.message !== 'string' || !Array.isArray(parsed.quickPrompts)) {
      throw new TutorEngineError('Invalid greeting payload', '小迪暂时不可用，请稍后再试。')
    }

    return {
      message: parsed.message,
      quickPrompts: parsed.quickPrompts.filter((prompt): prompt is string => typeof prompt === 'string'),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function chatWithTutorComplete(
  systemPrompt: string,
  messages: TutorEngineMessage[],
): Promise<string> {
  const { wantImages } = buildDashScopeMessages(systemPrompt, messages)

  const call = async (includeImages: boolean) => {
    const { apiKey, baseUrl, model } = getConfig(includeImages && wantImages)
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: buildDashScopeMessages(systemPrompt, messages).dsMessages,
      }),
    })

    const raw = await response.json().catch(() => null)
    if (!response.ok) {
      throw new TutorEngineError(
        `DashScope request failed (${response.status})`,
        '小迪暂时不可用，请稍后再试。',
        response.status,
      )
    }

    return parseContent(
      (raw as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content,
    ).trim()
  }

  let reply = ''
  try {
    reply = await call(wantImages)
  } catch (error) {
    if (wantImages) {
      reply = await call(false)
    } else {
      throw error
    }
  }

  if (!reply) {
    throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
  }

  return reply
}

export async function* streamChatWithTutor(
  systemPrompt: string,
  messages: TutorEngineMessage[],
): AsyncGenerator<string, string, undefined> {
  const { wantImages } = buildDashScopeMessages(systemPrompt, messages)

  const streamOnce = async function* (includeImages: boolean) {
    const { apiKey, baseUrl, model } = getConfig(includeImages && wantImages)
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        stream: true,
        messages: buildDashScopeMessages(systemPrompt, messages).dsMessages,
      }),
    })

    if (!response.ok || !response.body) {
      throw new TutorEngineError(
        `DashScope stream failed (${response.status})`,
        '小迪暂时不可用，请稍后再试。',
        response.status,
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

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
          }
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

    return full.trim()
  }

  let yieldedAny = false

  try {
    let full = ''
    const gen = streamOnce(wantImages)
    while (true) {
      const { value, done } = await gen.next()
      if (done) {
        full = typeof value === 'string' ? value : full
        break
      }
      if (value) {
        full += value
        yieldedAny = true
        yield value
      }
    }
    if (!full.trim()) {
      throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
    }
    return full.trim()
  } catch (error) {
    // 仅在视觉模型「还没输出任何内容」就失败时降级为纯文本重试；
    // 已经吐出一半内容再重播会让前端出现拼接的重复文本。
    if (wantImages && !yieldedAny) {
      let full = ''
      const gen = streamOnce(false)
      while (true) {
        const { value, done } = await gen.next()
        if (done) {
          full = typeof value === 'string' ? value : full
          break
        }
        if (value) {
          full += value
          yield value
        }
      }
      if (!full.trim()) {
        throw new TutorEngineError('Empty tutor reply', '小迪没有给出内容，请换个说法再试。')
      }
      return full.trim()
    }
    throw error
  }
}

export async function summarizeNotebook(
  previousNotebook: string,
  recentMessages: Array<{ role: string; content: string }>,
): Promise<string> {
  const { apiKey, baseUrl, model } = getConfig(false, true)

  const transcript = recentMessages
    .map((m) => `${m.role === 'user' ? '学生' : '小迪'}：${m.content.slice(0, 300)}`)
    .join('\n')

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            '你是小迪的内部笔记本助手。把旧笔记与新对话合并成一份不超过 600 字的中文记忆摘要，记录：学生偏好、技能强弱、正在做的事、沟通风格、需要记住的约定。只输出摘要正文，不要标题。',
        },
        {
          role: 'user',
          content: `【旧笔记】\n${previousNotebook || '（空）'}\n\n【新对话】\n${transcript}`,
        },
      ],
    }),
  })

  const raw = await response.json().catch(() => null)
  if (!response.ok) return previousNotebook

  const text = parseContent(
    (raw as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content,
  ).trim()

  return text.slice(0, 600) || previousNotebook
}

export function getTutorEngineUserMessage(error: unknown): string {
  if (error instanceof TutorEngineError) return error.userMessage
  return '小迪暂时不可用，请稍后再试。'
}
