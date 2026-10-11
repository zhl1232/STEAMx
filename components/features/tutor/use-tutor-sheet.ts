'use client'

import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type MouseEvent, type PointerEvent, type KeyboardEvent,
} from 'react'
import { usePathname } from 'next/navigation'
import { measureTutorSheetBottomInset } from './tutor-sheet-inset'

export type TutorSheetSnap = 'collapsed' | 'half' | 'full'
const snaps: TutorSheetSnap[] = ['collapsed', 'half', 'full']
export const tutorSheetLabels = { collapsed: '收起', half: '半屏', full: '全屏' }

export function tutorSheetHeights(viewportHeight: number) {
  return { collapsed: 60, half: viewportHeight * 0.52, full: viewportHeight * 0.92 }
}

/** Height in px; velocity in px/ms, positive means moving upwards. */
export function resolveTutorSheetSnap(height: number, velocity: number, viewportHeight: number, currentSnap: TutorSheetSnap): TutorSheetSnap {
  const index = snaps.indexOf(currentSnap)
  if (velocity >= 0.5) return snaps[Math.min(2, index + 1)]
  if (velocity <= -0.5) return snaps[Math.max(0, index - 1)]
  const heights = tutorSheetHeights(viewportHeight)
  return snaps.reduce((nearest, snap) =>
    Math.abs(heights[snap] - height) < Math.abs(heights[nearest] - height) ? snap : nearest,
  )
}

export function useTutorSheet(open: boolean, fabBottomInset = 0) {
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [snap, setSnap] = useState<TutorSheetSnap>('half')
  const [previousOpen, setPreviousOpen] = useState(open)
  const [bottomInset, setBottomInset] = useState(0)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const gesture = useRef<{
    pointerId: number; startY: number; lastY: number; lastTime: number
    height: number; viewport: number; velocity: number; moved: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const previousPath = useRef(pathname)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => {
      setIsMobile(media.matches)
      setSnap('half')
      setDragHeight(null)
      gesture.current = null
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Reset before paint on each opening, without remounting any panel content.
  if (previousOpen !== open) {
    setPreviousOpen(open)
    setSnap('half')
    setDragHeight(null)
  }

  useEffect(() => {
    gesture.current = null
    suppressClick.current = false
  }, [open])

  const collapse = useCallback(() => {
    if (!isMobile || !open) return
    setSnap('collapsed')
    setDragHeight(null)
    gesture.current = null
  }, [isMobile, open])

  useEffect(() => {
    if (previousPath.current !== pathname) collapse()
    previousPath.current = pathname
  }, [pathname, collapse])

  useEffect(() => {
    if (!isMobile || !open) return
    window.addEventListener('hashchange', collapse)
    return () => window.removeEventListener('hashchange', collapse)
  }, [isMobile, open, collapse])

  useEffect(() => {
    if (!isMobile || !open || snap !== 'collapsed') return
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // DOMRects and fixed bottom offsets use the layout viewport coordinates.
        setBottomInset(measureTutorSheetBottomInset(document, window.innerHeight))
      })
    }
    schedule()
    const timer = window.setTimeout(schedule, 300)
    const viewport = window.visualViewport
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('resize', schedule)
    }
  }, [isMobile, open, snap, pathname])

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!isMobile || !open || !(event.target instanceof Element)) return
    const anchor = event.target.closest('a[href]')
    const href = anchor?.getAttribute('href')
    if (!href || !event.currentTarget.contains(anchor)) return
    try {
      const url = new URL(href, window.location.href)
      if (href.startsWith('#') || url.origin === window.location.origin) collapse()
    } catch { /* Invalid URLs do not navigate. */ }
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isMobile || !open || event.button !== 0 || gesture.current) return
    const viewport = window.visualViewport?.height ?? window.innerHeight
    gesture.current = {
      pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY,
      lastTime: event.timeStamp, height: tutorSheetHeights(viewport)[snap],
      viewport, velocity: 0, moved: false,
    }
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const elapsed = event.timeStamp - current.lastTime
    if (elapsed > 0) current.velocity = (current.lastY - event.clientY) / elapsed
    current.lastY = event.clientY
    current.lastTime = event.timeStamp
    current.moved ||= Math.abs(event.clientY - current.startY) > 4
    if (current.moved) {
      const heights = tutorSheetHeights(current.viewport)
      setDragHeight(Math.max(heights.collapsed, Math.min(heights.full, current.height + current.startY - event.clientY)))
    }
  }

  const finishDrag = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    suppressClick.current = (current.moved || cancelled) && event.currentTarget.tagName === 'BUTTON'
    if (current.moved && !cancelled) {
      const velocity = event.timeStamp - current.lastTime > 100 ? 0 : current.velocity
      setSnap(resolveTutorSheetSnap(current.height + current.startY - event.clientY, velocity, current.viewport, snap))
    }
    setDragHeight(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const toggle = () => setSnap((current) => current === 'full' ? 'half' : 'full')
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Native button activation handles Enter/Space exactly once.
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    const direction = event.key === 'ArrowUp' ? 1 : -1
    setSnap((current) => snaps[Math.max(0, Math.min(2, snaps.indexOf(current) + direction))])
  }

  const dragProps = {
    onPointerDown, onPointerMove,
    onPointerUp: (event: PointerEvent<HTMLElement>) => finishDrag(event),
    onPointerCancel: (event: PointerEvent<HTMLElement>) => finishDrag(event, true),
    onLostPointerCapture: (event: PointerEvent<HTMLElement>) => finishDrag(event, true),
  }
  const inset = Math.max(bottomInset, fabBottomInset)

  return {
    headerProps: {
      ...dragProps,
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (!(event.target instanceof Element) || !event.currentTarget.contains(event.target)) return
        if (event.target.closest('button, a, input, textarea, select, [role="button"], [role="menu"], [role="menuitem"]')) return
        onPointerDown(event)
      },
    },
    isMobile, snap, collapsed: isMobile && snap === 'collapsed', collapse,
    expand: () => setSnap('half'),
    panelProps: {
      'data-sheet-snap': isMobile ? snap : undefined,
      'data-sheet-dragging': isMobile && dragHeight !== null ? true : undefined,
      style: (isMobile ? {
        '--tutor-sheet-collapsed-bottom': inset > 0 ? `${inset + 8}px` : 'calc(8px + env(safe-area-inset-bottom))',
        ...(dragHeight !== null ? { '--tutor-sheet-height': `${dragHeight}px` } : {}),
      } : undefined) as CSSProperties | undefined,
      onClickCapture,
    },
    handleProps: {
      ...dragProps,
      onClick: () => {
        if (suppressClick.current) { suppressClick.current = false; return }
        toggle()
      },
      onKeyDown,
      'aria-label': `调整小迪面板高度：${tutorSheetLabels[snap]}`,
    },
  }
}
