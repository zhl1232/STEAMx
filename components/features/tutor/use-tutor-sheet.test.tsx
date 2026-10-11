import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveTutorSheetSnap, useTutorSheet } from './use-tutor-sheet'
import { TutorMobileSheet, tutorSheetSummary } from './tutor-mobile-sheet'

let pathname = '/courses'
let mobile = true
let changeMedia: () => void
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('./xiaodi', () => ({ XiaoDi: () => <span>头像</span> }))

beforeEach(() => {
  pathname = '/courses'
  mobile = true
  vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('visualViewport', undefined)
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    get matches() { return mobile },
    addEventListener: (_: string, listener: () => void) => { changeMedia = listener },
    removeEventListener: vi.fn(),
  })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('sheet snap calculation', () => {
  it.each([
    ['full', -0.8, 'half'], ['half', -0.8, 'collapsed'], ['collapsed', -0.8, 'collapsed'],
    ['collapsed', 0.8, 'half'], ['half', 0.8, 'full'], ['full', 0.8, 'full'],
  ] as const)('fast swipe from %s at %s advances to %s', (current, velocity, expected) => {
    expect(resolveTutorSheetSnap(velocity > 0 ? 900 : 60, velocity, 800, current)).toBe(expected)
  })
  it.each([
    [60, 0, 'collapsed'], [200, 0, 'collapsed'], [280, 0, 'half'],
    [416, 0, 'half'], [610, 0, 'full'], [900, 0, 'full'],
    [416, -0.6, 'collapsed'], [65, 0.6, 'full'], [650, -0.8, 'collapsed'],
  ] as const)('height %s and velocity %s -> %s', (height, velocity, expected) => {
    expect(resolveTutorSheetSnap(height, velocity, 800, 'half')).toBe(expected)
  })
})

function Harness({ open = true, inset = 0 }: { open?: boolean; inset?: number }) {
  const sheet = useTutorSheet(open, inset)
  const [draft, setDraft] = useState('')
  const [images, setImages] = useState<string[]>([])
  return open && <section role="dialog" {...sheet.panelProps}>
    <TutorMobileSheet sheet={sheet} summary={tutorSheetSummary([{ role: 'assistant', content: '**观察** [小车](/courses)\n再试一次' }])}>
      <div data-testid="messages" className="overflow-y-auto">观察小车再试一次</div>
      <a href="#step" onClick={(event) => event.preventDefault()}><span>步骤</span></a>
      <a href="https://example.org" onClick={(event) => event.preventDefault()}>外站</a>
      <textarea aria-label="问题" value={draft} onChange={(event) => setDraft(event.target.value)} />
      <button onClick={() => setImages(['photo.png'])}>加图片</button>
      <output>{images.join(',')}</output>
    </TutorMobileSheet>
  </section>
}
const handle = () => screen.getByRole('button', { name: /调整小迪面板高度/ })
const expectSnap = (snap: string) => expect(screen.getByRole('dialog')).toHaveAttribute('data-sheet-snap', snap)

