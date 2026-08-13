import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/tutor/engine', () => ({
  chatWithTutorComplete: vi.fn(),
}))

vi.mock('@/lib/ai/completion-proof-vision', () => ({
  analyzeCompletionProofImageWithQwen: vi.fn(),
}))

vi.mock('@/lib/ai/qwen-vision', () => ({
  getObservationVisionUserMessage: vi.fn(() => '审核服务暂时不可用'),
}))

import { analyzeCompletionProofImageWithQwen } from '@/lib/ai/completion-proof-vision'
import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import { evaluateCompletionContent } from '@/lib/ai/completion-moderation'

describe('evaluateCompletionContent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(analyzeCompletionProofImageWithQwen).mockResolvedValue({
      moderationPass: true,
      moderationReason: null,
      modelName: 'vision-test',
      rawResponse: null,
    })
  })

  it('uses the language model for semantic notes moderation', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"moderation_pass":true,"moderation_reason":null}',
    )

    await expect(
      evaluateCompletionContent({ notes: '我比较了不同结构的承重表现。', imageUrls: ['image://proof'] }),
    ).resolves.toMatchObject({ pass: true })
    expect(vi.mocked(chatWithTutorComplete).mock.calls[0]?.[0]).toContain('不要用固定关键词或正则表达式判断')
  })

  it('sends the full accepted notes length as untrusted content', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"moderation_pass":true,"moderation_reason":null}',
    )
    const notes = `${'a'.repeat(4_500)}结尾内容`

    await evaluateCompletionContent({ notes, imageUrls: ['image://proof'] })

    const userMessage = vi.mocked(chatWithTutorComplete).mock.calls[0]?.[1]?.[0]
    expect(userMessage?.content).toContain('结尾内容')
    expect(userMessage?.content).toContain('待审核作品说明开始')
    expect(userMessage?.content).toContain('待审核作品说明结束')
  })

  it('honors the model decision instead of matching a sensitive-word list', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"moderation_pass":false,"moderation_reason":"包含不适宜内容"}',
    )

    await expect(
      evaluateCompletionContent({ notes: '这段文字需要结合上下文判断。', imageUrls: ['image://proof'] }),
    ).resolves.toMatchObject({ pass: false, reason: '包含不适宜内容' })
    expect(analyzeCompletionProofImageWithQwen).not.toHaveBeenCalled()
  })

  it('queues the completion when semantic text moderation is unavailable', async () => {
    vi.mocked(chatWithTutorComplete).mockRejectedValue(new Error('planner unavailable'))

    await expect(
      evaluateCompletionContent({ notes: '一段作品说明', imageUrls: ['image://proof'] }),
    ).resolves.toMatchObject({ pass: false, pending: true })
    expect(analyzeCompletionProofImageWithQwen).not.toHaveBeenCalled()
  })

  it('skips image vision when submit already approved the images', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"moderation_pass":true,"moderation_reason":null}',
    )

    await expect(
      evaluateCompletionContent({
        notes: '我比较了不同结构的承重表现。',
        imageUrls: ['image://one', 'image://two'],
        skipImageModeration: true,
      }),
    ).resolves.toMatchObject({
      pass: true,
      imageResults: [
        { imageUrl: 'image://one', moderationPass: true },
        { imageUrl: 'image://two', moderationPass: true },
      ],
    })
    expect(analyzeCompletionProofImageWithQwen).not.toHaveBeenCalled()
  })

  it('inspects remaining images in parallel', async () => {
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    vi.mocked(analyzeCompletionProofImageWithQwen).mockImplementation(async (imageUrl) => {
      if (imageUrl === 'image://one') await firstGate
      return {
        moderationPass: true,
        moderationReason: null,
        modelName: 'vision-test',
        rawResponse: null,
      }
    })

    const pending = evaluateCompletionContent({
      notes: null,
      imageUrls: ['image://one', 'image://two'],
    })

    await vi.waitFor(() => {
      expect(analyzeCompletionProofImageWithQwen).toHaveBeenCalledTimes(2)
    })
    releaseFirst?.()
    await expect(pending).resolves.toMatchObject({ pass: true })
  })
})
