"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

type ProjectDemoVideoProps = {
  src: string
  title: string
  poster?: string | null
  className?: string
  /** Fill a sized parent (hero) instead of using a bordered aspect-video card. */
  fill?: boolean
}

/**
 * Inline HTML5 demo player for project detail. Prefer same-origin signed
 * /api/assets src so CDN Referer protection does not block playback.
 * Soft UI guards (not DRM): hide download control, block context menu / long-press.
 */
export function ProjectDemoVideo({ src, title, poster, className, fill = false }: ProjectDemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasError, setHasError] = useState(false)

  const retry = () => {
    setHasError(false)
    videoRef.current?.load()
  }

  return (
    <div className={cn(fill ? "absolute inset-0 bg-black" : className)}>
      <div
        className={
          fill
            ? "relative h-full w-full bg-black"
            : "relative overflow-hidden rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-black shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]"
        }
      >
        <video
          ref={videoRef}
          className={
            fill
              ? "h-full w-full bg-black object-contain select-none"
              : "aspect-video w-full bg-black select-none"
          }
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          preload="metadata"
          poster={poster || undefined}
          aria-label={`${title} 演示视频`}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          style={{ WebkitTouchCallout: "none" }}
          onError={() => setHasError(true)}
          onLoadedData={() => setHasError(false)}
        >
          <source src={src} type="video/mp4" onError={() => setHasError(true)} />
          当前浏览器不支持内嵌视频播放。
        </video>
        {hasError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/75 p-4 text-center text-sm text-white">
            <div>
              <p>视频暂时无法播放</p>
              <button
                type="button"
                onClick={retry}
                className="mt-3 min-h-11 rounded-full border border-white/30 px-4 py-2 font-medium transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                重试
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
