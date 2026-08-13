import { dashScopeChatComplete } from '@/lib/ai/dashscope'
import { mapDashScopeErrorToObservationVision, ObservationVisionError } from '@/lib/ai/qwen-vision'

export type UploadedImageModerationResult = {
  pass: boolean
  reason: string | null
  modelName: string
  rawResponse: unknown
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

function mapUploadModerationError(error: unknown) {
  return mapDashScopeErrorToObservationVision(error, {
    missingConfig: '图片审核服务未配置，请联系管理员。',
    timeout: '图片审核服务响应超时，请稍后重试。',
    http: () => '图片审核服务暂时不可用，请稍后重试。',
  })
}

export async function moderateUploadedImage(
  imageSource: string,
  contextLabel = '图片',
): Promise<UploadedImageModerationResult> {
  let result: Awaited<ReturnType<typeof dashScopeChatComplete>>
  try {
    result = await dashScopeChatComplete({
      role: 'moderation',
      payload: {
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
      },
    })
  } catch (error) {
    throw mapUploadModerationError(error)
  }

  if (!result.text) {
    throw new ObservationVisionError({
      code: 'provider_empty_response',
      message: 'Empty upload moderation response',
      userMessage: '图片审核返回为空，请稍后重试。',
      details: result.raw,
    })
  }

  try {
    const payload = parseUploadModerationPayload(result.text)
    return {
      pass: payload.moderation_pass,
      reason: payload.moderation_reason,
      modelName: result.model,
      rawResponse: result.raw,
    }
  } catch (error) {
    throw new ObservationVisionError({
      code: 'provider_invalid_response',
      message: error instanceof Error ? error.message : 'Failed to parse upload moderation response',
      userMessage: '图片审核返回格式异常，请稍后重试。',
      details: result.raw,
    })
  }
}
