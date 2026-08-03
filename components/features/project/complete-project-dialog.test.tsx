import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompleteProjectDialog } from './complete-project-dialog'

const uploadFileSecureWithProgress = vi.fn()
const toast = vi.fn()

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/context/project-context', () => ({
  useOptionalProjects: () => ({ submitExplorationPost: vi.fn() }),
}))

vi.mock('@/lib/utils/upload', () => ({
  uploadFileSecureWithProgress: (...args: unknown[]) => uploadFileSecureWithProgress(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
  useLoginPrompt: () => ({
    runAfterAgeConfirmation: <T,>(action: () => Promise<T>) => action(),
  }),
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('CompleteProjectDialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    uploadFileSecureWithProgress.mockReset()
    toast.mockReset()
  })

  it('uploads and submits multiple selected work photos in selection order', async () => {
    uploadFileSecureWithProgress.mockImplementation(async (file: File) => {
      return `https://assets.example.com/project-completions/user-1/${file.name}`
    })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 8 }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const onSuccess = vi.fn()
    render(
      <CompleteProjectDialog
        projectTitle="长颈鹿"
        submitEndpoint="/api/courses/5/lessons/33/works"
        open
        onOpenChange={vi.fn()}
        onSuccess={onSuccess}
      />,
    )

    const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement
    expect(input).not.toBeNull()

    fireEvent.change(input, {
      target: {
        files: [
          new File(['front'], 'front.webp', { type: 'image/webp' }),
          new File(['side'], 'side.webp', { type: 'image/webp' }),
        ],
      },
    })

    await waitFor(() => expect(screen.getByText('2/9')).toBeInTheDocument())
    expect(screen.getByText('继续添加照片（还可 7 张）')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '跳过，直接提交' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const request = fetchMock.mock.calls[0]
    expect(request[0]).toBe('/api/courses/5/lessons/33/works')
    expect(JSON.parse(request[1].body)).toMatchObject({
      images: [
        'https://assets.example.com/project-completions/user-1/front.webp',
        'https://assets.example.com/project-completions/user-1/side.webp',
      ],
    })
    expect(onSuccess).toHaveBeenCalledWith({ id: 8, status: 'pending', recordKind: 'final' })

    vi.unstubAllGlobals()
  })
})
