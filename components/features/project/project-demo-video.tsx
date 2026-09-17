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
 * Inline HTML5 demo player for project detail. Prefer same-origin /api/assets
 * src so CDN Referer protection does not block playback.
 */
export function ProjectDemoVideo({ src, title, poster, className, fill = false }: ProjectDemoVideoProps) {
  return (
    <div className={cn(fill ? "absolute inset-0 bg-black" : className)}>
      <div
        className={
          fill
            ? "h-full w-full bg-black"
            : "overflow-hidden rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-black shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]"
        }
      >
        <video
          className={fill ? "h-full w-full bg-black object-contain" : "aspect-video w-full bg-black"}
          controls
          playsInline
          preload="metadata"
          poster={poster || undefined}
          aria-label={`${title} 演示视频`}
        >
          <source src={src} type="video/mp4" />
          当前浏览器不支持内嵌视频播放。
        </video>
      </div>
    </div>
  )
}