describe('mobile sheet shell and hook', () => {
  it('tracks a bottom bar inserted 500ms after returning to a route, its height changes and removal', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('innerWidth', 390)
    pathname = '/project/1189'
    const { rerender, unmount } = render(<Harness />)
    pathname = '/project/83'
    rerender(<Harness />)
    pathname = '/project/1189'
    rerender(<Harness />)
    const bottom = () => screen.getByRole('dialog').style.getPropertyValue('--tutor-sheet-collapsed-bottom')
    act(() => vi.advanceTimersByTime(500))
    expect(bottom()).toBe('calc(8px + env(safe-area-inset-bottom))')
    const bar = document.createElement('div')
    bar.style.position = 'fixed'
    let height = 73
    vi.spyOn(bar, 'getBoundingClientRect').mockImplementation(() => ({
      top: 800 - height, bottom: 800, height, width: 390, left: 0, right: 390,
      x: 0, y: 800 - height, toJSON: () => ({}),
    }))
    await act(async () => { document.body.append(bar) })
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('81px')
    // Continue observing after all route fallback timers have expired.
    act(() => vi.advanceTimersByTime(1100))
    await act(async () => { height = 90; bar.style.height = '90px' })
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('98px')
    await act(async () => { bar.remove() })
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('calc(8px + env(safe-area-inset-bottom))')
    unmount()
  })

  it('coalesces page mutations and resizes, and ignores mutations inside tutor UI', async () => {
    vi.useFakeTimers()
    const { unmount } = render(<Harness />)
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    act(() => vi.advanceTimersByTime(1600))
    const panel = screen.getByRole('dialog')
    const measure = vi.spyOn(document.body, 'querySelectorAll')
    await act(async () => { panel.style.color = 'red' })
    act(() => vi.advanceTimersByTime(20))
    expect(measure).not.toHaveBeenCalled()
    const bar = document.createElement('div')
    await act(async () => {
      document.body.append(bar)
      bar.className = 'bottom-bar'
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('resize'))
    })
    act(() => vi.advanceTimersByTime(20))
    expect(measure).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(100))
    expect(measure).toHaveBeenCalledOnce()
    unmount()
    bar.remove()
  })

  it.each(['expand', 'close'] as const)('stops observing and cancels pending measurements on %s', async (action) => {
    vi.useFakeTimers()
    const viewport = new EventTarget()
    vi.stubGlobal('visualViewport', viewport)
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const { result, rerender, unmount } = renderHook(({ open }) => useTutorSheet(open), { initialProps: { open: true } })
    act(() => result.current.collapse())
    act(() => vi.advanceTimersByTime(20))
    const measure = vi.spyOn(document.body, 'querySelectorAll')
    // Queue a frame immediately before leaving collapsed.
    act(() => window.dispatchEvent(new Event('resize')))
    if (action === 'expand') act(() => result.current.expand())
    else rerender({ open: false })
    expect(disconnect).toHaveBeenCalledOnce()
    const bar = document.createElement('div')
    await act(async () => { document.body.append(bar) })
    act(() => {
      window.dispatchEvent(new Event('resize'))
      viewport.dispatchEvent(new Event('resize'))
      vi.advanceTimersByTime(2000)
    })
    expect(measure).not.toHaveBeenCalled()
    bar.remove()
    unmount()
  })

  it.each([0, 73, 80])('only gives the collapsed section its bottom inset (%s px)', (inset) => {
    render(<Harness inset={inset} />)
    const panel = screen.getByRole('dialog')
    const bottom = () => panel.style.getPropertyValue('--tutor-sheet-collapsed-bottom')
    expectSnap('half')
    expect(bottom()).toBe('')
    fireEvent.click(handle())
    expectSnap('full')
    expect(bottom()).toBe('')
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    expectSnap('collapsed')
    expect(bottom()).toBe(inset ? `${inset + 8}px` : 'calc(8px + env(safe-area-inset-bottom))')
    fireEvent.click(screen.getByRole('button', { name: '展开小迪对话' }))
    expectSnap('half')
    expect(bottom()).toBe('')
  })

  it('opens half, toggles, handles arrow keys, and preserves the mounted body while collapsed', () => {
    render(<Harness />)
    expectSnap('half')
    fireEvent.click(handle())
    expectSnap('full')
    fireEvent.click(handle())
    expectSnap('half')
    fireEvent.keyDown(handle(), { key: 'ArrowUp' })
    expectSnap('full')
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    expectSnap('half')
    const input = screen.getByRole('textbox')
    const message = screen.getByTestId('messages')
    fireEvent.change(input, { target: { value: '保留我的问题' } })
    fireEvent.click(screen.getByText('加图片'))
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    expectSnap('collapsed')
    const bar = screen.getByRole('button', { name: '展开小迪对话' })
    expect(bar).toHaveAttribute('aria-expanded', 'false')
    expect(bar).toHaveTextContent('小迪：观察 小车 再试一次')
    expect(message.parentElement).toHaveAttribute('aria-hidden', 'true')
    expect(message.parentElement).toHaveAttribute('inert')
    fireEvent.click(bar)
    expectSnap('half')
    expect(screen.getByRole('textbox')).toBe(input)
    expect(input).toHaveValue('保留我的问题')
    expect(screen.getByTestId('messages')).toBe(message)
    expect(screen.getByText('photo.png')).toBeInTheDocument()
  })

  it('collapses on pathname, hash and captured internal link clicks; ignores external links', () => {
    const { rerender } = render(<Harness />)
    fireEvent.click(screen.getByText('外站'))
    expectSnap('half')
    fireEvent.click(screen.getByText('步骤'))
    expectSnap('collapsed')
    fireEvent.click(screen.getByRole('button', { name: '展开小迪对话' }))
    fireEvent.click(handle())
    act(() => window.dispatchEvent(new Event('hashchange')))
    expectSnap('collapsed')
    fireEvent.click(screen.getByRole('button', { name: '展开小迪对话' }))
    pathname = '/courses/1'
    rerender(<Harness />)
    expectSnap('collapsed')
    rerender(<Harness open={false} />)
    rerender(<Harness />)
    expectSnap('half')
  })

  it.each(['/courses', '#step', 'same-origin'])('collapses captured %s links even when their bubble handler stops propagation', (href) => {
    render(<Harness />)
    const anchor = screen.getByText('步骤').closest('a')!
    anchor.setAttribute('href', href === 'same-origin' ? `${window.location.origin}/courses` : href)
    anchor.addEventListener('click', (event) => event.stopPropagation())
    fireEvent.click(screen.getByText('步骤'))
    expectSnap('collapsed')
  })

  it('does not enable mobile interactions on desktop, and resets after breakpoint changes', () => {
    mobile = false
    const { rerender } = render(<Harness />)
    expect(screen.queryByRole('button', { name: /调整小迪/ })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('data-sheet-snap')
    pathname = '/new'
    rerender(<Harness />)
    act(() => window.dispatchEvent(new Event('hashchange')))
    expect(screen.queryByRole('button', { name: '展开小迪对话' })).not.toBeInTheDocument()
    act(() => { mobile = true; changeMedia() })
    expectSnap('half')
    fireEvent.keyDown(handle(), { key: 'ArrowDown' })
    act(() => { mobile = false; changeMedia() })
    expect(screen.getByRole('textbox')).not.toHaveAttribute('inert')
    expect(screen.queryByRole('button', { name: '展开小迪对话' })).not.toBeInTheDocument()
  })

  it('uses pointer capture, follows position, snaps and suppresses the click after a drag', () => {
    const { result } = renderHook(() => useTutorSheet(true))
    const target = { tagName: 'BUTTON', setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() }
    const event = (clientY: number, timeStamp: number) => ({ button: 0, pointerId: 1, clientY, timeStamp, currentTarget: target }) as unknown as ReactPointerEvent<HTMLButtonElement>
    act(() => result.current.handleProps.onPointerDown(event(400, 0)))
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    act(() => result.current.handleProps.onPointerMove(event(180, 1000)))
    expect(result.current.panelProps.style).toMatchObject({ '--tutor-sheet-height': '636px' })
    act(() => result.current.handleProps.onPointerUp(event(180, 1010)))
    expect(result.current.snap).toBe('full')
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
    act(() => result.current.handleProps.onClick())
    expect(result.current.snap).toBe('full')
    act(() => result.current.handleProps.onClick())
    expect(result.current.snap).toBe('half')
    act(() => result.current.handleProps.onPointerDown(event(400, 2000)))
    act(() => result.current.handleProps.onPointerMove(event(440, 2020)))
    act(() => result.current.handleProps.onPointerUp(event(440, 2030)))
    expect(result.current.snap).toBe('collapsed')
  })

  it('cancels interrupted drags without changing snap and ignores message scroll gestures', () => {
    const { result } = renderHook(() => useTutorSheet(true))
    const target = { tagName: 'BUTTON', setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() }
    const event = { button: 0, pointerId: 1, clientY: 400, timeStamp: 0, currentTarget: target } as unknown as ReactPointerEvent<HTMLButtonElement>
    act(() => result.current.handleProps.onPointerDown(event))
    act(() => result.current.handleProps.onPointerCancel(event))
    expect(result.current.snap).toBe('half')
    expect(result.current.panelProps.style).not.toHaveProperty('--tutor-sheet-height')
    render(<Harness />)
    fireEvent.pointerDown(screen.getByTestId('messages'), { clientY: 200, pointerId: 2 })
    fireEvent.pointerMove(screen.getByTestId('messages'), { clientY: 600, pointerId: 2 })
    fireEvent.pointerUp(screen.getByTestId('messages'), { clientY: 600, pointerId: 2 })
    expectSnap('half')
  })

  it('measures on collapse, route changes and viewport resizes, respects the page inset and stops after expansion', () => {
    vi.useFakeTimers()
    vi.stubGlobal('innerWidth', 390)
    const viewport = new EventTarget()
    vi.stubGlobal('visualViewport', viewport)
    const bar = document.createElement('div')
    bar.style.position = 'fixed'
    document.body.append(bar)
    let height = 73
    const measure = vi.spyOn(bar, 'getBoundingClientRect').mockImplementation(() => ({
      top: 800 - height, bottom: 800, height, width: 390, left: 0, right: 390,
      x: 0, y: 800 - height, toJSON: () => ({}),
    }))
    const { result, rerender, unmount } = renderHook(({ inset }) => useTutorSheet(true, inset), { initialProps: { inset: 0 } })
    const bottom = () => result.current.panelProps.style?.['--tutor-sheet-collapsed-bottom' as keyof typeof result.current.panelProps.style]
    act(() => result.current.collapse())
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('81px')
    height = 90
    act(() => vi.advanceTimersByTime(320))
    expect(bottom()).toBe('98px')
    height = 80
    act(() => window.dispatchEvent(new Event('resize')))
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('88px')
    height = 100
    act(() => viewport.dispatchEvent(new Event('resize')))
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('108px')
    height = 60
    pathname = '/project/2'
    rerender({ inset: 0 })
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('68px')
    height = 73
    act(() => vi.advanceTimersByTime(320))
    expect(bottom()).toBe('81px')
    rerender({ inset: 120 })
    expect(bottom()).toBe('128px')
    rerender({ inset: 0 })
    bar.remove()
    act(() => window.dispatchEvent(new Event('resize')))
    act(() => vi.advanceTimersByTime(20))
    expect(bottom()).toBe('calc(8px + env(safe-area-inset-bottom))')
    act(() => result.current.expand())
    measure.mockClear()
    act(() => window.dispatchEvent(new Event('resize')))
    act(() => vi.advanceTimersByTime(400))
    expect(measure).not.toHaveBeenCalled()
    unmount()
  })

  it('drags from the header without toggling on taps or capturing nested buttons and menus', () => {
    const { result } = renderHook(() => useTutorSheet(true))
    const header = document.createElement('div')
    const title = document.createElement('span')
    const button = document.createElement('button')
    const icon = document.createElement('span')
    button.append(icon)
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menuitem')
    header.append(title, button, menu)
    header.setPointerCapture = vi.fn()
    header.hasPointerCapture = () => true
    header.releasePointerCapture = vi.fn()
    const event = (target: Element, clientY = 400, timeStamp = 0) => ({
      button: 0, pointerId: 1, clientY, timeStamp, currentTarget: header, target,
    }) as unknown as ReactPointerEvent<HTMLElement>
    for (const target of [icon, menu, document.createElement('div')]) {
      act(() => result.current.headerProps.onPointerDown(event(target)))
    }
    expect(header.setPointerCapture).not.toHaveBeenCalled()
    act(() => result.current.headerProps.onPointerDown(event(title)))
    act(() => result.current.headerProps.onPointerUp(event(title, 400, 10)))
    expect(result.current.snap).toBe('half')
    expect(result.current.headerProps).not.toHaveProperty('onClick')
    act(() => result.current.headerProps.onPointerDown(event(title)))
    act(() => result.current.headerProps.onPointerMove(event(title, 350, 20)))
    act(() => result.current.headerProps.onPointerUp(event(title, 350, 30)))
    expect(result.current.snap).toBe('full')
    act(() => result.current.headerProps.onPointerDown(event(title)))
    act(() => result.current.headerProps.onPointerMove(event(title, 700, 20)))
    act(() => result.current.headerProps.onPointerUp(event(title, 700, 30)))
    expect(result.current.snap).toBe('half')
  })

  it('summarizes the latest assistant text and supports an empty conversation', () => {
    expect(tutorSheetSummary([])).toBe('问小迪一个问题')
    expect(tutorSheetSummary([
      { role: 'assistant', content: '旧回答' },
      { role: 'assistant', content: '# 新回答\n**试试** [lesson:1:2|小车]' },
      { role: 'user', content: '用户消息' },
    ])).toBe('小迪：新回答 试试 小车')
  })
})
