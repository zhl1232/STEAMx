/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DashScopeError,
  dashScopeChatComplete,
  resetDashScopeModelState,
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
  'DASHSCOPE_MODEL_AUTO_SWITCH',
  'DASHSCOPE_MODEL_DISCOVERY',
  'DASHSCOPE_TUTOR_TEXT_MODELS',
  'DASHSCOPE_TUTOR_PLANNER_MODELS',
  'DASHSCOPE_TUTOR_VISION_MODELS',
  'DASHSCOPE_VISION_MODELS',
  'DASHSCOPE_MODERATION_MODELS',
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
    process.env.DASHSCOPE_MODEL_DISCOVERY = 'false'
    resetDashScopeModelState()
  })

  afterEach(() => {
    resetDashScopeModelState()
    clearModelEnv()
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('uses the automatic role priorities by default', () => {
    expect(resolveDashScopeConfig('tutor-text').model).toBe('qwen3.8-max')
    expect(resolveDashScopeConfig('tutor-planner').model).toBe('qwen-flash')
    expect(resolveDashScopeConfig('tutor-vision').model).toBe('qwen3.7-plus')
    expect(resolveDashScopeConfig('vision').model).toBe('qwen3.7-plus')
    expect(resolveDashScopeConfig('moderation').model).toBe('qwen3-vl-flash')
    expect(resolveDashScopeConfig('pbl-text').model).toBe('qwen3.8-max')
    expect(resolveDashScopeConfig('pbl-vision').model).toBe('qwen3.7-plus')
  })

  it('keeps the legacy single-model env chain when auto switch is disabled', () => {
    process.env.DASHSCOPE_MODEL_AUTO_SWITCH = 'false'
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

  it('accepts an explicit ordered model list', () => {
    process.env.DASHSCOPE_TUTOR_TEXT_MODELS = 'qwen3.7-plus, qwen3.8-max'
    expect(resolveDashScopeConfig('tutor-text').model).toBe('qwen3.7-plus')
  })

  it('falls back from moderation to the shared vision model', () => {
    process.env.DASHSCOPE_MODEL_AUTO_SWITCH = 'false'
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
    process.env.DASHSCOPE_MODEL_DISCOVERY = 'false'
    resetDashScopeModelState()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetDashScopeModelState()
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
      model: 'qwen3.8-max',
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

  it('discovers visible models and switches after a quota error', async () => {
    process.env.DASHSCOPE_MODEL_DISCOVERY = 'true'
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'qwen3.8-max' }, { id: 'qwen3.7-plus' }] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'FreeTierLimitExceeded', message: 'quota exhausted' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '已切换。' } }] }),
      })

    await expect(
      dashScopeChatComplete({
        role: 'tutor-text',
        payload: { messages: [{ role: 'user', content: '继续' }] },
      }),
    ).resolves.toMatchObject({ text: '已切换。', model: 'qwen3.7-plus' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ model: 'qwen3.8-max' })
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ model: 'qwen3.7-plus' })
  })
})
