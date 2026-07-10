import { describe, expect, it } from 'vitest'

import {
  parseProfileLibraryTab,
  toDesktopProfileLibraryTab,
  toProfileLibraryTab,
} from './library-tabs'

describe('profile library tabs', () => {
  it('accepts supported tab values', () => {
    expect(parseProfileLibraryTab('exploring')).toBe('exploring')
    expect(parseProfileLibraryTab(['published', 'works'])).toBe('published')
  })

  it('falls back to exploring for missing or invalid values', () => {
    expect(parseProfileLibraryTab(undefined)).toBe('exploring')
    expect(parseProfileLibraryTab(null)).toBe('exploring')
    expect(parseProfileLibraryTab('unknown')).toBe('exploring')
  })

  it('maps between mobile/url and desktop tab names', () => {
    expect(toDesktopProfileLibraryTab('works')).toBe('completed')
    expect(toDesktopProfileLibraryTab('published')).toBe('my-projects')
    expect(toDesktopProfileLibraryTab('likes')).toBe('liked')
    expect(toDesktopProfileLibraryTab('exploring')).toBe('exploring')
    expect(toProfileLibraryTab('my-projects')).toBe('published')
    expect(toProfileLibraryTab('completed')).toBe('works')
    expect(toProfileLibraryTab('liked')).toBe('likes')
  })
})
