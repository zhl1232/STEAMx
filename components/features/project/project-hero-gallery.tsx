"use client"

import { useState } from "react"

import { ProjectDemoVideo } from "@/components/features/project/project-demo-video"
import { ImageLightbox } from "@/components/features/shared/image-lightbox"
import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"

export function ProjectHeroGallery({
  images,
  captions,
  alt,
  videoSrc,
  videoPoster,
  className,
  sizes = "100vw",
  showGradient = false,
  priority = true,
}: {
  images: string[]
  captions?: Array<string | undefined | null>
  alt: string
  videoSrc?: string | null
  videoPoster?: string | null
  className?: string
  sizes?: string
  showGradient?: boolean
  priority?: boolean
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const cover = images[0]
  const playbackSrc = videoSrc?.trim() || ""
  const showingVideo = Boolean(playbackSrc)

  if (!cover && !playbackSrc) {
    return <div className={cn("relative min-w-0 overflow-hidden bg-muted", className)} />
  }

  return (
    <>
      <div className={cn("relative min-w-0 overflow-hidden", showingVideo ? "bg-black" : "bg-muted", className)}>
        {showingVideo ? (
          <ProjectDemoVideo
            src={playbackSrc}
            title={alt}
            poster={videoPoster?.trim() || images[0] || undefined}
            fill
          />
        ) : cover ? (
          <>
            <button
              type="button"
              aria-label={`${alt}，点击查看大图`}
              onClick={() => setPreviewOpen(true)}
              className="absolute inset-0 h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <OptimizedImage src={cover} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
            </button>
            {showGradient ? (
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/20 via-transparent to-black/14" />
            ) : null}
          </>
        ) : null}
      </div>
      {!showingVideo && cover ? (
        <ImageLightbox
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          images={[cover]}
          index={0}
          alt={alt}
          captions={captions?.slice(0, 1)}
          title="项目图片预览"
          description="双指缩放查看首图细节，下滑关闭。"
        />
      ) : null}
    </>
  )
}
