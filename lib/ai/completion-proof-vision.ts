import { ObservationVisionError } from '@/lib/ai/qwen-vision'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen3.7-plus'

export type CompletionProofVisionResult = {
  moderationPass: boolean
  moderationReason: string | null
  modelName: string
  rawResponse: unknown
}

function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.DASHSCOPE_VISION_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    throw new ObservationVisionError({
      code: 'missing_config',
      message: 'Missing DASHSCOPE_API_KEY',
      userMessage: '服务端未配置视觉识别密钥。',
    })
  }

  return { apiKey, baseUrl, model }
}

function buildCompletionModerationPrompt() {
  return [
    '你是青少年 STEAM 探索作品图片审核助手。',
    '请严格输出 JSON，不要输出任何额外说明。',
    '判断图片是否包含色情、暴力、血腥、违法、仇恨、未成年人不适宜等内容。',
    '与手工/科学探索无关的纯广告、二维码引流、截图聊天也可判为不通过。',
    '输出格式：{"moderation_pass": boolean, "moderation_reason": string|null}',
    'moderation_reason 使用简短中文，说明不通过原因；通过时为 null。',
  ].join('\n')
}

function parsePayload(text: string): { moderation_pass: boolean; moderation_reason: string | null } {
  const parsed = JSON.parse(text) as {
    moderation_pass?: unknown
    moderation_reason?: unknown
  }
  return {
    moderation_pass: Boolean(parsed.moderation_pass),
    moderation_reason:
      typeof parsed.moderation_reason === 'string' ? parsed.moderation_reason : null,
  }
}

export async function analyzeCompletionProofImageWithQwen(
  imageUrl: string,
): Promise<CompletionProofVisionResult> {
  const { apiKey, baseUrl, model } = getDashScopeConfig()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: buildCompletionModerationPrompt() },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请审核这张探索作品配图。' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  })

  const rawResponse = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ObservationVisionError({
      code: 'provider_http_error',
      message: `DashScope failed (${response.status})`,
      userMessage: '图片审核服务暂时不可用，请稍后重试。',
      status: response.status,
      details: rawResponse,
    })
  }

  const content = (rawResponse as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
    ?.message?.content
  const text = typeof content === 'string' ? content : ''
  if (!text.trim()) {
    throw new ObservationVisionError({
      code: 'provider_empty_response',
      message: 'Empty vision response',
      userMessage: '图片审核返回为空，请稍后重试。',
    })
  }

  const payload = parsePayload(text)
  return {
    moderationPass: payload.moderation_pass,
    moderationReason: payload.moderation_reason,
    modelName: model,
    rawResponse,
  }
}
