"use client"

import { useCallback, useRef, useState } from "react"
import { Images } from "lucide-react"

import { ImageLightbox } from "@/components/features/shared/image-lightbox"
import { SwipeablePhotoViewer } from "@/components/features/shared/swipeable-photo-viewer"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"

export function WorkImageGallery({
  images,
  captions,
  alt,
  priority = false,
  badge,
  emptyLabel = "暂无图片",
  layout = "hero",
}: {
  images: string[]
  captions?: Array<string | undefined | null>
  alt: string
  priority?: boolean
  badge?: string
  emptyLabel?: string
  layout?: "hero" | "feed"
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)
  const activeCaption = captions?.[activeIndex]?.trim()
  const isFeed = layout === "feed"

  const goToIndex = useCallback((nextIndex: number) => {
    setActiveIndex(nextIndex)
    railRef.current?.children[nextIndex]?.scrollIntoView?.({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    })
  }, [])

  if (images.length === 0) {
    return (
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-[hsl(var(--surface-muted))]">
        <div className="grid h-full place-items-center text-muted-foreground" role="img" aria-label={emptyLabel}>
          <Images className="h-10 w-10" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={cn("min-w-0 overflow-hidden", isFeed && "flex justify-center")}>
        <div className={cn("relative min-w-0", isFeed && "w-full max-w-[min(100%,26rem)]")}>
          <SwipeablePhotoViewer
            urls={images}
            index={activeIndex}
            onIndexChange={goToIndex}
            alt={`${alt}，点击查看大图`}
            priority={priority}
            showCounter={images.length > 1}
            onTap={() => setPreviewOpen(true)}
            className={cn(
              "w-full overflow-hidden",
              isFeed
                ? "aspect-[3/4] rounded-md bg-black/[0.04] dark:bg-white/[0.04]"
                : "aspect-4/3 min-h-[220px] rounded-lg bg-[hsl(var(--surface-muted))]",
            )}
            sizes={isFeed ? "(max-width: 1024px) 92vw, 416px" : "(max-width: 1024px) 92vw, 720px"}
          />
          {badge ? (
            <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[hsl(var(--background)/0.84)] px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm">
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      {activeCaption ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{activeCaption}</p>
      ) : null}

      {images.length > 1 ? (
        <div
          ref={railRef}
          className="no-scrollbar mt-3 flex gap-2 overflow-x-auto p-0.5"
          aria-label="作品图片缩略图"
        >
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => goToIndex(index)}
              aria-label={`查看第 ${index + 1} 张图片`}
              aria-pressed={activeIndex === index}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[4.5rem] sm:w-[4.5rem]",
                activeIndex === index
                  ? "border-[hsl(var(--brand-blue))] ring-2 ring-[hsl(var(--brand-blue)/0.18)]"
                  : "border-transparent",
              )}
            >
              <OptimizedImage
                src={image}
                alt=""
                fill
                variant="thumbnail"
                loading={index === activeIndex ? "eager" : "lazy"}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      <ImageLightbox
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        images={images}
        index={activeIndex}
        onIndexChange={goToIndex}
        alt={alt}
        captions={captions}
        title="作品图片预览"
        description="左右滑动切换作品照片，双指缩放查看细节，下滑关闭。"
      />
    </>
  )
}
