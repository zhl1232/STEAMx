import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/ai/tutor/engine', () => ({
  chatWithTutorComplete: vi.fn(),
}))

import { chatWithTutorComplete } from '@/lib/ai/tutor/engine'
import { diagnoseScratchScreenshot, shouldDiagnoseScratchScreenshot } from '@/lib/ai/tutor/scratch-screenshot-diagnosis'

const input = {
  content: '我卡住了，帮我看看这张截图哪里不对。',
  images: ['https://example.com/scratch.png'],
  items: [
    { label: '当绿旗被点击', findLabel: '当绿旗被点击', category: 'events' as const },
    { label: '说 出发啦！', findLabel: '说 你好!', category: 'looks' as const, editHint: '把文字改成「出发啦！」' },
  ],
}

describe('Scratch screenshot diagnosis', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns a high-confidence candidate index and keeps the image request visual-only', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue(
      '{"conclusion":"highlight","confidence":"high","targetItemIndex":1}',
    )

    await expect(diagnoseScratchScreenshot(input)).resolves.toEqual({ targetItemIndex: 1 })
    expect(chatWithTutorComplete).toHaveBeenCalledWith(
      expect.stringContaining('只能从候选列表选择 targetItemIndex'),
      [
        {
          role: 'user',
          content: input.content,
          images: [input.images[0]],
        },
      ],
      { allowVisionFallback: false },
    )
  })

  it('rejects uncertain, malformed, and out-of-range model decisions', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValueOnce(
      '{"conclusion":"highlight","confidence":"medium","targetItemIndex":0}',
    )
    await expect(diagnoseScratchScreenshot(input)).resolves.toBeNull()

    vi.mocked(chatWithTutorComplete).mockResolvedValueOnce(
      '{"conclusion":"highlight","confidence":"high","targetItemIndex":9}',
    )
    await expect(diagnoseScratchScreenshot(input)).resolves.toBeNull()

    vi.mocked(chatWithTutorComplete).mockResolvedValueOnce('无法判断')
    await expect(diagnoseScratchScreenshot(input)).resolves.toBeNull()
  })

  it('returns no action when the visual model is unavailable', async () => {
    vi.mocked(chatWithTutorComplete).mockRejectedValueOnce(new Error('vision unavailable'))

    await expect(diagnoseScratchScreenshot(input)).resolves.toBeNull()
  })

  it('lets the visual model judge natural language instead of keyword-gating the request', async () => {
    vi.mocked(chatWithTutorComplete).mockResolvedValue('{"conclusion":"no_action"}')
    const ordinaryQuestion = {
      ...input,
      content: '我不太确定这里应该怎么继续，可以帮我看看吗？',
    }

    expect(
      shouldDiagnoseScratchScreenshot({
        ...ordinaryQuestion,
      }),
    ).toBe(true)

    await expect(
      diagnoseScratchScreenshot({
        ...ordinaryQuestion,
      }),
    ).resolves.toBeNull()
    expect(chatWithTutorComplete).toHaveBeenCalled()
  })

  it('only uses input availability as the deterministic eligibility check', () => {
    expect(
      shouldDiagnoseScratchScreenshot({
        ...input,
        images: [],
      }),
    ).toBe(false)
    expect(
      shouldDiagnoseScratchScreenshot({
        ...input,
        items: [],
      }),
    ).toBe(false)
  })
})
