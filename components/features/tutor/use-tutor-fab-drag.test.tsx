import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTutorFabDrag } from './use-tutor-fab-drag'

function bridge() {
  return {
    canBegin: vi.fn(() => false),
    reset: vi.fn(),
    begin: vi.fn(),
    cancelForDrag: vi.fn(),
    release: vi.fn(() => false),
  }
}

function options(longPress = bridge()) {
  return {
    open: false,
    mounted: true,
    hideOnMobile: false,
    fabPlacement: 'default' as const,
    contextKey: 'home',
    onToggle: vi.fn(),
    longPress,
  }
}

describe('useTutorFabDrag pointer origin', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('innerWidth', 390)
    vi.stubGlobal('innerHeight', 844)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('holds the current onscreen rectangle while a pointer is active', () => {
    const { result } = renderHook(() => useTutorFabDrag(options()))
    const event = {
      button: 0,
      pointerId: 7,
      pointerType: 'mouse',
      clientX: 340,
      clientY: 300,
      currentTarget: {
        getBoundingClientRect: () => ({ right: 350, bottom: 420 }),
        setPointerCapture: vi.fn(),
      },
    } as unknown as React.PointerEvent<HTMLButtonElement>

    act(() => result.current.handleFabPointerDown(event))

    expect(result.current.fabInteracting).toBe(true)
    // Base right stays at 16px; the -24px transient translation keeps visual right at 40px.
    expect(result.current.fabStyle).toMatchObject({ right: 16, transform: 'translateX(-24px)' })
  })

  it('does not write storage for a tap', () => {
    const opts = options()
    const { result } = renderHook(() => useTutorFabDrag(opts))
    const target = {
      getBoundingClientRect: () => ({ right: 350, bottom: 420 }),
      setPointerCapture: vi.fn(),
    }
    const down = { button: 0, pointerId: 3, pointerType: 'mouse', clientX: 340, clientY: 300, currentTarget: target } as unknown as React.PointerEvent<HTMLButtonElement>
    const up = { pointerId: 3 } as unknown as React.PointerEvent<HTMLButtonElement>

    act(() => {
      result.current.handleFabPointerDown(down)
      result.current.handleFabPointerEnd(up)
      result.current.handleFabClick({ preventDefault: vi.fn(), stopPropagation: vi.fn() } as unknown as React.MouseEvent<HTMLButtonElement>)
    })

    expect(window.localStorage.getItem('xiaodi:fab-position:v1')).toBeNull()
    expect(opts.onToggle).toHaveBeenCalledOnce()
  })
})
