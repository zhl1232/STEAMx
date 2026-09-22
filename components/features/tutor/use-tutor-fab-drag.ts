'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

import {
  canTutorFabEdgeDock,
  clampTutorFabPosition,
  getDefaultTutorFabPosition,
  getTutorFabBubbleOffset,
  getTutorFabDockTransform,
  getTutorFabDockTransformOrigin,
  readTutorFabPosition,
  resolveTutorFabDockEdge,
  TUTOR_FAB_CLOSED_SIZE_PX,
  TUTOR_FAB_DOCK_IDLE_MS,
  TUTOR_FAB_DRAG_THRESHOLD_PX,
  TUTOR_FAB_MOBILE_BREAKPOINT_PX,
  writeTutorFabPosition,
  type TutorFabDockEdge,
  type TutorFabPosition,
} from '@/components/features/tutor/tutor-fab-position'
import type { TutorLongPressBridge } from '@/components/features/tutor/use-tutor-voice'

const TUTOR_LONG_PRESS_RECORDING_MS = 380

export type UseTutorFabDragOptions = {
  open: boolean
  mounted: boolean
  hideOnMobile: boolean
  fabPlacement: 'default' | 'compact'
  contextKey: string
  onToggle: () => void
  /** 长按说话桥接（来自语音控制器）；拖拽启动时取消长按，抬起时结算 */
  longPress: TutorLongPressBridge
  /** 正在录音时不要趴边 */
  recording?: boolean
  /** Additional space reserved below the FAB (for example a mobile lesson footer). */
  bottomInset?: number
}

/**
 * 小迪悬浮球拖拽控制器：位置持久化与视口内收敛、拖拽/点击/长按三者互斥。
 * 长按录音本身由语音控制器执行，这里只负责计时与手势仲裁。
 * 移动端关面板空闲后趴到最近左右边；写入 storage 的始终是完整可见球坐标。
 */
