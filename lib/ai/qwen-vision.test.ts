/** @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  analyzeObservationImageWithQwen,
  getObservationVisionUserMessage,
  ObservationVisionError,
  serializeObservationVisionError,
} from '@/lib/ai/qwen-vision'
import type { Database } from '@/lib/supabase/types'

type SpeciesRow = Database['public']['Tables']['species']['Row']

const originalDashScopeApiKey = process.env.DASHSCOPE_API_KEY
const speciesRows: SpeciesRow[] = []

afterEach(() => {
  process.env.DASHSCOPE_API_KEY = originalDashScopeApiKey
  vi.unstubAllGlobals()
})

describe('analyzeObservationImageWithQwen', () => {
  it('reports a missing DashScope key as a configuration error', async () => {
    delete process.env.DASHSCOPE_API_KEY

    await expect(analyzeObservationImageWithQwen('https://example.com/bird.jpg', speciesRows)).rejects.toMatchObject({
      code: 'missing_config',
      userMessage: '服务端未配置视觉识别密钥，请检查线上环境变量。',
    })
  })

  it('wraps upstream HTTP failures with a user-facing reason and raw details', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
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
})
