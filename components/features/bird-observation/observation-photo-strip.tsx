"use client"

import { OptimizedImage } from "@/components/ui/optimized-image"
import { cn } from "@/lib/utils"

interface ObservationPhotoStripProps {
  images: string[]
  selectedUrl: string | null
  onSelect: (url: string) => void
  badges?: Map<string, string>
  locatedUrls?: Set<string>
}

export function ObservationPhotoStrip({
  images,
  selectedUrl,
  onSelect,
  badges,
  locatedUrls,
}: ObservationPhotoStripProps) {
  if (images.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {images.map((url, index) => {
        const selected = url === selectedUrl
        const badge = badges?.get(url)
        const located = locatedUrls?.has(url)
        return (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(url)}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-xs border transition",
              selected
                ? "border-(--obs-accent) ring-2 ring-(--obs-focus)"
                : "border-(--obs-border-strong) hover:border-(--obs-accent)",
            )}
            aria-label={`第 ${index + 1} 张照片`}
            aria-pressed={selected}
          >
            <OptimizedImage
              src={url}
              alt={`观察照片 ${index + 1}`}
              fill
              variant="cover"
              className="object-cover"
            />
            {badge ? (
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[10px] font-medium text-white">
                {badge}
              </span>
            ) : locatedUrls ? (
              <span
                className={cn(
                  "absolute right-1 top-1 h-2 w-2 rounded-full",
                  located ? "bg-emerald-400" : "bg-amber-400",
                )}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
