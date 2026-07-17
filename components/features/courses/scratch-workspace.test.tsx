import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ScratchHostProvider } from './scratch-host-context'
import { ScratchWorkspace } from './scratch-workspace'

const postMessage = vi.fn()
const { mockScratchEditorAvailability } = vi.hoisted(() => ({
  mockScratchEditorAvailability: vi.fn(() => true),
}))

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
  useScratchEditorAvailability: mockScratchEditorAvailability,
}))

vi.mock('./scratch-loading-overlay', () => ({
  ScratchLoadingOverlay: () => null,
}))

describe('ScratchWorkspace', () => {
  beforeEach(() => {
    mockScratchEditorAvailability.mockReturnValue(true)
  })

  it('shows the upload fallback instead of mounting the editor on phones', () => {
    mockScratchEditorAvailability.mockReturnValue(false)

    render(
      <ScratchHostProvider>
        <ScratchWorkspace courseId={1} lessonId={2} />
      </ScratchHostProvider>,
    )

    expect(screen.getByText(/在手机上的小屏幕较难舒适地使用 Scratch/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '上传 .sb3 作品' })).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('forwards the current block hint target to the Scratch iframe and dismisses it', () => {
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
          keywords: ['当绿旗被点击', '说 你好!'],
          items: [
            {
              label: '当绿旗被点击',
              findLabel: '当绿旗被点击',
              category: 'events',
              findHint: '黄色事件帽子，带绿色小旗图标',
            },
            {
              label: '说 出发啦！',
              findLabel: '说 你好!',
              category: 'looks',
              editHint: '把文字改成「出发啦！」',
            },
          ],
          category: 'control',
          reason: 'next_step',
        }}
      />,
    )

    expect(screen.getByText('第 1 步要用到')).toBeInTheDocument()
    expect(screen.getByText(/继续做这一步/)).toBeInTheDocument()
    expect(screen.getByText(/当前 1\/2/)).toBeInTheDocument()
    expect(screen.getByText('正在找')).toBeInTheDocument()
    expect(screen.getByText('接着')).toBeInTheDocument()
    expect(screen.getByText('说 你好!')).toBeInTheDocument()
    expect(screen.getByText('拖出来后：把文字改成「出发啦！」')).toBeInTheDocument()
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'steam-scratch-parent',
        type: 'HIGHLIGHT_BLOCK_KEYWORDS',
        keywords: ['当绿旗被点击'],
        items: [
          {
            label: '当绿旗被点击',
            findLabel: '当绿旗被点击',
            category: 'events',
            findHint: '黄色事件帽子，带绿色小旗图标',
          },
        ],
        category: 'events',
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

  it('uses targetItemIndex to highlight a later block hint item', () => {
    postMessage.mockClear()
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        return { postMessage }
      },
    })

    render(
      <ScratchWorkspace
        courseId={1}
        lessonId={2}
        blockHint={{
          stepIndex: 0,
          keywords: ['当绿旗被点击', '说 你好!'],
          items: [
            {
              label: '当绿旗被点击',
              findLabel: '当绿旗被点击',
              category: 'events',
            },
            {
              label: '说 出发啦！',
              findLabel: '说 你好!',
              category: 'looks',
              editHint: '把文字改成「出发啦！」',
            },
          ],
          targetItemIndex: 1,
          reason: 'next_step',
        }}
      />,
    )

    expect(screen.getByText(/当前 2\/2/)).toBeInTheDocument()
    expect(screen.getByText('已提示')).toBeInTheDocument()
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: 'steam-scratch-parent',
        type: 'HIGHLIGHT_BLOCK_KEYWORDS',
        keywords: ['说 你好!'],
        items: [
          {
            label: '说 出发啦！',
            findLabel: '说 你好!',
            category: 'looks',
            editHint: '把文字改成「出发啦！」',
          },
        ],
        category: 'looks',
      },
      window.location.origin,
    )
  })

  it('reports Scratch editor context from the iframe', () => {
    postMessage.mockClear()
    const onEditorContextChange = vi.fn()

    render(
      <ScratchWorkspace
        courseId={1}
        lessonId={2}
        onEditorContextChange={onEditorContextChange}
      />,
    )

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: {
          source: 'steam-scratch-host',
          type: 'EDITOR_CONTEXT',
          context: {
            selectedTargetId: 'bear-1',
            selectedTargetName: 'Bear',
            targets: [{ id: 'bear-1', name: 'Bear' }],
          },
        },
      }),
    )

    expect(onEditorContextChange).toHaveBeenCalledWith({
      selectedTargetId: 'bear-1',
      selectedTargetName: 'Bear',
      targets: [{ id: 'bear-1', name: 'Bear' }],
    })
  })
})
