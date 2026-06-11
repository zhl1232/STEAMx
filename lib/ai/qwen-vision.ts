import {
  mapVisionPayloadToAnalysisResult,
  parseObservationVisionPayload,
  type ObservationMediaAnalysisResult,
  type SpeciesRow,
} from '@/lib/ai/observation-media-analysis'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_MODEL = 'qwen3.7-plus'

type ObservationVisionErrorCode =
  | 'missing_config'
  | 'provider_http_error'
  | 'provider_empty_response'
  | 'provider_invalid_response'

export class ObservationVisionError extends Error {
  code: ObservationVisionErrorCode
  userMessage: string
  status?: number
  details?: unknown

  constructor({
    code,
    message,
    userMessage,
    status,
    details,
  }: {
    code: ObservationVisionErrorCode
    message: string
    userMessage: string
    status?: number
    details?: unknown
  }) {
    super(message)
    this.name = 'ObservationVisionError'
    this.code = code
    this.userMessage = userMessage
    this.status = status
    this.details = details
  }
}

function getDashScopeConfig() {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = process.env.DASHSCOPE_VISION_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    throw new ObservationVisionError({
      code: 'missing_config',
      message: 'Missing required environment variable: DASHSCOPE_API_KEY',
      userMessage: '服务端未配置视觉识别密钥，请检查线上环境变量。',
    })
  }

  return { apiKey, baseUrl, model }
}

function buildPrompt() {
  return [
    '你是自然观察图片审核与物种识别助手，覆盖鸟类、昆虫、植物等自然生物。',
    '请严格输出 JSON，不要输出任何额外说明。',
    '任务分两部分：',
    '1. 判断图片是否包含违规、不适宜或与自然观察明显无关的内容。',
    '2. 判断图片是否足够清晰、主体是否可识别。',
    '如果图片通过上述两项，再给出最多 3 个最贴近主体的物种候选（可跨鸟类/昆虫/植物）。',
    '候选名称优先使用中文常见名，若知道学名请附带。',
    '如果无法可靠识别，不要猜测，返回空数组。',
    '输出格式：',
    '{',
    '  "moderation_pass": boolean,',
    '  "moderation_reason": string|null,',
    '  "quality_pass": boolean,',
    '  "quality_reason": string|null,',
    '  "note_suggestion": string|null,',
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
    '- note_suggestion 只在审核和质量都通过时填写，生成 40 到 90 字中文观察备注。',
    '- note_suggestion 必须使用第一人称观察记录语气，像用户自己写下的备注，例如“我看到……”。',
    '- note_suggestion 不要使用“画面展示了”“图片中”“照片里”“背景为”等第三方解说口吻。',
    '- note_suggestion 只描述可见事实，如主体姿态、可能行为、环境、光线、距离；不要编造地点、时间、数量或未出现的行为。',
    '- note_suggestion 避免写死物种结论，可用“我看到一个观察对象”等谨慎表达。',
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
    throw new ObservationVisionError({
      code: 'provider_http_error',
      message,
      userMessage: `视觉识别服务返回错误（${response.status}），请检查模型、密钥或上游额度。`,
      status: response.status,
      details: rawResponse,
    })
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

  if (!textContent.trim()) {
    throw new ObservationVisionError({
      code: 'provider_empty_response',
      message: 'DashScope response did not include message content',
      userMessage: '视觉识别服务返回空结果，请稍后重试。',
      details: rawResponse,
    })
  }

  try {
    const parsed = parseObservationVisionPayload(textContent)
    return mapVisionPayloadToAnalysisResult(parsed, speciesRows, model, rawResponse)
  } catch (error) {
    throw new ObservationVisionError({
      code: 'provider_invalid_response',
      message: error instanceof Error ? error.message : 'Failed to parse DashScope response',
      userMessage: '视觉识别服务返回格式异常，请检查模型是否支持 JSON 输出。',
      details: rawResponse,
    })
  }
}

export function getObservationVisionUserMessage(error: unknown): string {
  if (error instanceof ObservationVisionError) {
    return error.userMessage
  }

  if (error instanceof Error && error.message.includes('DASHSCOPE_API_KEY')) {
    return '服务端未配置视觉识别密钥，请检查线上环境变量。'
  }

  return '图片识别失败，请稍后重试。'
}

export function serializeObservationVisionError(error: unknown): Record<string, unknown> {
  if (error instanceof ObservationVisionError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: error.userMessage,
      status: error.status ?? null,
      details: error.details ?? null,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'unknown_error',
      message: error.message,
      userMessage: getObservationVisionUserMessage(error),
    }
  }

  return {
    code: 'unknown_error',
    message: String(error),
    userMessage: getObservationVisionUserMessage(error),
  }
}
