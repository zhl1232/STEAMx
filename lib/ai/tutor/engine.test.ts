/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import { logger } from '@/lib/logger'

const fetchMock = vi.fn()

function getRequest() {
  const request = fetchMock.mock.calls.at(-1)?.[1]
  return JSON.parse(String(request?.body)) as {
    model: string
    messages: Array<{ role: string; content: unknown }>
  }
}

describe('chatWithTutorComplete image context', () => {
  beforeEach(() => {
    process.env.DASHSCOPE_API_KEY = 'test-key'
    delete process.env.DASHSCOPE_TUTOR_TEXT_MODEL
    delete process.env.DASHSCOPE_TUTOR_VISION_MODEL
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '收到。' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps the latest image active for a follow-up message without a new upload', async () => {
    await chatWithTutorComplete('你是小迪。', [
      { role: 'user', content: '这道题怎么做？', images: ['data:image/png;base64,first'] },
      { role: 'assistant', content: '先观察题目中的关系。' },
      { role: 'user', content: '把图片里的题写出来' },
    ])

    const request = getRequest()
    expect(request.model).toBe('qwen3.7-plus')
    expect(request.messages[1]).toMatchObject({
      role: 'user',
      content: [
        { type: 'text', text: '这道题怎么做？' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,first' } },
      ],
    })
    expect(request.messages[3]).toEqual({ role: 'user', content: '把图片里的题写出来' })
  })

  it('replaces the active image when a newer user message includes an image', async () => {
    await chatWithTutorComplete('你是小迪。', [
      { role: 'user', content: '第一张图', images: ['https://example.com/first.png'] },
      { role: 'assistant', content: '我看到了。' },
      { role: 'user', content: '请看这张新的', images: ['https://example.com/second.png'] },
      { role: 'assistant', content: '好的。' },
      { role: 'user', content: '继续说说' },
    ])

    const request = getRequest()
    const imageParts = request.messages.flatMap((message) =>
      Array.isArray(message.content)
        ? message.content.filter(
            (part): part is { type: string; image_url: { url: string } } =>
              typeof part === 'object' && part !== null && 'image_url' in part,
          )
        : [],
    )
    expect(imageParts).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/second.png' } },
    ])
  })

  it('removes image parts and tells the model the image failed when falling back to text', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('vision unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '文本模式回复' } }] }),
      })

    const onVisionFallback = vi.fn()
    const onTelemetry = vi.fn()
    await chatWithTutorComplete(
      '你是小迪。',
      [
        { role: 'user', content: '请看图', images: ['https://example.com/first.png'] },
        { role: 'user', content: '图片里有什么？' },
      ],
      { onVisionFallback, onTelemetry },
    )

    const request = getRequest()
    expect(request.model).toBe('qwen-flash')
    // 降级后不能让模型假装看过图：注明图片加载失败
    expect(request.messages[1]).toEqual({
      role: 'user',
      content: '请看图（附了 1 张图片，但这次图片没能加载成功；请如实说明看不到图片，并请学生用文字补充关键信息）',
    })
    expect(onVisionFallback).toHaveBeenCalledTimes(1)
    expect(onTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ visionFallback: true, model: 'qwen-flash' }),
    )
  })

  it('reports model and token usage through onTelemetry', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '收到。' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
      }),
    })

    const onTelemetry = vi.fn()
    await chatWithTutorComplete('你是小迪。', [{ role: 'user', content: '你好' }], { onTelemetry })

    expect(onTelemetry).toHaveBeenCalledWith({
      model: 'qwen-flash',
      usage: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
      visionFallback: false,
    })
  })

  it('maps timeout aborts to a friendly tutor error', async () => {
    fetchMock.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'))

    await expect(
      chatWithTutorComplete('你是小迪。', [{ role: 'user', content: '你好' }]),
    ).rejects.toMatchObject({
      name: 'TutorEngineError',
      userMessage: '小迪响应超时，请稍后再试。',
      status: 504,
    })
  })

  it('does not fall back to the text model when a visual-only caller rejects fallback', async () => {
    fetchMock.mockRejectedValueOnce(new Error('vision unavailable'))

    await expect(
      chatWithTutorComplete(
        '只看图片。',
        [{ role: 'user', content: '请看图', images: ['https://example.com/first.png'] }],
        { allowVisionFallback: false },
      ),
    ).rejects.toThrow('vision unavailable')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
