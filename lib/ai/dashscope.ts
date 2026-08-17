import { logger } from '@/lib/logger'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const DEFAULT_TUTOR_TEXT_MODEL = 'qwen-flash'
const DEFAULT_TUTOR_PLANNER_MODEL = 'qwen-flash'
const DEFAULT_VISION_MODEL = 'qwen3.7-plus'
const DEFAULT_MODERATION_MODEL = 'qwen3-vl-flash'
const DEFAULT_PBL_TEXT_MODEL = 'qwen3.7-plus'
const MODEL_DISCOVERY_TIMEOUT_MS = 3_000
const MODEL_DISCOVERY_TTL_MS = 5 * 60 * 1_000
const MODEL_DISCOVERY_FAILURE_TTL_MS = 60 * 1_000
const MODEL_UNAVAILABLE_COOLDOWN_MS = 5 * 60 * 1_000

const DEFAULT_MODEL_CANDIDATES = {
  'tutor-text': ['qwen3.8-max', 'qwen3.7-max', 'qwen3.7-plus', 'qwen3.7-flash', 'qwen-flash'],
  'tutor-planner': ['qwen-flash', 'qwen3.7-flash', 'qwen3.7-plus', 'qwen3.8-max'],
  'tutor-vision': ['qwen3.7-plus', 'qwen3-vl-flash', 'qwen3.7-max'],
  vision: ['qwen3.7-plus', 'qwen3-vl-flash', 'qwen3.7-max'],
  moderation: ['qwen3-vl-flash', 'qwen3.7-plus'],
  'pbl-text': ['qwen3.8-max', 'qwen3.7-plus', 'qwen3.7-flash', 'qwen-flash'],
  'pbl-vision': ['qwen3.7-plus', 'qwen3-vl-flash'],
  'tutor-tts': ['qwen3-tts-flash', 'qwen3-tts-flash-2025-11-27'],
  'tutor-tts-realtime': ['qwen3-tts-flash-realtime', 'qwen3-tts-flash-realtime-2025-11-27'],
  'tutor-asr': ['qwen3-asr-flash-realtime', 'qwen3-asr-flash-realtime-2025-10-27'],
} as const

type ModelCatalogState = {
  apiKey: string
  baseUrl: string
  models: Set<string> | null
  expiresAt: number
}

let modelCatalogState: ModelCatalogState | null = null
let modelCatalogPromise: Promise<Set<string> | null> | null = null
const unavailableModels = new Map<string, number>()
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
  | 'tutor-tts'
  | 'tutor-tts-realtime'
  | 'tutor-asr'

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
    case 'tutor-tts':
      return process.env.DASHSCOPE_TUTOR_TTS_MODEL || 'qwen3-tts-flash'
    case 'tutor-tts-realtime':
      return process.env.DASHSCOPE_TUTOR_TTS_REALTIME_MODEL || 'qwen3-tts-flash-realtime'
    case 'tutor-asr':
      return process.env.DASHSCOPE_TUTOR_ASR_MODEL || 'qwen3-asr-flash-realtime'
  }
}

function parseModelList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

function modelListEnvKeys(role: DashScopeModelRole) {
  switch (role) {
    case 'tutor-text':
      return ['DASHSCOPE_TUTOR_TEXT_MODELS', 'DASHSCOPE_TEXT_MODELS']
    case 'tutor-planner':
      return ['DASHSCOPE_TUTOR_PLANNER_MODELS', 'DASHSCOPE_TEXT_MODELS']
    case 'tutor-vision':
      return ['DASHSCOPE_TUTOR_VISION_MODELS', 'DASHSCOPE_VISION_MODELS']
    case 'vision':
    case 'pbl-vision':
      return ['DASHSCOPE_VISION_MODELS']
    case 'moderation':
      return ['DASHSCOPE_MODERATION_MODELS', 'DASHSCOPE_VISION_MODELS']
    case 'pbl-text':
      return ['DASHSCOPE_TEXT_MODELS']
    case 'tutor-tts':
      return ['DASHSCOPE_TUTOR_TTS_MODELS', 'DASHSCOPE_TTS_MODELS']
    case 'tutor-tts-realtime':
      return ['DASHSCOPE_TUTOR_TTS_REALTIME_MODELS', 'DASHSCOPE_TTS_REALTIME_MODELS']
    case 'tutor-asr':
      return ['DASHSCOPE_TUTOR_ASR_MODELS', 'DASHSCOPE_ASR_MODELS']
  }
}

function isModelAutoSwitchEnabled() {
  return process.env.DASHSCOPE_MODEL_AUTO_SWITCH !== 'false'
}

function isModelDiscoveryEnabled() {
  return process.env.DASHSCOPE_MODEL_DISCOVERY !== 'false'
}

function uniqueModels(models: string[]) {
  return [...new Set(models)]
}

function getConfiguredModelCandidates(role: DashScopeModelRole) {
  const legacyModel = resolveModel(role)
  if (!isModelAutoSwitchEnabled()) return [legacyModel]

  const configuredModels = modelListEnvKeys(role).flatMap((key) => parseModelList(process.env[key]))
  return uniqueModels([
    ...configuredModels,
    ...DEFAULT_MODEL_CANDIDATES[role],
    legacyModel,
  ])
}

