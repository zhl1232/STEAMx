import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Work } from '@/lib/mappers/types'

import { ShareWorkDialog } from './share-work-dialog'

const mocks = vi.hoisted(() => ({
  domToBlob: vi.fn(),
  waitUntilLoad: vi.fn(),
  toast: vi.fn(),
}))

vi.mock('modern-screenshot', () => ({
  domToBlob: mocks.domToBlob,
  waitUntilLoad: mocks.waitUntilLoad,
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

const work: Work = {
  id: 42,
  userId: 'user-1',
  projectId: 7,
  author: '小明',
  completedAt: '刚刚',
  proofImages: ['https://example.com/work.webp'],
  notes: '这是我的第一次结构搭建作品。',
  isPublic: true,
  likes: 3,
  coins: 1,
  status: 'approved',
  recordKind: 'final',
  source: {
    type: 'project',
    id: 7,
    title: '会跑的小车',
    href: '/project/7',
  },
}

describe('ShareWorkDialog', () => {
  const createObjectURL = vi.fn(() => 'blob:poster-preview')
  const revokeObjectURL = vi.fn()
  const writeText = vi.fn()

  beforeEach(() => {
    mocks.domToBlob.mockResolvedValue(new Blob(['poster'], { type: 'image/png' }))
    mocks.waitUntilLoad.mockResolvedValue(undefined)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('generates a high-resolution poster with the canonical work QR code', async () => {
    render(<ShareWorkDialog work={work} open onOpenChange={vi.fn()} />)

    await waitFor(() => expect(mocks.domToBlob).toHaveBeenCalledTimes(1))
    expect(mocks.domToBlob).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ width: 375, height: 500, scale: 2 }),
    )
    expect(screen.getByTitle('作品链接二维码')).toBeInTheDocument()
    expect(screen.getByAltText('分享卡片预览')).toHaveAttribute('src', 'blob:poster-preview')
  })

  it('copies the canonical work link', async () => {
    render(<ShareWorkDialog work={work} open onOpenChange={vi.fn()} />)
    await screen.findByAltText('分享卡片预览')

    fireEvent.click(screen.getByRole('button', { name: '复制链接' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('http://localhost:3000/works/42')
    })
    expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument()
  })
})
