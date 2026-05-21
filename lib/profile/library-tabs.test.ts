import { describe, expect, it } from 'vitest'

import {
  parseProfileLibraryTab,
  toDesktopProfileLibraryTab,
  toProfileLibraryTab,
} from './library-tabs'

describe('profile library tabs', () => {
  it('accepts supported tab values', () => {
    expect(parseProfileLibraryTab('exploring')).toBe('exploring')
    expect(parseProfileLibraryTab(['completed', 'works'])).toBe('completed')
  })

  it('falls back to works for missing or invalid values', () => {
    expect(parseProfileLibraryTab(undefined)).toBe('works')
    expect(parseProfileLibraryTab(null)).toBe('works')
    expect(parseProfileLibraryTab('unknown')).toBe('works')
  })

  it('maps between mobile/url and desktop tab names', () => {
    expect(toDesktopProfileLibraryTab('works')).toBe('my-projects')
    expect(toDesktopProfileLibraryTab('likes')).toBe('liked')
    expect(toDesktopProfileLibraryTab('exploring')).toBe('exploring')
    expect(toProfileLibraryTab('my-projects')).toBe('works')
    expect(toProfileLibraryTab('liked')).toBe('likes')
  })
})
