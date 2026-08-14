import { logger } from '@/lib/logger'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_TUTOR_TEXT_MODEL = 'qwen-flash'
const DEFAULT_TUTOR_PLANNER_MODEL = 'qwen-flash'
const DEFAULT_VISION_MODEL = 'qwen3.7-plus'
const DEFAULT_MODERATION_MODEL = 'qwen3-vl-flash'
const DEFAULT_PBL_TEXT_MODEL = 'qwen3.7-plus'
/** 非流式调用（planner、审核、摘要等）默认超时 */
export const DASHSCOPE_COMPLETE_TIMEOUT_MS = 20_000
/** 流式主对话的总时长上限（连接 + 逐块输出） */
export const DASHSCOPE_STREAM_TIMEOUT_MS = 120_000

export type DashScopeModelRole =
  | 'tutor-text'
  | 'tutor-planner'
  | 'tutor-vision'
  | 'vision'
  | 'moderation'
  | 'pbl-text'
  | 'pbl-vision'

export type DashScopeErrorCode = 'missing_config' | 'timeout' | 'provider_http_error' | 'network'

export type DashScopeTokenUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export class DashScopeError extends Error {
  code: DashScopeErrorCode
  status?: number
  details?: unknown

  constructor({
    code,
    message,
    status,
    details,
  }: {
    code: DashScopeErrorCode
    message: string
    status?: number
    details?: unknown
  }) {
    super(message)
    this.name = 'DashScopeError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isDashScopeTimeoutError(error: unknown) {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function resolveModel(role: DashScopeModelRole) {
  switch (role) {
    case 'tutor-text':
      return (
        process.env.DASHSCOPE_TUTOR_TEXT_MODEL ||
        process.env.DASHSCOPE_TEXT_MODEL ||
        process.env.DASHSCOPE_FLASH_MODEL ||
        DEFAULT_TUTOR_TEXT_MODEL
      )
    case 'tutor-planner':
      return (
        process.env.DASHSCOPE_TUTOR_PLANNER_MODEL ||
        process.env.DASHSCOPE_FLASH_MODEL ||
        process.env.DASHSCOPE_TUTOR_TEXT_MODEL ||
        process.env.DASHSCOPE_TEXT_MODEL ||
        DEFAULT_TUTOR_PLANNER_MODEL
      )
    case 'tutor-vision':
      return process.env.DASHSCOPE_TUTOR_VISION_MODEL || process.env.DASHSCOPE_VISION_MODEL || DEFAULT_VISION_MODEL
    case 'vision':
    case 'pbl-vision':
      return process.env.DASHSCOPE_VISION_MODEL || DEFAULT_VISION_MODEL
    case 'moderation':
      return (
        process.env.DASHSCOPE_MODERATION_MODEL ||
        process.env.DASHSCOPE_VISION_MODEL ||
        DEFAULT_MODERATION_MODEL
      )
    case 'pbl-text':
      return process.env.DASHSCOPE_TEXT_MODEL || process.env.DASHSCOPE_VISION_MODEL || DEFAULT_PBL_TEXT_MODEL
  }
}

export function resolveDashScopeConfig(role: DashScopeModelRole) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = resolveModel(role)

  if (!apiKey) {
    throw new DashScopeError({
      code: 'missing_config',
      message: 'Missing DASHSCOPE_API_KEY',
    })
  }

  return { apiKey, baseUrl, model }
}

export function parseDashScopeContent(raw: unknown): string {
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

export function parseDashScopeUsage(raw: unknown): DashScopeTokenUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const usage = raw as {
    prompt_tokens?: unknown
    completion_tokens?: unknown
    total_tokens?: unknown
  }
  const pick = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
  const parsed: DashScopeTokenUsage = {
    promptTokens: pick(usage.prompt_tokens),
    completionTokens: pick(usage.completion_tokens),
    totalTokens: pick(usage.total_tokens),
  }
  return parsed.promptTokens == null && parsed.completionTokens == null && parsed.totalTokens == null
    ? null
    : parsed
}

function formatHttpErrorMessage(status: number, details: unknown) {
  if (details && typeof details === 'object' && 'error' in details) {
    try {
      return JSON.stringify((details as { error?: unknown }).error)
    } catch {
      // fall through
    }
  }
  return `DashScope request failed (${status})`
}

function logFailure(input: {
  role: DashScopeModelRole
  model?: string
  code: DashScopeErrorCode
  status?: number
  latencyMs: number
}) {
  logger.warn('DashScope request failed.', {
    role: input.role,
    model: input.model,
    code: input.code,
    status: input.status ?? null,
    latencyMs: input.latencyMs,
  })
}

/** 统一的 DashScope 请求出口：鉴权、超时、错误归一化。流式调用拿 Response，非流式用 dashScopeChatComplete。 */
export async function dashScopeChatCompletions(input: {
  role: DashScopeModelRole
  timeoutMs: number
  payload: Record<string, unknown>
}): Promise<{ response: Response; model: string }> {
  const startedAt = Date.now()
  let apiKey: string
  let baseUrl: string
  let model: string
  try {
    ;({ apiKey, baseUrl, model } = resolveDashScopeConfig(input.role))
  } catch (error) {
    if (error instanceof DashScopeError && error.code === 'missing_config') {
      logFailure({ role: input.role, code: 'missing_config', latencyMs: Date.now() - startedAt })
    }
    throw error
  }

  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, ...input.payload }),
      signal: AbortSignal.timeout(input.timeoutMs),
    })
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    if (isDashScopeTimeoutError(error)) {
      logFailure({ role: input.role, model, code: 'timeout', status: 504, latencyMs })
      throw new DashScopeError({
        code: 'timeout',
        message: 'DashScope request timed out',
        status: 504,
      })
    }
    logFailure({ role: input.role, model, code: 'network', latencyMs })
    throw new DashScopeError({
      code: 'network',
      message: error instanceof Error ? error.message : 'DashScope network error',
    })
  }

  if (!response.ok) {
    const details = await response.json().catch(() => null)
    logFailure({
      role: input.role,
      model,
      code: 'provider_http_error',
      status: response.status,
      latencyMs: Date.now() - startedAt,
    })
    throw new DashScopeError({
      code: 'provider_http_error',
      message: formatHttpErrorMessage(response.status, details),
      status: response.status,
      details,
    })
  }

  return { response, model }
}

export async function dashScopeChatComplete(input: {
  role: DashScopeModelRole
  timeoutMs?: number
  payload: Record<string, unknown>
}): Promise<{
  text: string
  model: string
  usage: DashScopeTokenUsage | null
  raw: unknown
}> {
  const { response, model } = await dashScopeChatCompletions({
    role: input.role,
    timeoutMs: input.timeoutMs ?? DASHSCOPE_COMPLETE_TIMEOUT_MS,
    payload: input.payload,
  })

  const raw = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>
    usage?: unknown
  } | null

  return {
    text: parseDashScopeContent(raw?.choices?.[0]?.message?.content).trim(),
    model,
    usage: parseDashScopeUsage(raw?.usage),
    raw,
  }
}
