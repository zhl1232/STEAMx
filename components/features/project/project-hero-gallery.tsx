"use client"

import { useCallback, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { ImageLightbox } from "@/components/features/shared/image-lightbox"
import { SwipeablePhotoViewer } from "@/components/features/shared/swipeable-photo-viewer"
import { cn } from "@/lib/utils"

export function ProjectHeroGallery({
  images,
  captions,
  alt,
  className,
  sizes = "100vw",
  showGradient = false,
  priority = true,
}: {
  images: string[]
  captions?: Array<string | undefined | null>
  alt: string
  className?: string
  sizes?: string
  showGradient?: boolean
  priority?: boolean
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const count = images.length

  const goToIndex = useCallback((nextIndex: number) => {
    if (count <= 0) return
    setActiveIndex(((nextIndex % count) + count) % count)
  }, [count])

  if (count === 0) {
    return <div className={cn("relative min-w-0 overflow-hidden bg-muted", className)} />
  }

  return (
    <>
      <div className={cn("relative min-w-0 overflow-hidden bg-muted", className)}>
        <SwipeablePhotoViewer
          urls={images}
          index={activeIndex}
          onIndexChange={goToIndex}
          alt={`${alt}，点击查看大图`}
          priority={priority}
          onTap={() => setPreviewOpen(true)}
          className="absolute inset-0 h-full w-full"
          imageClassName="object-cover"
          sizes={sizes}
        />
        {showGradient ? (
          <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/14" />
        ) : null}
        {count > 1 ? (
          <>
            <div
              className="pointer-events-none absolute bottom-3 right-4 z-20 rounded-full bg-black/48 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md"
              aria-live="polite"
            >
              {activeIndex + 1}/{count}
            </div>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex - 1)}
              className="absolute left-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 md:flex"
              aria-label="上一张"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex + 1)}
              className="absolute right-3 top-1/2 z-30 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65 md:flex"
              aria-label="下一张"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
      <ImageLightbox
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        images={images}
        index={activeIndex}
        onIndexChange={goToIndex}
        alt={alt}
        captions={captions}
        title="项目图片预览"
        description="左右滑动切换项目照片，双指缩放查看细节，下滑关闭。"
      />
    </>
  )
}
