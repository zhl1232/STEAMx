"use client"

import { useCallback, useRef, useState, type MouseEvent } from "react"

import type { ImageLightbox as ImageLightboxComponent } from "@/components/features/shared/image-lightbox"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"
import { Maximize2 } from "lucide-react"

type LightboxComponent = typeof ImageLightboxComponent

export interface ProjectStepImageProps {
  src: string
  alt: string
  className?: string
  sizes?: string
}

/** An instructional photo that opens the shared full-screen viewer on demand. */
export function ProjectStepImage({ src, alt, className, sizes = "(max-width: 768px) 100vw, 720px" }: ProjectStepImageProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [Lightbox, setLightbox] = useState<LightboxComponent | null>(null)
  const [failed, setFailed] = useState(false)
  const [imageVersion, setImageVersion] = useState(0)
  const lightboxLoadingRef = useRef(false)

  const openPreview = useCallback(async () => {
    if (Lightbox) {
      setPreviewOpen(true)
      return
    }
    if (lightboxLoadingRef.current) return
    lightboxLoadingRef.current = true
    try {
      const lightboxModule = await import("@/components/features/shared/image-lightbox")
      setLightbox(() => lightboxModule.ImageLightbox)
      setPreviewOpen(true)
    } catch {
      setPreviewOpen(false)
    } finally {
      lightboxLoadingRef.current = false
    }
  }, [Lightbox])

  const retryImage = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setFailed(false)
    setImageVersion((version) => version + 1)
  }

  return (
    <>
      <div className={cn("relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted", className)}>
        {!failed ? (
          <button
            type="button"
            aria-label={`放大查看：${alt}`}
            onClick={() => void openPreview()}
            className="group absolute inset-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <OptimizedImage
              key={`${src}-${imageVersion}`}
              src={src}
              alt={alt}
              fill
              variant="cover"
              sizes={sizes}
              className="object-contain"
              onError={() => setFailed(true)}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white opacity-90 shadow-sm backdrop-blur-sm transition group-hover:bg-black/70">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              查看大图
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
            <span>图片加载失败</span>
            <button
              type="button"
              onClick={retryImage}
              className="min-h-11 rounded-full border border-border bg-background px-4 py-2 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              重试
            </button>
          </div>
        )}
      </div>
      {Lightbox ? (
        <Lightbox
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          images={[src]}
          index={0}
          onIndexChange={() => undefined}
          alt={alt}
          title="步骤图片预览"
          description="查看步骤图片，按 Esc 关闭。"
        />
      ) : null}
    </>
  )
}
