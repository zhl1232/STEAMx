import { dashScopeChatComplete } from '@/lib/ai/dashscope'

export type AutoReplyTargetType = 'project' | 'completion' | 'observation'

export type AutoReplyContext = {
  targetType: AutoReplyTargetType
  title?: string | null
  description?: string | null
  category?: string | null
  notes?: string | null
  recordType?: string | null
  stageLabel?: string | null
  natureTopic?: string | null
  locationName?: string | null
  habitat?: string | null
  weather?: string | null
}

function compact(value: string | null | undefined, maxLength = 180) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return ''
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function buildContextText(context: AutoReplyContext) {
  if (context.targetType === 'observation') {
    return [
      `类型：自然观察`,
      context.natureTopic ? `主题：${context.natureTopic}` : '',
      context.locationName ? `地点：${compact(context.locationName, 80)}` : '',
      context.habitat ? `生境：${compact(context.habitat, 80)}` : '',
      context.weather ? `天气：${compact(context.weather, 60)}` : '',
      context.notes ? `备注：${compact(context.notes)}` : '',
    ].filter(Boolean).join('\n')
  }

  if (context.targetType === 'completion') {
    return [
      `类型：作品完成记录`,
      context.title ? `项目：${compact(context.title, 80)}` : '',
      context.recordType ? `记录类型：${compact(context.recordType, 40)}` : '',
      context.stageLabel ? `阶段：${compact(context.stageLabel, 60)}` : '',
      context.notes ? `说明：${compact(context.notes)}` : '',
    ].filter(Boolean).join('\n')
  }

  return [
    `类型：项目`,
    context.title ? `标题：${compact(context.title, 80)}` : '',
    context.category ? `分类：${compact(context.category, 40)}` : '',
    context.description ? `简介：${compact(context.description)}` : '',
  ].filter(Boolean).join('\n')
}

function parseReplyPayload(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1]?.trim() || trimmed
  const jsonStart = candidate.indexOf('{')
  const jsonEnd = candidate.lastIndexOf('}')

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try {
      const parsed = JSON.parse(candidate.slice(jsonStart, jsonEnd + 1)) as { reply?: unknown }
      if (typeof parsed.reply === 'string') return parsed.reply
    } catch {
      // Fall back to plain text cleanup below.
    }
  }

  return trimmed
}

export function normalizeAutoReplyText(input: string) {
  let text = input
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const firstLine = text.split(/\n+/)[0]?.trim()
  if (firstLine) text = firstLine

  if (text.length > 60) {
    const sentence = text.match(/^.{8,60}?[。！？!?]/)?.[0]
    text = sentence || text.slice(0, 60)
  }

  return text.trim()
}

export async function generateAutoReply(context: AutoReplyContext): Promise<string> {
  const contextText = buildContextText(context)
  const { text } = await dashScopeChatComplete({
    role: 'auto-reply',
    payload: {
      response_format: { type: 'json_object' },
      temperature: 0.85,
      messages: [
        {
          role: 'system',
          content: [
            '你是青少年 STEAM 社区里的普通用户，只帮忙写一条自然短留言。',
            '只输出 JSON：{"reply":"..."}。',
            '回复要像随手看到后写的，不要像总结或评语。',
            '目标 8-35 个中文字符，最多 60 字。',
            '可以轻轻夸一句、追问一个细节，或提一个很小的观察建议。',
            '不要提 AI、助手、平台、算法、模型，不要使用 Markdown。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: `根据下面内容写一条短回复：\n${contextText}`,
        },
      ],
    },
  })

  const reply = normalizeAutoReplyText(parseReplyPayload(text))

  if (reply.length < 2) {
    throw new Error('Auto reply generation returned empty content')
  }

  return reply
}
