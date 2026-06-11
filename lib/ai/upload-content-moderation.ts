import { ObservationVisionError } from '@/lib/ai/qwen-vision'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen3.7-plus'

export type UploadedImageModerationResult = {
  pass: boolean
  reason: string | null
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
      userMessage: '图片审核服务未配置，请联系管理员。',
    })
  }

  return { apiKey, baseUrl, model }
}

function buildUploadModerationPrompt(contextLabel: string) {
  return [
    `你是青少年 STEAM 社区的${contextLabel}内容审核助手。`,
    '请严格输出 JSON，不要输出任何额外说明。',
    '判断图片是否包含色情、裸露、暴力、血腥、违法、仇恨、骚扰、毒品、赌博、政治极端、未成年人隐私风险、二维码引流、广告诈骗等不适宜内容。',
    '如果图片明显不是用户可公开发布的正常学习、手工、自然观察或头像素材，也应判为不通过。',
    '输出格式：{"moderation_pass": boolean, "moderation_reason": string|null}',
    'moderation_reason 使用简短中文说明不通过原因；通过时为 null。',
  ].join('\n')
}

export function parseUploadModerationPayload(text: string): {
  moderation_pass: boolean
  moderation_reason: string | null
} {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonText = fenced?.[1]
    ? fenced[1].trim()
    : trimmed.slice(
      trimmed.indexOf('{') >= 0 ? trimmed.indexOf('{') : 0,
      trimmed.lastIndexOf('}') >= 0 ? trimmed.lastIndexOf('}') + 1 : trimmed.length,
    )

  const parsed = JSON.parse(jsonText) as {
    moderation_pass?: unknown
    moderation_reason?: unknown
  }

  return {
    moderation_pass: parsed.moderation_pass === true,
    moderation_reason:
      typeof parsed.moderation_reason === 'string' && parsed.moderation_reason.trim()
        ? parsed.moderation_reason.trim().slice(0, 200)
        : null,
  }
}

export async function moderateUploadedImage(
  imageSource: string,
  contextLabel = '图片',
): Promise<UploadedImageModerationResult> {
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
        { role: 'system', content: buildUploadModerationPrompt(contextLabel) },
        {
          role: 'user',
          content: [
            { type: 'text', text: `请审核这张${contextLabel}。` },
            { type: 'image_url', image_url: { url: imageSource } },
          ],
        },
      ],
    }),
  })

  const rawResponse = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ObservationVisionError({
      code: 'provider_http_error',
      message: `DashScope moderation failed (${response.status})`,
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
      message: 'Empty upload moderation response',
      userMessage: '图片审核返回为空，请稍后重试。',
      details: rawResponse,
    })
  }

  try {
    const payload = parseUploadModerationPayload(text)
    return {
      pass: payload.moderation_pass,
      reason: payload.moderation_reason,
      modelName: model,
      rawResponse,
    }
  } catch (error) {
    throw new ObservationVisionError({
      code: 'provider_invalid_response',
      message: error instanceof Error ? error.message : 'Failed to parse upload moderation response',
      userMessage: '图片审核返回格式异常，请稍后重试。',
      details: rawResponse,
    })
  }
}
