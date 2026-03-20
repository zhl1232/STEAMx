import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadFileSecure } from './upload'

describe('uploadFileSecure', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('includes pathPrefix in the upload form data when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ publicUrl: 'https://example.com/file.png' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['image'], 'cover.png', { type: 'image/png' })

    await expect(uploadFileSecure(file, 'project-images', 'covers')).resolves.toBe('https://example.com/file.png')

    const [, init] = fetchMock.mock.calls[0] as [string, { body: FormData }]
    expect(init.body.get('bucket')).toBe('project-images')
    expect(init.body.get('pathPrefix')).toBe('covers')
  })
})
