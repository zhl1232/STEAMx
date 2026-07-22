import imageCompression from 'browser-image-compression'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { compressImageForBucket } from '@/lib/utils/image-compression'

vi.mock('browser-image-compression', () => ({
  default: vi.fn(),
}))

const mockedImageCompression = vi.mocked(imageCompression)

describe('compressImageForBucket', () => {
  afterEach(() => {
    mockedImageCompression.mockReset()
  })

  it('uses the compact work-image preset for project completions', async () => {
    const input = new File([new Uint8Array(400 * 1024)], 'work.png', {
      type: 'image/png',
    })
    mockedImageCompression.mockResolvedValue(
      new File(['compressed'], 'work.jpg', { type: 'image/jpeg' }),
    )

    const result = await compressImageForBucket(input, 'project-completions')

    expect(mockedImageCompression).toHaveBeenCalledWith(
      input,
      expect.objectContaining({
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1600,
        initialQuality: 0.82,
        fileType: 'image/jpeg',
        useWebWorker: true,
      }),
    )
    expect(result.name).toBe('work.jpg')
    expect(result.type).toBe('image/jpeg')
  })

  it('keeps small completion images unchanged', async () => {
    const input = new File([new Uint8Array(300 * 1024)], 'small.webp', {
      type: 'image/webp',
    })

    await expect(compressImageForBucket(input, 'project-completions')).resolves.toBe(input)
    expect(mockedImageCompression).not.toHaveBeenCalled()
  })
})
