"use client"

import { useMemo, useState } from "react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationLocationSummary } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"

function recencyLabel(dateString: string): { text: string; className: string } {
  const ageDays = (Date.now() - new Date(dateString).getTime()) / 86_400_000
  if (ageDays <= 7) return { text: "本周记录", className: "bg-green-100 text-green-800" }
  if (ageDays <= 30) return { text: "近一月", className: "bg-emerald-50 text-emerald-700" }
  if (ageDays <= 90) return { text: "近三月", className: "bg-yellow-50 text-yellow-700" }
  return { text: "较早记录", className: "bg-muted text-muted-foreground" }
}

interface SpeciesHotspotPanelProps {
  locations: ObservationLocationSummary[]
}

export function SpeciesHotspotPanel({ locations }: SpeciesHotspotPanelProps) {
  const validLocations = useMemo(
    () => locations.filter((location) => location.latitude != null && location.longitude != null),
    [locations],
  )
  const [activeIndex, setActiveIndex] = useState(0)

  if (locations.length === 0) return null

  return (
    <section className="surface-subtle p-5 md:col-span-2">
      <h2 className="text-lg font-semibold">最近能在哪里看到它</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        这些位置来自最近的真实观察记录，点选位置卡时，地图会高亮对应点位。地图上较大较亮的点表示近期记录，较小较淡的点表示较早的记录。
      </p>

      {validLocations.length > 0 && (
        <div className="mt-4">
          <DomesticMiniMap
            markers={validLocations.map((location) => ({
              latitude: location.latitude as number,
              longitude: location.longitude as number,
              label: location.locationName,
              observedAt: location.latestObservedAt,
              weight: location.observationCount,
            }))}
            activeMarkerIndex={Math.min(activeIndex, Math.max(validLocations.length - 1, 0))}
            enableTimeDecay
          />
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {locations.slice(0, 6).map((location) => (
          <button
            key={location.locationName}
            type="button"
            onClick={() => {
              const nextIndex = validLocations.findIndex((item) => item.locationName === location.locationName)
              if (nextIndex >= 0) setActiveIndex(nextIndex)
            }}
            className={cn(
              "rounded-2xl border border-border/70 bg-background/80 p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40",
              validLocations[activeIndex]?.locationName === location.locationName && "border-primary/60 ring-1 ring-primary/20",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{location.locationName}</span>
              {(() => {
                const badge = recencyLabel(location.latestObservedAt)
                return (
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", badge.className)}>
                    {badge.text}
                  </span>
                )
              })()}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              记录 {location.observationCount} 次 · 最近一次 {new Date(location.latestObservedAt).toLocaleString('zh-CN')}
            </div>
            {location.latitude != null && location.longitude != null && (
              <a
                href={`https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${encodeURIComponent(location.locationName)}&src=steam-explore`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                在高德中查看位置
              </a>
            )}
          </button>
        ))}
      </div>
    </section>
  )
}
