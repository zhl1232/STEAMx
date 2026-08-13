"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { AnimatePresence, motion, type Easing } from "framer-motion"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"

const MIN_SCALE = 1
const MAX_SCALE = 4
const DOUBLE_TAP_MS = 280
const SWIPE_THRESHOLD = 48
const DISMISS_THRESHOLD = 96

const slideEase: Easing = [0.32, 0.72, 0, 1]
const slideTransition = { type: "tween" as const, duration: 0.26, ease: slideEase }

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "72%" : "-72%",
    opacity: 0.2,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-72%" : "72%",
    opacity: 0.2,
    scale: 0.96,
  }),
}

export interface ImageLightboxProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: string[]
  index: number
  onIndexChange?: (index: number) => void
  alt: string
  captions?: Array<string | undefined | null>
  title?: string
  description?: string
}

type PhotoTransform = { scale: number; x: number; y: number }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function ImageLightbox({
  open,
  onOpenChange,
  images,
  index,
  onIndexChange,
  alt,
  captions,
  title = "图片预览",
  description = "左右滑动切换照片，双指缩放，下滑关闭。",
}: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(index)
  const [direction, setDirection] = useState(0)
  const count = images.length
  const activeUrl = images[activeIndex] ?? images[0] ?? null
  const caption = captions?.[activeIndex]?.trim()

  useEffect(() => {
    if (open) setActiveIndex(index)
  }, [index, open])

  const goTo = useCallback(
    (nextIndex: number, nextDirection: number) => {
      if (nextIndex < 0 || nextIndex >= count || nextIndex === activeIndex) return
      setDirection(nextDirection)
      setActiveIndex(nextIndex)
      onIndexChange?.(nextIndex)
    },
    [activeIndex, count, onIndexChange],
  )

  const goToDelta = useCallback(
    (delta: number) => {
      goTo(activeIndex + delta, delta)
    },
    [activeIndex, goTo],
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goToDelta(1)
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToDelta(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goToDelta, open])

  if (!activeUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden border-0 bg-black/96 p-0 shadow-none",
          "sm:left-[50%] sm:top-[50%] sm:h-[92vh] sm:w-[92vw] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-white/10",
        )}
        hideCloseButton
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        <div className="relative z-0 flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]">
          <div
            className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-white/15 bg-black/40 px-3 py-1 text-xs text-white/80 backdrop-blur-sm"
            aria-live="polite"
          >
            {activeIndex + 1} / {count}
          </div>
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={() => goToDelta(-1)}
                disabled={activeIndex === 0}
                className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-30 sm:flex"
                aria-label="上一张"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goToDelta(1)}
                disabled={activeIndex === count - 1}
                className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-30 sm:flex"
                aria-label="下一张"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={`${activeUrl}-${activeIndex}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={slideTransition}
              className="absolute inset-x-0 bottom-0 top-14 z-0"
            >
              <ZoomablePhotoStage
                onSwipeLeft={() => goToDelta(1)}
                onSwipeRight={() => goToDelta(-1)}
                onDismiss={() => onOpenChange(false)}
                canSwipeLeft={activeIndex < count - 1}
                canSwipeRight={activeIndex > 0}
              >
                <OptimizedImage
                  src={activeUrl}
                  alt={`${alt}（${activeIndex + 1}/${count}）`}
                  fill
                  variant="cover"
                  className="object-contain p-4 sm:p-10"
                  sizes="100vw"
                  priority
                  draggable={false}
                />
              </ZoomablePhotoStage>
            </motion.div>
          </AnimatePresence>
          {caption ? (
            <p className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-center text-xs leading-5 text-white/85 backdrop-blur-sm sm:inset-x-10">
              {caption}
            </p>
          ) : null}
          <DialogClose
            className="absolute right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white opacity-100 backdrop-blur-sm transition hover:bg-black/65 focus:outline-hidden focus:ring-2 focus:ring-white/40"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">关闭</span>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ZoomablePhotoStage({
  children,
  onSwipeLeft,
  onSwipeRight,
  onDismiss,
  canSwipeLeft,
  canSwipeRight,
}: {
  children: ReactNode
  onSwipeLeft: () => void
  onSwipeRight: () => void
  onDismiss: () => void
  canSwipeLeft: boolean
  canSwipeRight: boolean
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef<PhotoTransform>({ scale: 1, x: 0, y: 0 })
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchStartRef = useRef<{ distance: number; scale: number } | null>(null)
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
  const lastTapRef = useRef(0)
  const movedRef = useRef(false)

  const applyTransform = useCallback((next: PhotoTransform, dragY = 0) => {
    const frame = frameRef.current
    if (!frame) return
    const snapped = next.scale <= 1.02
      ? { scale: 1, x: 0, y: 0 }
      : {
          scale: clamp(next.scale, MIN_SCALE, MAX_SCALE),
          x: next.x,
          y: next.y,
        }
    transformRef.current = snapped
    frame.style.transform = `translate3d(${snapped.x}px, ${snapped.y + dragY}px, 0) scale(${snapped.scale})`
    const stage = stageRef.current
    if (stage) {
      stage.style.backgroundColor = dragY > 0
        ? `rgba(0,0,0,${Math.max(0.2, 1 - dragY / 420)})`
        : ""
    }
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const getPoint = (event: PointerEvent) => ({ x: event.clientX, y: event.clientY })

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      stage.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, getPoint(event))
      movedRef.current = false
      const transform = transformRef.current
      if (pointersRef.current.size === 1) {
        panStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          originX: transform.x,
          originY: transform.y,
        }
      } else if (pointersRef.current.size === 2) {
        const [first, second] = [...pointersRef.current.values()]
        pinchStartRef.current = {
          distance: distance(first, second),
          scale: transform.scale,
        }
        panStartRef.current = null
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return
      pointersRef.current.set(event.pointerId, getPoint(event))
      const transform = transformRef.current

      if (pointersRef.current.size === 2 && pinchStartRef.current) {
        const [first, second] = [...pointersRef.current.values()]
        const nextScale = clamp(
          pinchStartRef.current.scale * (distance(first, second) / Math.max(pinchStartRef.current.distance, 1)),
          MIN_SCALE,
          MAX_SCALE,
        )
        movedRef.current = true
        lastTapRef.current = 0
        applyTransform({ ...transform, scale: nextScale })
        return
      }

      const panStart = panStartRef.current
      if (!panStart || pointersRef.current.size !== 1) return
      const dx = event.clientX - panStart.x
      const dy = event.clientY - panStart.y
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) movedRef.current = true

      if (transform.scale > 1.02) {
        applyTransform({
          scale: transform.scale,
          x: panStart.originX + dx,
          y: panStart.originY + dy,
        })
        return
      }

      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        applyTransform(transform, dy)
      }
    }

    const finishGesture = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) return
      pointersRef.current.delete(event.pointerId)
      const transform = transformRef.current
      const panStart = panStartRef.current

      if (pointersRef.current.size < 2) pinchStartRef.current = null
      if (pointersRef.current.size === 0) {
        const dx = panStart ? event.clientX - panStart.x : 0
        const dy = panStart ? event.clientY - panStart.y : 0
        panStartRef.current = null

        if (transform.scale <= 1.02) {
          applyTransform({ scale: 1, x: 0, y: 0 })
          if (dy > DISMISS_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.1) {
            onDismiss()
            return
          }
          if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.15) {
            if (dx < 0 && canSwipeLeft) onSwipeLeft()
            else if (dx > 0 && canSwipeRight) onSwipeRight()
            return
          }
        }

        if (!movedRef.current) {
          const now = Date.now()
          if (now - lastTapRef.current <= DOUBLE_TAP_MS) {
            lastTapRef.current = 0
            applyTransform(
              transform.scale > 1.02
                ? { scale: 1, x: 0, y: 0 }
                : { scale: 2.4, x: 0, y: 0 },
            )
          } else {
            lastTapRef.current = now
          }
        }
      }
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const transform = transformRef.current
      const nextScale = clamp(transform.scale * (event.deltaY > 0 ? 0.9 : 1.1), MIN_SCALE, MAX_SCALE)
      applyTransform({
        ...transform,
        scale: nextScale,
        x: nextScale === 1 ? 0 : transform.x,
        y: nextScale === 1 ? 0 : transform.y,
      })
    }

    stage.addEventListener("pointerdown", onPointerDown)
    stage.addEventListener("pointermove", onPointerMove)
    stage.addEventListener("pointerup", finishGesture)
    stage.addEventListener("pointercancel", finishGesture)
    stage.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      stage.removeEventListener("pointerdown", onPointerDown)
      stage.removeEventListener("pointermove", onPointerMove)
      stage.removeEventListener("pointerup", finishGesture)
      stage.removeEventListener("pointercancel", finishGesture)
      stage.removeEventListener("wheel", onWheel)
    }
  }, [applyTransform, canSwipeLeft, canSwipeRight, onDismiss, onSwipeLeft, onSwipeRight])

  return (
    <div ref={stageRef} className="absolute inset-0 z-0 touch-none overflow-hidden">
      <div
        ref={frameRef}
        className="absolute inset-0 origin-center will-change-transform"
      >
        {children}
      </div>
    </div>
  )
}
