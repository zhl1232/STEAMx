import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getScratchHostUrl, ScratchHostProvider } from './scratch-host-context'
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

  it('uses a same-origin iframe URL that is stable during server rendering and hydration', () => {
    expect(getScratchHostUrl(false)).toBe('/scratch/index.html?embed=1')
    expect(getScratchHostUrl(true)).toBe('/scratch/index.html?playerOnly=1')
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

  it('keeps the phone upload fallback inside the remaining height so the button is not clipped', () => {
    mockScratchEditorAvailability.mockReturnValue(false)

    render(
      <ScratchHostProvider>
        <ScratchWorkspace courseId={1} lessonId={2} />
      </ScratchHostProvider>,
    )

    // 作为固定高度工作区里的 flex 子项：占满剩余高度、可收缩，并在内部滚动而不是被父级 overflow 裁掉。
    const fallback = screen.getByTestId('scratch-mobile-fallback')
    expect(fallback).toHaveClass('flex-1', 'min-h-0', 'overflow-y-auto')
    expect(fallback).not.toHaveClass('h-full')
    // 内层 my-auto：空间够时居中，不够时从顶部开始排布（justify-center 溢出时会把上下两端都裁掉）。
    expect(fallback.firstElementChild).toHaveClass('my-auto')
    expect(fallback).not.toHaveClass('justify-center')

    // 小屏紧凑内边距，平板以上保持原来的 p-8。
    expect(fallback.firstElementChild).toHaveClass('px-4', 'py-6', 'sm:p-8')

    // 触控目标至少 44px，且不会被挤压。
    expect(screen.getByRole('button', { name: '上传 .sb3 作品' })).toHaveClass('min-h-11', 'shrink-0')
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

  it('refuses to replace an unavailable saved project with the lesson starter', async () => {
    postMessage.mockClear()
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() { return { postMessage } },
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hasUserProject: true, projectUrl: null }),
    })
    try {
      render(<ScratchWorkspace courseId={1} lessonId={2} starterProjectUrl="/api/assets/courses/scratch-original/v1/s01-l01/starter.sb3" />)
      window.dispatchEvent(new MessageEvent('message', {
        origin: window.location.origin,
        data: { source: 'steam-scratch-host', type: 'SCRATCH_READY' },
      }))
      await waitFor(() => {
        expect(postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'LOAD_PROJECT', url: null, failClosed: true }),
          window.location.origin,
        )
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
