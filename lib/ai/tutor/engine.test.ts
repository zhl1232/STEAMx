/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'

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
  })

  afterEach(() => {
    delete process.env.DASHSCOPE_API_KEY
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

  it('removes image parts when falling back to the text model', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('vision unavailable'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '文本模式回复' } }] }),
      })

    await chatWithTutorComplete('你是小迪。', [
      { role: 'user', content: '请看图', images: ['https://example.com/first.png'] },
      { role: 'user', content: '图片里有什么？' },
    ])

    const request = getRequest()
    expect(request.model).toBe('qwen-flash')
    expect(request.messages[1]).toEqual({ role: 'user', content: '请看图（附了 1 张图片）' })
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
