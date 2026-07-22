import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ObservationSubmitPhotoSection } from './observation-submit-photo-section'

const mocks = vi.hoisted(() => ({
  promptLogin: vi.fn(),
  readMetadata: vi.fn(),
  toast: vi.fn(),
  upload: vi.fn(),
}))

vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
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
    vi.clearAllMocks()
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
          observedAt: '2026-07-22T09:30',
          latitude: 31.2304,
          longitude: 121.4737,
        },
      ])
    })
  })
})
