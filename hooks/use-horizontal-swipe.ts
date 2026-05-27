"use client"

import { useCallback, useRef } from "react"

interface UseHorizontalSwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enabled?: boolean
  /** 最小水平位移（px） */
  threshold?: number
}

export function useHorizontalSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
  threshold = 48,
}: UseHorizontalSwipeOptions) {
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const didSwipeRef = useRef(false)

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return
      const touch = event.changedTouches[0]
      if (!touch) return
      startRef.current = { x: touch.clientX, y: touch.clientY }
      didSwipeRef.current = false
    },
    [enabled],
  )

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || !startRef.current) return
      const touch = event.changedTouches[0]
      if (!touch) return

      const dx = touch.clientX - startRef.current.x
      const dy = touch.clientY - startRef.current.y
      startRef.current = null

      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.15) return

      didSwipeRef.current = true
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    },
    [enabled, onSwipeLeft, onSwipeRight, threshold],
  )

  const consumeSwipe = useCallback(() => {
    const swiped = didSwipeRef.current
    didSwipeRef.current = false
    return swiped
  }, [])

  return {
    onTouchStart,
    onTouchEnd,
    consumeSwipe,
  }
}
