/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DashScopeError,
  dashScopeChatComplete,
  resolveDashScopeConfig,
} from '@/lib/ai/dashscope'
import { logger } from '@/lib/logger'

const fetchMock = vi.fn()
const MODEL_ENV_KEYS = [
  'DASHSCOPE_API_KEY',
  'DASHSCOPE_BASE_URL',
  'DASHSCOPE_TUTOR_TEXT_MODEL',
  'DASHSCOPE_TUTOR_PLANNER_MODEL',
  'DASHSCOPE_TUTOR_VISION_MODEL',
  'DASHSCOPE_TEXT_MODEL',
  'DASHSCOPE_VISION_MODEL',
  'DASHSCOPE_MODERATION_MODEL',
  'DASHSCOPE_FLASH_MODEL',
] as const

const originalEnv = Object.fromEntries(MODEL_ENV_KEYS.map((key) => [key, process.env[key]]))

function clearModelEnv() {
  for (const key of MODEL_ENV_KEYS) {
    delete process.env[key]
  }
}

describe('resolveDashScopeConfig', () => {
  beforeEach(() => {
    clearModelEnv()
    process.env.DASHSCOPE_API_KEY = 'test-key'
  })

  afterEach(() => {
    clearModelEnv()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('keeps each role on its existing default model chain', () => {
    expect(resolveDashScopeConfig('tutor-text').model).toBe('qwen-flash')
    expect(resolveDashScopeConfig('tutor-planner').model).toBe('qwen-flash')
    expect(resolveDashScopeConfig('tutor-vision').model).toBe('qwen3.7-plus')
    expect(resolveDashScopeConfig('vision').model).toBe('qwen3.7-plus')
    expect(resolveDashScopeConfig('moderation').model).toBe('qwen3-vl-flash')
    expect(resolveDashScopeConfig('pbl-text').model).toBe('qwen3.7-plus')
    expect(resolveDashScopeConfig('pbl-vision').model).toBe('qwen3.7-plus')
  })

  it('prefers tutor env overrides before shared fallbacks', () => {
    process.env.DASHSCOPE_TUTOR_TEXT_MODEL = 'tutor-text-override'
    process.env.DASHSCOPE_TEXT_MODEL = 'shared-text'
    process.env.DASHSCOPE_FLASH_MODEL = 'flash-override'
    process.env.DASHSCOPE_TUTOR_PLANNER_MODEL = 'planner-override'
    process.env.DASHSCOPE_TUTOR_VISION_MODEL = 'tutor-vision-override'
    process.env.DASHSCOPE_VISION_MODEL = 'shared-vision'
    process.env.DASHSCOPE_MODERATION_MODEL = 'moderation-override'

    expect(resolveDashScopeConfig('tutor-text').model).toBe('tutor-text-override')
    expect(resolveDashScopeConfig('tutor-planner').model).toBe('planner-override')
    expect(resolveDashScopeConfig('tutor-vision').model).toBe('tutor-vision-override')
    expect(resolveDashScopeConfig('vision').model).toBe('shared-vision')
    expect(resolveDashScopeConfig('moderation').model).toBe('moderation-override')
    expect(resolveDashScopeConfig('pbl-text').model).toBe('shared-text')
  })

  it('falls back from moderation to the shared vision model', () => {
    process.env.DASHSCOPE_VISION_MODEL = 'shared-vision'
    expect(resolveDashScopeConfig('moderation').model).toBe('shared-vision')
  })

  it('throws missing_config without an API key', () => {
    delete process.env.DASHSCOPE_API_KEY
    expect(() => resolveDashScopeConfig('vision')).toThrow(DashScopeError)
    try {
      resolveDashScopeConfig('vision')
    } catch (error) {
      expect(error).toMatchObject({ code: 'missing_config' })
    }
  })
})

describe('dashScopeChatComplete', () => {
  beforeEach(() => {
    clearModelEnv()
    process.env.DASHSCOPE_API_KEY = 'test-key'
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    clearModelEnv()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('parses text and token usage from a successful response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '收到。' } }],
        usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
      }),
    })

    await expect(
      dashScopeChatComplete({
        role: 'tutor-text',
        payload: { messages: [{ role: 'user', content: '你好' }] },
      }),
    ).resolves.toMatchObject({
      text: '收到。',
      model: 'qwen-flash',
      usage: { promptTokens: 12, completionTokens: 4, totalTokens: 16 },
    })
  })

  it('maps timeout aborts to a 504 DashScopeError', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))

    await expect(
      dashScopeChatComplete({
        role: 'vision',
        payload: { messages: [{ role: 'user', content: '审核' }] },
      }),
    ).rejects.toMatchObject({
      name: 'DashScopeError',
      code: 'timeout',
      status: 504,
    })
  })

  it('keeps HTTP error details for callers', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: 'InvalidApiKey',
          message: 'Invalid API-key provided.',
        },
      }),
    })

    await expect(
      dashScopeChatComplete({
        role: 'vision',
        payload: { messages: [{ role: 'user', content: '审核' }] },
      }),
    ).rejects.toMatchObject({
      code: 'provider_http_error',
      status: 401,
      details: {
        error: {
          code: 'InvalidApiKey',
          message: 'Invalid API-key provided.',
        },
      },
    })
  })
})
