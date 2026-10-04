import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ObservationSubmitPhotoSection } from './observation-submit-photo-section'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  promptLogin: vi.fn(),
  readMetadata: vi.fn(),
  toast: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}))

vi.mock('@/lib/context/login-prompt-context', () => ({
  useLoginPrompt: () => ({ promptLogin: mocks.promptLogin }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock('@/lib/observation-photo-metadata', () => ({
  readObservationPhotoMetadata: (...args: unknown[]) => mocks.readMetadata(...args),
}))

vi.mock('@/lib/utils/upload', () => ({
  getSecureUploadErrorMessage: () => '图片上传失败，请重试',
  isExpectedSecureUploadRejection: () => false,
  uploadFileSecure: (...args: unknown[]) => mocks.upload(...args),
  validateFileType: () => true,
}))

describe('ObservationSubmitPhotoSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    mocks.user = { id: 'user-1' }
    mocks.readMetadata.mockResolvedValue({ observedAt: null, latitude: null, longitude: null })
  })

  it('prompts anonymous users to log in before opening the file chooser', () => {
    mocks.user = null
    const { container } = render(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const choose = vi.spyOn(input, 'click')

    fireEvent.click(screen.getByRole('button', { name: /选择观察照片/ }))

    expect(mocks.promptLogin).toHaveBeenCalledOnce()
    expect(choose).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it.each([
    ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36', true],
    ['desktop Chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36', false],
    ['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', false],
  ])('uses the appropriate primary picker on %s', (_device, userAgent, prefersOriginal) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
    const { container } = render(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={vi.fn()} />)
    const originalInput = container.querySelector('input[aria-label="从文件选择原始照片"]') as HTMLInputElement
    const photoInput = container.querySelector('input[aria-label="选择观察照片"]') as HTMLInputElement
    const chooseOriginal = vi.spyOn(originalInput, 'click')
    const choosePhotos = vi.spyOn(photoInput, 'click')

    fireEvent.click(screen.getByRole('button', { name: /选择观察照片/ }))

    expect(chooseOriginal).toHaveBeenCalledTimes(prefersOriginal ? 1 : 0)
    expect(choosePhotos).toHaveBeenCalledTimes(prefersOriginal ? 0 : 1)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('keeps successful photos and their metadata when another upload fails', async () => {
    mocks.upload.mockResolvedValueOnce('https://example.com/good.jpg').mockRejectedValueOnce(new Error('failed'))
    const onEvidenceChange = vi.fn()
    const onPhotoMetadata = vi.fn()
    const { container } = render(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={onEvidenceChange} onPhotoMetadata={onPhotoMetadata} />)

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')] },
    })

    await waitFor(() => expect(onEvidenceChange).toHaveBeenCalledWith(['https://example.com/good.jpg']))
    expect(onPhotoMetadata).toHaveBeenCalledWith([expect.objectContaining({ imageUrl: 'https://example.com/good.jpg' })])
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: '1 张照片上传失败' }))
  })

  it('offers an unrestricted file picker for original photos and checks login first', () => {
    const { container, rerender } = render(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={vi.fn()} />)
    const input = container.querySelector('input[aria-label="从文件选择原始照片"]') as HTMLInputElement
    const choose = vi.spyOn(input, 'click')
    expect(input).not.toHaveAttribute('accept')
    fireEvent.click(screen.getByRole('button', { name: '从文件选择原图' }))
    expect(choose).toHaveBeenCalledOnce()
    mocks.user = null
    choose.mockClear()
    rerender(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '从文件选择原图' }))
    expect(mocks.promptLogin).toHaveBeenCalledOnce()
    expect(choose).not.toHaveBeenCalled()
  })

  it('forwards metadata read failures to the per-photo warning', async () => {
    mocks.readMetadata.mockResolvedValue({ observedAt: null, latitude: null, longitude: null, gpsReadStatus: 'unreadable' })
    mocks.upload.mockResolvedValue('https://example.com/photo.jpg')
    const onPhotoMetadata = vi.fn()
    const { container } = render(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={vi.fn()} onPhotoMetadata={onPhotoMetadata} />)
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['bytes'], 'photo.jpg')] } })
    await waitFor(() => expect(onPhotoMetadata).toHaveBeenCalledWith([expect.objectContaining({ imageUrl: 'https://example.com/photo.jpg', gpsReadStatus: 'unreadable' })]))
  })

  it('does not restore a deleted photo when a later upload completes', async () => {
    let finish: (url: string) => void = () => {}
    mocks.upload.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve }))
    const onEvidenceChange = vi.fn()
    const { container, rerender } = render(<ObservationSubmitPhotoSection evidenceImages={['https://example.com/old.jpg']} onEvidenceChange={onEvidenceChange} />)
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(['new'], 'new.jpg')] } })
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', { name: '删除第 1 张照片' }))
    rerender(<ObservationSubmitPhotoSection evidenceImages={[]} onEvidenceChange={onEvidenceChange} />)
    await act(async () => { finish('https://example.com/new.jpg') })
    expect(onEvidenceChange).toHaveBeenLastCalledWith(['https://example.com/new.jpg'])
  })

  it('reads EXIF from the original photo before compression and upload', async () => {
    let resolveMetadata: ((value: {
      observedAt: string
      latitude: number
      longitude: number
    }) => void) | undefined
    mocks.readMetadata.mockImplementation(
      () => new Promise((resolve) => {
        resolveMetadata = resolve
      }),
    )
    mocks.upload.mockResolvedValue(
      'https://example.com/storage/v1/object/public/project-images/observations/user-1/photo.jpg',
    )
    const onEvidenceChange = vi.fn()
    const onPhotoMetadata = vi.fn()

    const { container } = render(
      <ObservationSubmitPhotoSection
        evidenceImages={[]}
        onEvidenceChange={onEvidenceChange}
        onPhotoMetadata={onPhotoMetadata}
      />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const originalPhoto = new File(['original-with-exif'], 'photo.jpg', {
      type: 'image/jpeg',
    })

    fireEvent.change(input, { target: { files: [originalPhoto] } })

    expect(mocks.readMetadata).toHaveBeenCalledWith(originalPhoto)
    expect(mocks.upload).not.toHaveBeenCalled()

    await act(async () => {
      resolveMetadata?.({
        observedAt: '2026-07-22T09:30',
        latitude: 31.2304,
        longitude: 121.4737,
      })
    })

    await waitFor(() => {
      expect(mocks.upload).toHaveBeenCalledWith(
        originalPhoto,
        'project-images',
        'observations',
      )
    })
    await waitFor(() => {
      expect(onPhotoMetadata).toHaveBeenCalledWith([
        {
          imageUrl: 'https://example.com/storage/v1/object/public/project-images/observations/user-1/photo.jpg',
          observedAt: '2026-07-22T09:30',
          latitude: 31.2304,
          longitude: 121.4737,
        },
      ])
    })
  })
})
