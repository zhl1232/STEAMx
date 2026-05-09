"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationEvent, ObservationLocationSummary } from "@/lib/mappers/types"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"
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
  recentObservations?: ObservationEvent[]
  currentPath?: string
}

function locationObservationKey(locationName: string, observedAt: string) {
  return `${locationName.trim()}::${observedAt}`
}

export function SpeciesHotspotPanel({
  locations,
  recentObservations = [],
  currentPath,
}: SpeciesHotspotPanelProps) {
  const validLocations = useMemo(
    () => locations.filter((location) => location.latitude != null && location.longitude != null),
    [locations],
  )
  const observationByLocationKey = useMemo(() => {
    const observationMap = new Map<string, ObservationEvent>()
    for (const observation of recentObservations) {
      observationMap.set(locationObservationKey(observation.locationName, observation.observedAt), observation)
    }
    return observationMap
  }, [recentObservations])
  const [activeIndex, setActiveIndex] = useState(0)

  if (locations.length === 0) return null

  const activeLocationName = validLocations[activeIndex]?.locationName
  const recentObservationCount = recentObservations.length

  return (
    <section className="surface-subtle p-5 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">最近观察线索</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">
            这些位置来自最近的真实观察记录，点选位置卡时，地图会高亮对应点位。地图上较大较亮的点表示近期记录，较小较淡的点表示较早的记录。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              最近记录 {recentObservationCount} 条
            </span>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
              热点地点 {locations.length} 处
            </span>
          </div>
        </div>
      </div>

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
        {locations.slice(0, 6).map((location) => {
          const matchedObservation = observationByLocationKey.get(
            locationObservationKey(location.locationName, location.latestObservedAt),
          )
          const isActive = activeLocationName === location.locationName
          const hasCoordinates = location.latitude != null && location.longitude != null

          return (
            <div
              key={location.locationName}
              className={cn(
                "rounded-2xl border border-border/70 bg-background/80 p-4 transition-transform hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40",
                isActive && "border-primary/60 ring-1 ring-primary/20",
              )}
            >
              <button
                type="button"
                disabled={!hasCoordinates}
                onClick={() => {
                  if (!hasCoordinates) return
                  const nextIndex = validLocations.findIndex((item) => item.locationName === location.locationName)
                  if (nextIndex >= 0) setActiveIndex(nextIndex)
                }}
                className="block w-full text-left disabled:cursor-default"
              >
                <div className="flex flex-wrap items-center gap-2">
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
                  记录 {location.observationCount} 次 · 最近一次 {new Date(location.latestObservedAt).toLocaleString("zh-CN")}
                </div>
              </button>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium">
                {matchedObservation ? (
                  <Link
                    href={appendNatureFrom(`/nature/observations/${matchedObservation.id}`, currentPath)}
                    className="text-primary hover:underline"
                  >
                    查看完整记录
                  </Link>
                ) : null}
                {hasCoordinates ? (
                  <a
                    href={`https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${encodeURIComponent(location.locationName)}&src=steam-explore`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    在高德中查看位置
                  </a>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
