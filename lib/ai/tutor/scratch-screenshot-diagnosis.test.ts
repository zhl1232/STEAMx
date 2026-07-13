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

  it('does not call the visual model without an explicit screenshot review request', async () => {
    expect(
      shouldDiagnoseScratchScreenshot({
        ...input,
        content: '重复执行积木有什么作用？',
      }),
    ).toBe(false)

    await expect(
      diagnoseScratchScreenshot({
        ...input,
        content: '重复执行积木有什么作用？',
      }),
    ).resolves.toBeNull()
    expect(chatWithTutorComplete).not.toHaveBeenCalled()
  })

  it('does not mistake ordinary questions containing “多少” for screenshot review requests', () => {
    expect(
      shouldDiagnoseScratchScreenshot({
        ...input,
        content: '这个课程有多少个步骤？',
      }),
    ).toBe(false)
  })
})
