/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isOwnedProjectImageUrl } from '@/lib/api/validation'

const TEST_SUPABASE_URL = 'https://example.supabase.co'

describe('isOwnedProjectImageUrl', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })
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

  it('accepts completion images in project-completions bucket', () => {
    expect(
      isOwnedProjectImageUrl(
        'https://example.supabase.co/storage/v1/object/public/project-completions/user-123/file.jpg',
        'user-123',
        { bucket: 'project-completions' },
      ),
    ).toBe(true)
  })

  it('rejects completion images from another user', () => {
    expect(
      isOwnedProjectImageUrl(
        'https://example.supabase.co/storage/v1/object/public/project-completions/user-999/file.jpg',
        'user-123',
        { bucket: 'project-completions' },
      ),
    ).toBe(false)
  })
})
