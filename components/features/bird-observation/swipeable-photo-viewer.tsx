"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, type Easing } from "framer-motion"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { useHorizontalSwipe } from "@/hooks/use-horizontal-swipe"
import { cn } from "@/lib/utils"

const slideEase: Easing = [0.32, 0.72, 0, 1]
const slideTransition = { type: "tween" as const, duration: 0.26, ease: slideEase }

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "88%" : "-88%",
    opacity: 0.35,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-88%" : "88%",
    opacity: 0.35,
  }),
}

interface SwipeablePhotoViewerProps {
  urls: string[]
  index: number
  onIndexChange: (index: number) => void
  alt: string
  className?: string
  imageClassName?: string
  sizes?: string
  priority?: boolean
  showCounter?: boolean
  showSwipeHint?: boolean
  onTap?: () => void
  emptyLabel?: string
}

export function SwipeablePhotoViewer({
  urls,
  index,
  onIndexChange,
  alt,
  className,
  imageClassName,
  sizes = "100vw",
  priority = false,
  showCounter = false,
  showSwipeHint = false,
  onTap,
  emptyLabel = "无照片",
}: SwipeablePhotoViewerProps) {
  const [slideDirection, setSlideDirection] = useState(0)
  const count = urls.length
  const activeUrl = urls[index] ?? urls[0] ?? null

  const goToDelta = useCallback(
    (delta: number) => {
      if (count <= 1) return
      setSlideDirection(delta)
      onIndexChange((index + delta + count) % count)
    },
    [count, index, onIndexChange],
  )

  const prevIndexRef = useRef(index)
  useEffect(() => {
    const prev = prevIndexRef.current
    if (prev === index || count <= 1) {
      prevIndexRef.current = index
      return
    }
    const forward = (index - prev + count) % count
    const backward = (prev - index + count) % count
    setSlideDirection(forward <= backward ? 1 : -1)
    prevIndexRef.current = index
  }, [count, index])

  const swipe = useHorizontalSwipe({
    enabled: count > 1,
    onSwipeLeft: () => goToDelta(1),
    onSwipeRight: () => goToDelta(-1),
  })

  const handleTap = () => {
    if (swipe.consumeSwipe()) return
    onTap?.()
  }

  return (
    <div
      className={cn("relative touch-pan-y overflow-hidden", className)}
      onTouchStart={swipe.onTouchStart}
      onTouchEnd={swipe.onTouchEnd}
    >
      {onTap ? (
        <button
          type="button"
          onClick={handleTap}
          className="absolute inset-0 z-10"
          aria-label={alt}
        />
      ) : null}

      {activeUrl ? (
        <AnimatePresence initial={false} custom={slideDirection} mode="popLayout">
          <motion.div
            key={`${activeUrl}-${index}`}
            custom={slideDirection}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0"
          >
            <OptimizedImage
              src={activeUrl}
              alt={alt}
              fill
              variant="cover"
              priority={priority}
              draggable={false}
              className={cn("pointer-events-none select-none object-contain", imageClassName)}
              sizes={sizes}
            />
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="flex h-full min-h-[inherit] items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}

      {showCounter && count > 1 ? (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs"
        >
          {index + 1}/{count}
        </motion.div>
      ) : null}

      {showSwipeHint && count > 1 ? (
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur-sm">
          左右滑动
        </div>
      ) : null}
    </div>
  )
}
