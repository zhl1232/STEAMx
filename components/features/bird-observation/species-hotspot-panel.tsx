"use client"

import { useMemo } from "react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationEvent, ObservationLocationSummary } from "@/lib/mappers/types"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"

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

  if (locations.length === 0) return null

  const recentObservationCount = recentObservations.length
  return (
    <section className="surface-subtle relative overflow-hidden p-5 lg:col-span-2">
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">最近观察线索</h2>
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
        <div className="relative z-10 mt-4">
          <DomesticMiniMap
            markers={validLocations.map((location) => {
              const matchedObservation = observationByLocationKey.get(
                locationObservationKey(location.locationName, location.latestObservedAt),
              )

              return {
                latitude: location.latitude as number,
                longitude: location.longitude as number,
                label: location.locationName,
                observedAt: location.latestObservedAt,
                weight: location.observationCount,
                imageUrl: matchedObservation?.mediaUrls[0] ?? null,
                summary: matchedObservation
                  ? `观察者：${matchedObservation.authorDisplayName || "匿名观察者"}`
                  : undefined,
                href: matchedObservation
                  ? appendNatureFrom(`/nature/observations/${matchedObservation.id}`, currentPath)
                  : undefined,
              }
            })}
            enableTimeDecay
          />
        </div>
      )}
    </section>
  )
}
