import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ScratchWorkspace } from './scratch-workspace'

const postMessage = vi.fn()

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
  useLoginPrompt: () => ({ promptLogin: vi.fn() }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/courses/device', () => ({
  canUseScratchEditor: () => true,
}))

vi.mock('./scratch-loading-overlay', () => ({
  ScratchLoadingOverlay: () => null,
}))

describe('ScratchWorkspace', () => {
  it('forwards block hint keywords to the Scratch iframe and dismisses them', () => {
    postMessage.mockClear()
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        return { postMessage }
      },
    })

    const { rerender } = render(
      <ScratchWorkspace
        courseId={1}
        lessonId={2}
        blockHint={{
          stepIndex: 0,
          keywords: ['重复执行', '播放声音'],
          category: 'control',
          reason: 'next_step',
        }}
      />,
    )

    expect(screen.getByText('可以先找这些积木')).toBeInTheDocument()
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'steam-scratch-parent',
        type: 'HIGHLIGHT_BLOCK_KEYWORDS',
        keywords: ['重复执行', '播放声音'],
        category: 'control',
      },
      window.location.origin,
    )

    rerender(<ScratchWorkspace courseId={1} lessonId={2} blockHint={null} />)

    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'steam-scratch-parent',
        type: 'DISMISS_BLOCK_KEYWORDS',
      },
      window.location.origin,
    )
  })
})
