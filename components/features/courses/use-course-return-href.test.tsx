import { cleanup, renderHook } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCourseReturnHref } from './use-course-return-href'

const storageKey = 'courses:mobile-view:v1'
let mobile = true

beforeEach(() => {
  sessionStorage.clear()
  mobile = true
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return mobile },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useCourseReturnHref', () => {
  it('returns to the catalog when its saved course matches, including next lessons', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 5, views: {} }))
    const { result, rerender } = renderHook(({ courseId, lessonId }) => {
      void lessonId
      return useCourseReturnHref(courseId)
    }, { initialProps: { courseId: 5, lessonId: 30 } })
    expect(result.current).toBe('/courses?course=5')
    rerender({ courseId: 5, lessonId: 31 })
    expect(result.current).toBe('/courses?course=5')
    rerender({ courseId: 7, lessonId: 55 })
    expect(result.current).toBe('/courses?course=7')
  })

  it('returns to the same catalog on desktop after entering a lesson from it', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 5 }))
    mobile = false
    const { result } = renderHook(() => useCourseReturnHref(5))
    expect(result.current).toBe('/courses?course=5')
  })

  it.each([null, '{broken', '{"selected":7}', '{"selected":"5"}'])('falls back for absent or nonmatching state: %s', (saved) => {
    if (saved) sessionStorage.setItem(storageKey, saved)
    expect(renderHook(() => useCourseReturnHref(5)).result.current).toBe('/courses?course=5')
  })

  it('tolerates unavailable session storage', () => {
    vi.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => { throw new Error('storage blocked') })
    expect(renderHook(() => useCourseReturnHref(5)).result.current).toBe('/courses?course=5')
  })

  it('renders a deterministic course catalog href on the server', () => {
    sessionStorage.setItem(storageKey, JSON.stringify({ selected: 5 }))
    function Link() { return <a href={useCourseReturnHref(5)}>Back</a> }
    expect(renderToString(<Link />)).toContain('href="/courses?course=5"')
  })
})
