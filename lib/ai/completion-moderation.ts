import { analyzeCompletionProofImageWithQwen } from '@/lib/ai/completion-proof-vision'
import { getObservationVisionUserMessage } from '@/lib/ai/qwen-vision'
import { isClean } from '@/lib/content-filter'

export type CompletionModerationDecision = {
  pass: boolean
  reason: string | null
  imageResults: Array<{
    imageUrl: string
    moderationPass: boolean
    moderationReason: string | null
  }>
}

export async function evaluateCompletionContent(input: {
  notes?: string | null
  imageUrls: string[]
}): Promise<CompletionModerationDecision> {
  const text = (input.notes || '').trim()
  if (text) {
    if (!isClean(text)) {
      return {
        pass: false,
        reason: '文字内容包含不适宜词汇，请修改后重试。',
        imageResults: [],
      }
    }
  }

  const imageUrls = Array.from(new Set(input.imageUrls.filter(Boolean)))
  if (imageUrls.length === 0) {
    return {
      pass: false,
      reason: '请至少上传一张作品照片。',
      imageResults: [],
    }
  }

  const imageResults: CompletionModerationDecision['imageResults'] = []

  for (const imageUrl of imageUrls) {
    try {
      const result = await analyzeCompletionProofImageWithQwen(imageUrl)
      imageResults.push({
        imageUrl,
        moderationPass: result.moderationPass,
        moderationReason: result.moderationReason,
      })
      if (!result.moderationPass) {
        return {
          pass: false,
          reason: result.moderationReason || '图片内容未通过审核，请更换后重试。',
          imageResults,
        }
      }
    } catch (error) {
      return {
        pass: false,
        reason: getObservationVisionUserMessage(error),
        imageResults,
      }
    }
  }

  return { pass: true, reason: null, imageResults }
}
