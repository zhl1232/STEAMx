import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GuideDisclosure } from './guide-disclosure'

const scroll = vi.fn()
const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  scroll.mockReset()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
})

describe('GuideDisclosure', () => {
  it('uses a native closed disclosure while retaining the full body', () => {
    render(<GuideDisclosure id="guide" title="详细说明"><p>完整正文</p></GuideDisclosure>)
    expect(screen.getByText('完整正文').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByText('详细说明').tagName).toBe('SUMMARY')
    expect(scroll).not.toHaveBeenCalled()
  })

  it('opens a disclosure addressed directly by a legacy hash', () => {
    window.history.replaceState(null, '', '/learn/nature#record-observation')
    render(<GuideDisclosure id="record-observation" title="页面用法"><p>完整正文</p></GuideDisclosure>)
    expect(screen.getByText('完整正文').closest('details')).toHaveAttribute('open')
    expect(scroll).toHaveBeenCalled()
  })

  it('opens all ancestors for a nested hash and leaves unrelated disclosures closed', () => {
    window.history.replaceState(null, '', '/learn/blocks#building-concepts')
    render(<><GuideDisclosure id="outer" title="外层"><GuideDisclosure id="inner" title="内层"><h3 id="building-concepts">互锁</h3></GuideDisclosure></GuideDisclosure><GuideDisclosure id="other" title="其他">不相关</GuideDisclosure></>)
    expect(document.getElementById('outer')).toHaveAttribute('open')
    expect(document.getElementById('inner')).toHaveAttribute('open')
    expect(document.getElementById('other')).not.toHaveAttribute('open')
  })

  it('responds to later hash navigation and removes listeners when unmounted', () => {
    const view = render(<GuideDisclosure title="准备"><h3 id="learning-preparation">准备内容</h3></GuideDisclosure>)
    window.history.replaceState(null, '', '/learn/blocks#learning-preparation')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(screen.getByText('准备内容').closest('details')).toHaveAttribute('open')
    view.unmount()
    scroll.mockClear()
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(scroll).not.toHaveBeenCalled()
  })

  it('ignores malformed or missing hash targets without errors', () => {
    window.history.replaceState(null, '', '/learn/blocks#%E0%A4%A')
    render(<GuideDisclosure title="准备">完整正文</GuideDisclosure>)
    expect(screen.getByText('完整正文').closest('details')).not.toHaveAttribute('open')
    window.history.replaceState(null, '', '/learn/blocks#missing')
    fireEvent(window, new HashChangeEvent('hashchange'))
    expect(scroll).not.toHaveBeenCalled()
  })
})
