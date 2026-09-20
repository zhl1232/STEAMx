/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chatWithTutorComplete, streamChatWithTutor, summarizeNotebook } from '@/lib/ai/tutor/engine'
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

  it('cleans stored assistant reasoning before truncating a memory transcript', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({
      choices: [{ message: { content: '<think>摘要分析</think>学生喜欢实验。' } }],
    }) })
    const summary = await summarizeNotebook('', [
      { role: 'assistant', content: `<think>${'内部分析'.repeat(100)}</think>可以观察气泡。` },
    ])
    expect(getRequest().messages[1].content).toContain('小迪：可以观察气泡。')
    expect(getRequest().messages[1].content).not.toContain('内部分析')
    expect(summary).toBe('学生喜欢实验。')
  })

  it('returns an explicit failed summary instead of an old summary that could advance the cursor', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'))
    expect(await summarizeNotebook('旧笔记', [{ role: 'user', content: '新信息' }])).toBeNull()
  })

  it.each([
    'data: {"choices":[{"delta":{"content":"只有一半"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"被阻止"},"finish_reason":"content_filter"}]}\n\ndata: [DONE]\n\n',
  ])('rejects incomplete or rejected streams without delivering partial text', async (body) => {
    fetchMock.mockResolvedValue(new Response(body))
    const output: string[] = []
    await expect((async () => {
      for await (const chunk of streamChatWithTutor('prompt', [{ role: 'user', content: '你好' }])) output.push(chunk)
    })()).rejects.toThrow('Incomplete tutor stream')
    expect(output).toEqual([])
  })

  it('accepts an explicit stop finish reason without a DONE marker', async () => {
    fetchMock.mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"完整回复"},"finish_reason":"stop"}]}'))
    const output: string[] = []
    for await (const chunk of streamChatWithTutor('prompt', [{ role: 'user', content: '你好' }])) output.push(chunk)
    expect(output).toEqual(['完整回复'])
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
    expect(request.model).toBe('qwen3.8-max')
    // 降级后不能让模型假装看过图：注明图片加载失败
    expect(request.messages[1]).toEqual({
      role: 'user',
      content: '请看图（附了 1 张图片，但这次图片没能加载成功；请如实说明看不到图片，并请学生用文字补充关键信息）',
    })
    expect(onVisionFallback).toHaveBeenCalledTimes(1)
    expect(onTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ visionFallback: true, model: 'qwen3.8-max' }),
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
      model: 'qwen3.8-max',
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

  it('sanitizes reasoning from a complete response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '<think>内部推理</think>对用户的回复' } }] }),
    })

    await expect(chatWithTutorComplete('你是小迪。', [{ role: 'user', content: '你好' }])).resolves.toBe(
      '对用户的回复',
    )
  })

  it.each(['<think>只有内部推理</think>', '<think>未结束内部推理'])('rejects reasoning-only replies: %s', async (content) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })
    await expect(chatWithTutorComplete('你是小迪。', [{ role: 'user', content: '你好' }])).rejects.toMatchObject({
      userMessage: '小迪没有给出内容，请换个说法再试。',
    })
    fetchMock.mockResolvedValue({ ok: true, body: new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: 'stop' }] })}\n\n`))
      controller.close()
    } }) })
    const generator = streamChatWithTutor('你是小迪。', [{ role: 'user', content: '你好' }])
    await expect(generator.next()).rejects.toMatchObject({ userMessage: '小迪没有给出内容，请换个说法再试。' })
  })

  it('buffers and sanitizes reasoning split across stream chunks', async () => {
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: '内部推理' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '<thin' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'k>不要泄漏' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: '</think>对用户的回复' } }] })}\n\n`,
      'data: [DONE]\n\n',
    ]
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    })
    fetchMock.mockResolvedValue({ ok: true, body: stream })

    const output: string[] = []
    const onTelemetry = vi.fn()
    for await (const chunk of streamChatWithTutor('你是小迪。', [{ role: 'user', content: '你好' }], { onTelemetry })) {
      output.push(chunk)
    }

    expect(output).toEqual(['对用户的回复'])
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({ outputSanitized: true }))
  })

  it('captures final usage without a trailing newline and applies the reserved token budget', async () => {
    const content = 'data: {"choices":[{"delta":{"content":"你好"},"finish_reason":"length"}]}\n\n' +
      'data: {"choices":[],"usage":{"prompt_tokens":9000,"completion_tokens":125,"completion_tokens_details":{"reasoning_tokens":25}}}'
    const bytes = new TextEncoder().encode(content)
    fetchMock.mockResolvedValue({ ok: true, body: new ReadableStream({ start(controller) {
      // Split UTF-8/SSE data across chunks like the actual upstream transport.
      controller.enqueue(bytes.slice(0, 43))
      controller.enqueue(bytes.slice(43))
      controller.close()
    } }) })
    const onTelemetry = vi.fn()
    const output: string[] = []
    for await (const chunk of streamChatWithTutor('prompt', [{ role: 'user', content: '你好' }], { maxTokens: 125, onTelemetry })) output.push(chunk)
    expect(output).toEqual(['你好'])
    expect(getRequest()).toMatchObject({ max_tokens: 125, stream_options: { include_usage: true } })
    expect(onTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      usage: expect.objectContaining({ completionTokens: 125, reasoningTokens: 25 }), finishReason: 'length',
    }))
  })
})
