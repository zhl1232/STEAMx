/** @vitest-environment node */

import { describe, expect, it } from 'vitest'

import { isOwnedProjectImageUrl } from '@/lib/api/validation'

describe('isOwnedProjectImageUrl', () => {
  it('accepts observation images in the current user path', () => {
    expect(
      isOwnedProjectImageUrl(
        'https://example.supabase.co/storage/v1/object/public/project-images/observations/user-123/file.webp',
        'user-123',
        'observations',
      ),
    ).toBe(true)
  })

  it('rejects observation images from another user', () => {
    expect(
      isOwnedProjectImageUrl(
        'https://example.supabase.co/storage/v1/object/public/project-images/observations/user-999/file.webp',
        'user-123',
        'observations',
      ),
    ).toBe(false)
  })

  it('rejects non-project-images paths', () => {
    expect(
      isOwnedProjectImageUrl(
        'https://example.supabase.co/storage/v1/object/public/comment-images/user-123/file.webp',
        'user-123',
        'observations',
      ),
    ).toBe(false)
  })
})
