/** @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isOwnedCompletionVideoUrl,
  isOwnedProjectImageUrl,
  validateOwnedOrTrustedImageUrlFromSources,
  ValidationError,
} from '@/lib/api/validation'

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

  it('accepts completion videos in the current user path', () => {
    expect(
      isOwnedCompletionVideoUrl(
        'https://example.supabase.co/storage/v1/object/public/project-completion-videos/user-123/file.mp4',
        'user-123',
      ),
    ).toBe(true)
  })

  it('rejects completion videos from another user', () => {
    expect(
      isOwnedCompletionVideoUrl(
        'https://example.supabase.co/storage/v1/object/public/project-completion-videos/user-999/file.mp4',
        'user-123',
      ),
    ).toBe(false)
  })
})

describe('validateOwnedOrTrustedImageUrlFromSources', () => {
  const TUTOR_SOURCES = [
    { bucket: 'project-completions', pathPrefix: 'challenge-submissions' },
    { bucket: 'project-images', pathPrefix: 'observations' },
    { bucket: 'project-images', pathPrefix: 'tutor-chat' },
  ]

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', TEST_SUPABASE_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts challenge stage images from the current user', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://example.supabase.co/storage/v1/object/public/project-completions/challenge-submissions/user-123/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).not.toThrow()
  })

  it('accepts observation images from the current user', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://example.supabase.co/storage/v1/object/public/project-images/observations/user-123/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).not.toThrow()
  })

  it('accepts tutor chat uploads from the current user', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://example.supabase.co/storage/v1/object/public/project-images/tutor-chat/user-123/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).not.toThrow()
  })

  it('rejects images uploaded by another user in any source', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://example.supabase.co/storage/v1/object/public/project-images/tutor-chat/user-999/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).toThrow(ValidationError)
  })

  it('rejects paths outside the allowed sources', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://example.supabase.co/storage/v1/object/public/project-images/user-123/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).toThrow(ValidationError)
  })

  it('rejects external hosts', () => {
    expect(() =>
      validateOwnedOrTrustedImageUrlFromSources(
        'https://evil.example.com/storage/v1/object/public/project-images/tutor-chat/user-123/file.webp',
        'user-123',
        '产出图片',
        TUTOR_SOURCES,
      ),
    ).toThrow(ValidationError)
  })
})
