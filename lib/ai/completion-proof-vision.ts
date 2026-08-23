import { dashScopeChatComplete } from '@/lib/ai/dashscope'
import { mapDashScopeErrorToObservationVision, ObservationVisionError } from '@/lib/ai/qwen-vision'
import { BRAND_FULL_NAME } from '@/lib/brand'

export type CompletionProofVisionResult = {
  moderationPass: boolean
  moderationReason: string | null
  modelName: string
  rawResponse: unknown
}

function buildCompletionModerationPrompt() {
  return [
    `你是 ${BRAND_FULL_NAME} 青少年 STEAM 作品的图片审核助手。`,
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
  let result: Awaited<ReturnType<typeof dashScopeChatComplete>>
  try {
    result = await dashScopeChatComplete({
      role: 'moderation',
      payload: {
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
      },
    })
  } catch (error) {
    throw mapDashScopeErrorToObservationVision(error, {
      missingConfig: '服务端未配置视觉识别密钥。',
      timeout: '图片审核服务响应超时，请稍后重试。',
      http: () => '图片审核服务暂时不可用，请稍后重试。',
    })
  }

  if (!result.text) {
    throw new ObservationVisionError({
      code: 'provider_empty_response',
      message: 'Empty vision response',
      userMessage: '图片审核返回为空，请稍后重试。',
    })
  }

  const payload = parsePayload(result.text)
  return {
    moderationPass: payload.moderation_pass,
    moderationReason: payload.moderation_reason,
    modelName: result.model,
    rawResponse: result.raw,
  }
}