export function useTutorFabDrag({
  open,
  mounted,
  hideOnMobile,
  fabPlacement,
  contextKey,
  onToggle,
  longPress,
  recording = false,
  bottomInset = 0,
}: UseTutorFabDragOptions) {
  const [fabPosition, setFabPosition] = useState<TutorFabPosition | null>(null)
  const [fabDragging, setFabDragging] = useState(false)
  const [fabDocked, setFabDocked] = useState(false)
  const [pointerActive, setPointerActive] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(TUTOR_FAB_MOBILE_BREAKPOINT_PX)
  const fabDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: TutorFabPosition
    moved: boolean
  } | null>(null)
  const fabPositionRef = useRef<TutorFabPosition | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressNextToggleRef = useRef(false)

  useEffect(() => {
    fabPositionRef.current = fabPosition
  }, [fabPosition])

  useEffect(() => {
    if (!mounted) return
    const fabSize = open ? 48 : TUTOR_FAB_CLOSED_SIZE_PX
    const saved = readTutorFabPosition()
    if (!saved) {
      setFabPosition(null)
      return
    }
    setFabPosition(clampTutorFabPosition(saved, fabSize, undefined, undefined, bottomInset))
  }, [bottomInset, mounted, open, fabPlacement])

  useEffect(() => {
    if (!mounted) return
    const syncViewport = () => {
      const width = window.innerWidth
      setViewportWidth(width)
      const current = fabPositionRef.current
      if (!current) return
      const fabSize = open ? 48 : TUTOR_FAB_CLOSED_SIZE_PX
      setFabPosition(clampTutorFabPosition(current, fabSize, width, window.innerHeight, bottomInset))
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)
    window.visualViewport?.addEventListener('resize', syncViewport)
    return () => {
      window.removeEventListener('resize', syncViewport)
      window.visualViewport?.removeEventListener('resize', syncViewport)
    }
  }, [bottomInset, mounted, open])

  const canIdleDock =
    mounted &&
    !hideOnMobile &&
    canTutorFabEdgeDock(open, viewportWidth) &&
    !fabDragging &&
    !pointerActive &&
    !recording

  useEffect(() => {
    if (!canIdleDock) {
      setFabDocked(false)
      return
    }
    const timer = window.setTimeout(() => setFabDocked(true), TUTOR_FAB_DOCK_IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [canIdleDock])

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  // 面板关闭/场景切换/卸载时不留悬挂的长按计时器
  useEffect(() => {
    if (!open) clearLongPressTimer()
  }, [clearLongPressTimer, open])

  useEffect(() => {
    clearLongPressTimer()
  }, [clearLongPressTimer, contextKey])

  useEffect(() => {
    return () => clearLongPressTimer()
  }, [clearLongPressTimer])

  const resolveFabOrigin = useCallback((): TutorFabPosition => {
    if (fabPositionRef.current) return fabPositionRef.current
    return getDefaultTutorFabPosition(fabPlacement)
  }, [fabPlacement])

  const handleFabPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (hideOnMobile || event.button !== 0) return

    setPointerActive(true)
    setFabDocked(false)

    const origin = resolveFabOrigin()
    fabDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      moved: false,
    }
    setFabDragging(false)

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some browsers may not allow capture after synthetic pointer events.
    }

    if (open || !longPress.canBegin(event.pointerType)) return

    clearLongPressTimer()
    longPress.reset()
    longPressTimerRef.current = setTimeout(() => {
      if (fabDragRef.current?.moved) return
      suppressNextToggleRef.current = true
      longPress.begin()
    }, TUTOR_LONG_PRESS_RECORDING_MS)
  }

  const handleFabPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    const distance = Math.hypot(deltaX, deltaY)

    if (!drag.moved && distance < TUTOR_FAB_DRAG_THRESHOLD_PX) return

    if (!drag.moved) {
      drag.moved = true
      setFabDragging(true)
      clearLongPressTimer()
      longPress.cancelForDrag()
    }

    event.preventDefault()
    const fabSize = open ? 48 : TUTOR_FAB_CLOSED_SIZE_PX
    const next = clampTutorFabPosition(
      {
        right: drag.origin.right - deltaX,
        bottom: drag.origin.bottom - deltaY,
      },
      fabSize,
      undefined,
      undefined,
      bottomInset,
    )
    fabPositionRef.current = next
    setFabPosition(next)
  }

  const handleFabPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = fabDragRef.current
    clearLongPressTimer()
    setPointerActive(false)
    setFabDocked(false)

    if (drag && drag.pointerId === event.pointerId) {
      if (drag.moved) {
        event.preventDefault()
        suppressNextToggleRef.current = true
        const next = fabPositionRef.current ?? drag.origin
        writeTutorFabPosition(next)
      }
      fabDragRef.current = null
      setFabDragging(false)
    }

    if (!longPress.release()) return

    event.preventDefault()
    suppressNextToggleRef.current = true
  }

  const handleFabClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (suppressNextToggleRef.current) {
      suppressNextToggleRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onToggle()
  }

  const fabSizePx = open ? 48 : TUTOR_FAB_CLOSED_SIZE_PX
  const defaultFabPosition = getDefaultTutorFabPosition(fabPlacement, viewportWidth)
  const resolvedFabPosition = fabPosition ?? {
    ...defaultFabPosition,
    bottom: Math.max(defaultFabPosition.bottom, Math.max(0, bottomInset) + 8),
  }
  const useCustomFabPosition = fabPosition != null
  const fabDockEdge: TutorFabDockEdge = resolveTutorFabDockEdge(
    resolvedFabPosition,
    fabSizePx,
    viewportWidth,
  )
  const dockedVisual = fabDocked && canTutorFabEdgeDock(open, viewportWidth)
  const positionStyle: CSSProperties | undefined = useCustomFabPosition || bottomInset > 0
    ? {
        right: resolvedFabPosition.right,
        bottom: `calc(${resolvedFabPosition.bottom}px + env(safe-area-inset-bottom, 0px))`,
      }
    : undefined
  const fabStyle: CSSProperties | undefined = dockedVisual
    ? {
        ...positionStyle,
        transform: getTutorFabDockTransform(fabDockEdge),
        transformOrigin: getTutorFabDockTransformOrigin(fabDockEdge),
      }
    : positionStyle
  const bubbleOffset = getTutorFabBubbleOffset(resolvedFabPosition, fabSizePx, {
    docked: dockedVisual,
    edge: fabDockEdge,
    viewportWidth,
  })
  const fabBubbleStyle: CSSProperties | undefined =
    useCustomFabPosition || dockedVisual || bottomInset > 0
      ? {
          ...(bubbleOffset.left != null ? { left: bubbleOffset.left } : {}),
          right: bubbleOffset.right,
          ...(useCustomFabPosition || bottomInset > 0
            ? {
                bottom: `calc(${resolvedFabPosition.bottom + fabSizePx + 12}px + env(safe-area-inset-bottom, 0px))`,
              }
            : {}),
        }
      : undefined

  return {
    fabDragging,
    fabDocked: dockedVisual,
    fabDockEdge,
    fabEdgeDockEnabled: viewportWidth < TUTOR_FAB_MOBILE_BREAKPOINT_PX,
    useCustomFabPosition,
    fabStyle,
    fabBubbleStyle,
    handleFabClick,
    handleFabPointerDown,
    handleFabPointerMove,
    handleFabPointerEnd,
  }
}
