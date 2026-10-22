"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import type { ProjectVideoChapter } from "@/lib/project/video-presentation-pilot"

function chapterTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`
}

type ProjectDemoVideoProps = {
  src: string
  title: string
  poster?: string | null
  className?: string
  /** Fill a sized parent (hero) instead of using a bordered aspect-video card. */
  fill?: boolean
  videoLabel?: string
  chapters?: readonly ProjectVideoChapter[]
}

/**
 * Inline HTML5 demo player for project detail. Prefer same-origin signed
 * /api/assets src so CDN Referer protection does not block playback.
 * Soft UI guards (not DRM): hide download control, block context menu / long-press.
 */
export function ProjectDemoVideo({ src, title, poster, className, fill = false, videoLabel = "演示视频", chapters }: ProjectDemoVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pendingChapter = useRef<ProjectVideoChapter | null>(null)
  const [hasError, setHasError] = useState(false)
  const [seekStatus, setSeekStatus] = useState("")

  const applyPendingChapter = () => {
    const video = videoRef.current
    const chapter = pendingChapter.current
    if (!video || !chapter || video.readyState === 0) return
    try {
      video.currentTime = Number.isFinite(video.duration) ? Math.min(chapter.seconds, video.duration) : chapter.seconds
      pendingChapter.current = null
      setSeekStatus(`已定位到 ${chapterTime(chapter.seconds)} · ${chapter.label}`)
    } catch {
      // Some browsers cannot seek until canplay. Retain the latest request for that event.
    }
  }

  const seekToChapter = (chapter: ProjectVideoChapter) => {
    pendingChapter.current = chapter
    setSeekStatus(`正在加载视频，随后定位到 ${chapterTime(chapter.seconds)} · ${chapter.label}`)
    const video = videoRef.current
    if (!video) return
    if (video.readyState === 0) {
      if (video.networkState === 0) video.load()
      return
    }
    // Seeking preserves native paused/playing state, including repeated clicks.
    applyPendingChapter()
  }

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
          aria-label={`${title} ${videoLabel}`}
          onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}
          style={{ WebkitTouchCallout: "none" }}
          onError={() => setHasError(true)}
          onLoadedData={() => setHasError(false)}
          onLoadedMetadata={applyPendingChapter}
          onCanPlay={applyPendingChapter}
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
      {chapters?.length ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">点击时间点定位；播放或暂停由播放器控制。</p>
          <div aria-label="视频定位点" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {chapters.map(chapter => (
              <button
                key={chapter.seconds}
                type="button"
                onClick={() => seekToChapter(chapter)}
                className="flex min-h-11 items-center gap-2 rounded-sm border border-border px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-mono tabular-nums text-muted-foreground">{chapterTime(chapter.seconds)}</span>
                <span>{chapter.label}</span>
              </button>
            ))}
          </div>
          <p role="status" className="min-h-5 text-xs text-muted-foreground">{hasError ? '视频暂时无法播放，请重试。' : seekStatus}</p>
        </div>
      ) : null}
    </div>
  )
}
