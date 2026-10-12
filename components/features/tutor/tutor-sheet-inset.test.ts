// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { measureTutorSheetBottomInset } from './tutor-sheet-inset'

function footer(top: number, css = '', parent: Element = document.body, width = 390) {
  const element = document.createElement('div')
  element.style.cssText = `position: fixed; ${css}`
  parent.append(element)
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    top, bottom: 800, left: 0, right: width, width, height: 800 - top,
    x: 0, y: top, toJSON: () => ({}),
  })
  return element
}

beforeEach(() => {
  vi.stubGlobal('innerWidth', 390)
  const original = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => original(element))
})
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('measureTutorSheetBottomInset', () => {
  it('measures bottom navigation', () => {
    footer(720).className = 'bottom-nav-bar'
    expect(measureTutorSheetBottomInset(document, 800)).toBe(80)
  })
  it('measures the project action bar without needing a special class', () => {
    footer(727).className = 'fixed inset-x-0 bottom-0 z-40'
    expect(measureTutorSheetBottomInset(document, 800)).toBe(73)
  })
  it('takes the maximum obstruction including sticky lesson footers', () => {
    footer(727)
    footer(704, 'position: sticky')
    expect(measureTutorSheetBottomInset(document, 800)).toBe(96)
  })
  it('excludes a non-interactive scrim', () => {
    footer(640, 'pointer-events: none').className = 'bottom-nav-scrim'
    footer(727)
    expect(measureTutorSheetBottomInset(document, 800)).toBe(73)
  })
  it('excludes tutor dialogs, floating controls and their descendants', () => {
    const dialog = document.createElement('section')
    dialog.setAttribute('role', 'dialog')
    document.body.append(dialog)
    footer(650, '', dialog)
    const bubble = footer(640)
    bubble.dataset.tutorUi = ''
    footer(620, '', bubble)
    expect(measureTutorSheetBottomInset(document, 800)).toBe(0)
  })
  it.each(['display: none', 'visibility: hidden', 'opacity: 0'])('excludes %s elements and descendants', (css) => {
    const hidden = footer(640, css)
    footer(620, '', hidden)
    expect(measureTutorSheetBottomInset(document, 800)).toBe(0)
  })
  it('excludes small floating buttons, tall overlays and non-bottom elements', () => {
    footer(740, '', document.body, 80)
    footer(0)
    const topBar = footer(0)
    vi.mocked(topBar.getBoundingClientRect).mockReturnValue({ ...topBar.getBoundingClientRect(), bottom: 60, height: 60 })
    expect(measureTutorSheetBottomInset(document, 800)).toBe(0)
  })
})
