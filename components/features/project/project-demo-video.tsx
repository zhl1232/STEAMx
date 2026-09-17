type ProjectDemoVideoProps = {
  src: string
  title: string
  poster?: string | null
  className?: string
}

/**
 * Inline HTML5 demo player for project detail. Prefer same-origin /api/assets
 * src so CDN Referer protection does not block playback.
 */
export function ProjectDemoVideo({ src, title, poster, className }: ProjectDemoVideoProps) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-md border border-[hsl(var(--surface-border)/0.86)] bg-black shadow-[0_18px_44px_-34px_hsl(var(--surface-shadow)/0.38)]">
        <video
          className="aspect-video w-full bg-black"
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
