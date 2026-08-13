/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  analyzeObservationImageWithQwen,
  getObservationVisionUserMessage,
  ObservationVisionError,
  serializeObservationVisionError,
} from '@/lib/ai/qwen-vision'
import { DashScopeError } from '@/lib/ai/dashscope'
import { logger } from '@/lib/logger'
import type { Database } from '@/lib/supabase/types'

type SpeciesRow = Database['public']['Tables']['species']['Row']

const originalDashScopeApiKey = process.env.DASHSCOPE_API_KEY
const speciesRows: SpeciesRow[] = []

afterEach(() => {
  process.env.DASHSCOPE_API_KEY = originalDashScopeApiKey
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('analyzeObservationImageWithQwen', () => {
  it('reports a missing DashScope key as a configuration error', async () => {
    delete process.env.DASHSCOPE_API_KEY
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)

    await expect(analyzeObservationImageWithQwen('https://example.com/bird.jpg', speciesRows)).rejects.toMatchObject({
      code: 'missing_config',
      userMessage: '服务端未配置视觉识别密钥，请检查线上环境变量。',
    })
  })

  it('wraps upstream HTTP failures with a user-facing reason and raw details', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 'InvalidApiKey',
            message: 'Invalid API-key provided.',
          },
        }),
      }),
    )

    await expect(analyzeObservationImageWithQwen('https://example.com/bird.jpg', speciesRows)).rejects.toMatchObject({
      code: 'provider_http_error',
      status: 401,
      userMessage: '视觉识别服务返回错误（401），请检查模型、密钥或上游额度。',
    })
  })

  it('maps DashScope timeouts to an observation vision error', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
    )

    await expect(analyzeObservationImageWithQwen('https://example.com/bird.jpg', speciesRows)).rejects.toMatchObject({
      name: 'ObservationVisionError',
      code: 'timeout',
      status: 504,
      userMessage: '视觉识别服务响应超时，请稍后重试。',
    })
  })
})

describe('ObservationVisionError helpers', () => {
  it('serializes safe details for persisted analysis failures', () => {
    const error = new ObservationVisionError({
      code: 'provider_empty_response',
      message: 'empty response',
      userMessage: '视觉识别服务返回空结果，请稍后重试。',
      details: { requestId: 'req_123' },
    })

    expect(getObservationVisionUserMessage(error)).toBe('视觉识别服务返回空结果，请稍后重试。')
    expect(serializeObservationVisionError(error)).toMatchObject({
      code: 'provider_empty_response',
      message: 'empty response',
      userMessage: '视觉识别服务返回空结果，请稍后重试。',
      status: null,
      details: { requestId: 'req_123' },
    })
  })

  it('maps an unwrapped DashScope timeout to a retry message', () => {
    const error = new DashScopeError({
      code: 'timeout',
      message: 'DashScope request timed out',
      status: 504,
    })
    expect(getObservationVisionUserMessage(error)).toBe('视觉识别服务响应超时，请稍后重试。')
  })
})
