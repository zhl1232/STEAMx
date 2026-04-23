import {
  mapVisionPayloadToAnalysisResult,
  parseObservationVisionPayload,
  type ObservationMediaAnalysisResult,
  type SpeciesRow,
} from '@/lib/ai/observation-media-analysis'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen3.6-plus'

function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.DASHSCOPE_VISION_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    throw new Error('Missing required environment variable: DASHSCOPE_API_KEY')
  }

  return { apiKey, baseUrl, model }
}

function buildPrompt() {
  return [
    '你是自然观察图片审核与鸟类识别助手。',
    '请严格输出 JSON，不要输出任何额外说明。',
    '任务分两部分：',
    '1. 判断图片是否包含违规、不适宜或与自然观察明显无关的内容。',
    '2. 判断图片是否足够清晰、主体是否可识别。',
    '如果图片通过上述两项，再给出最多 3 个鸟类候选。',
    '候选名称优先使用中文常见名，若知道学名请附带。',
    '如果不是鸟，或无法可靠识别，不要猜测，返回空数组。',
    '输出格式：',
    '{',
    '  "moderation_pass": boolean,',
    '  "moderation_reason": string|null,',
    '  "quality_pass": boolean,',
    '  "quality_reason": string|null,',
    '  "species_candidates": [',
    '    {',
    '      "common_name": string,',
    '      "scientific_name": string|null,',
    '      "confidence": number,',
    '      "reason": string|null',
    '    }',
    '  ]',
    '}',
    '规则：',
    '- confidence 取值 0 到 1。',
    '- 低质、模糊、主体过远、逆光严重、遮挡严重时，quality_pass 必须为 false。',
    '- 如果包含未成年人隐私风险、血腥、色情、违法等不适宜内容，moderation_pass 必须为 false。',
    '- 不要编造不存在的物种名。',
  ].join('\n')
}

export async function analyzeObservationImageWithQwen(
  imageUrl: string,
  speciesRows: SpeciesRow[],
): Promise<ObservationMediaAnalysisResult> {
  const { apiKey, baseUrl, model } = getDashScopeConfig()

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: buildPrompt(),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这张自然观察图片。' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  })

  const rawResponse = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      (rawResponse && typeof rawResponse === 'object' && 'error' in rawResponse
        ? JSON.stringify((rawResponse as { error?: unknown }).error)
        : null) || `DashScope request failed (${response.status})`
    throw new Error(message)
  }

  const content = Array.isArray((rawResponse as { choices?: Array<{ message?: { content?: unknown } }> })?.choices)
    ? (rawResponse as { choices: Array<{ message?: { content?: unknown } }> }).choices[0]?.message?.content
    : null

  let textContent = ''
  if (typeof content === 'string') {
    textContent = content
  } else if (Array.isArray(content)) {
    textContent = content
      .map((item) => {
        if (!item || typeof item !== 'object') return ''
        const chunk = item as { text?: unknown }
        return typeof chunk.text === 'string' ? chunk.text : ''
      })
      .join('\n')
  }

  const parsed = parseObservationVisionPayload(textContent)
  return mapVisionPayloadToAnalysisResult(parsed, speciesRows, model, rawResponse)
}