function modelAvailabilityKey(role: DashScopeModelRole, model: string) {
  return `${role}:${model}`
}

function filterUnavailableModels(role: DashScopeModelRole, models: string[]) {
  const now = Date.now()
  const available = models.filter((model) => {
    const unavailableUntil = unavailableModels.get(modelAvailabilityKey(role, model))
    if (unavailableUntil == null) return true
    if (unavailableUntil <= now) {
      unavailableModels.delete(modelAvailabilityKey(role, model))
      return true
    }
    return false
  })

  // All candidates may be cooling down after a provider-wide incident. Probe the
  // preferred one again instead of turning the whole application off for five minutes.
  return available.length > 0 ? available : models.slice(0, 1)
}

async function loadModelCatalog(apiKey: string, baseUrl: string): Promise<Set<string> | null> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(MODEL_DISCOVERY_TIMEOUT_MS),
    })
    if (!response.ok) return null

    const raw = (await response.json().catch(() => null)) as {
      data?: Array<{ id?: unknown }>
    } | null
    const models = new Set(
      (raw?.data ?? [])
        .map((item) => (typeof item?.id === 'string' ? item.id.trim() : ''))
        .filter(Boolean),
    )
    return models.size > 0 ? models : null
  } catch {
    return null
  }
}

async function getModelCatalog(apiKey: string, baseUrl: string) {
  const now = Date.now()
  if (
    modelCatalogState &&
    modelCatalogState.apiKey === apiKey &&
    modelCatalogState.baseUrl === baseUrl &&
    modelCatalogState.expiresAt > now
  ) {
    return modelCatalogState.models
  }

  if (!modelCatalogPromise) {
    modelCatalogPromise = loadModelCatalog(apiKey, baseUrl).then((models) => {
      modelCatalogState = {
        apiKey,
        baseUrl,
        models,
        expiresAt: Date.now() + (models ? MODEL_DISCOVERY_TTL_MS : MODEL_DISCOVERY_FAILURE_TTL_MS),
      }
      return models
    }).finally(() => {
      modelCatalogPromise = null
    })
  }

  return modelCatalogPromise
}

export async function getDashScopeModelCandidates(role: DashScopeModelRole): Promise<string[]> {
  const configuredModels = getConfiguredModelCandidates(role)
  if (!isModelDiscoveryEnabled() || !isModelAutoSwitchEnabled()) {
    return filterUnavailableModels(role, configuredModels)
  }

  const { apiKey, baseUrl } = resolveDashScopeConfig(role)
  const catalog = await getModelCatalog(apiKey, baseUrl)
  const visibleModels = catalog ? configuredModels.filter((model) => catalog.has(model)) : configuredModels
  return filterUnavailableModels(role, visibleModels.length > 0 ? visibleModels : configuredModels)
}

export function markDashScopeModelUnavailable(role: DashScopeModelRole, model: string) {
  unavailableModels.set(modelAvailabilityKey(role, model), Date.now() + MODEL_UNAVAILABLE_COOLDOWN_MS)
}

function providerErrorText(details: unknown) {
  try {
    return typeof details === 'string' ? details : JSON.stringify(details) || ''
  } catch {
    return ''
  }
}

export function isDashScopeModelAvailabilityError(status: number, details?: unknown) {
  if ([403, 404, 408, 409, 429, 500, 502, 503, 504].includes(status)) return true
  if (status !== 400) return false
  return /model|quota|rate.?limit|throttl|unavailable|not.?found|capacity|free.?tier|exhaust|exceed|arrearage|insufficient|resource/i.test(
    providerErrorText(details),
  )
}

export function resetDashScopeModelState() {
  modelCatalogState = null
  modelCatalogPromise = null
  unavailableModels.clear()
}

export function resolveDashScopeConfig(role: DashScopeModelRole) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  const model = getConfiguredModelCandidates(role)[0]

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

  const models = await getDashScopeModelCandidates(input.role)
  let lastError: DashScopeError | null = null

  for (const candidate of models) {
    model = candidate
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

    if (response.ok) {
      if (candidate !== models[0]) {
        logger.warn('DashScope model fallback succeeded.', {
          role: input.role,
          model: candidate,
          skippedModels: models.slice(0, models.indexOf(candidate)),
        })
      }
      return { response, model }
    }

    const details = await response.json().catch(() => null)
    logFailure({
      role: input.role,
      model,
      code: 'provider_http_error',
      status: response.status,
      latencyMs: Date.now() - startedAt,
    })
    const error = new DashScopeError({
      code: 'provider_http_error',
      message: formatHttpErrorMessage(response.status, details),
      status: response.status,
      details,
    })
    lastError = error

    if (!isDashScopeModelAvailabilityError(response.status, details)) throw error
    markDashScopeModelUnavailable(input.role, model)
  }

  throw lastError ?? new DashScopeError({
    code: 'provider_http_error',
    message: 'No DashScope model candidate is available',
    status: 503,
  })
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
