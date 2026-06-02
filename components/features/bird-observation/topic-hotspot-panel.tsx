"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationLocationSummary } from "@/lib/mappers/types"
import { cn } from "@/lib/utils"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"

function recencyLabel(dateString: string): { text: string; className: string } {
  const ageDays = (Date.now() - new Date(dateString).getTime()) / 86_400_000
  if (ageDays <= 7) return { text: "本周记录", className: "bg-green-100 text-green-800" }
  if (ageDays <= 30) return { text: "近一月", className: "bg-emerald-50 text-emerald-700" }
  if (ageDays <= 90) return { text: "近三月", className: "bg-yellow-50 text-yellow-700" }
  return { text: "较早记录", className: "bg-muted text-muted-foreground" }
}

interface TopicHotspotPanelProps {
  locations: ObservationLocationSummary[]
  topicLabel?: string
  fromHref?: string
}

export function TopicHotspotPanel({ locations, topicLabel = "鸟类", fromHref = "/nature/species?topic=birds" }: TopicHotspotPanelProps) {
  const validLocations = useMemo(
    () => locations.filter((location) => location.latitude != null && location.longitude != null),
    [locations],
  )
  const [activeIndex, setActiveIndex] = useState(0)

  if (locations.length === 0) return null

  return (
    <section className="surface-panel overflow-hidden p-5 sm:p-6 lg:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">热点地图</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">最近都在哪里出现</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            根据公开审核记录整理近期线索：地点卡会显示最近观察到的{topicLabel}，但不代表一定能再次遇见。
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        {validLocations.length > 0 ? (
          <DomesticMiniMap
            markers={validLocations.map((location) => ({
              latitude: location.latitude as number,
              longitude: location.longitude as number,
              label: location.locationName,
              observedAt: location.latestObservedAt,
              weight: location.observationCount,
            }))}
            activeMarkerIndex={Math.min(activeIndex, Math.max(validLocations.length - 1, 0))}
            heightClassName="h-[300px] sm:h-[340px] lg:h-[390px]"
            enableTimeDecay
          />
        ) : (
          <div className="surface-subtle rounded-md px-4 py-3 text-sm text-muted-foreground">
            当前热点暂无可用坐标，先查看右侧的地点列表。
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 lg:max-h-[390px] lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
          {locations.map((location) => (
            <div
              key={location.locationName}
              className={cn(
                "surface-subtle rounded-md border border-border/70 bg-background/80 p-4 text-left transition-transform hover:-translate-y-0.5 hover:border-primary/40 hover:bg-muted/40",
                validLocations[activeIndex]?.locationName === location.locationName && "border-primary/60 ring-1 ring-primary/20",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  const nextIndex = validLocations.findIndex((item) => item.locationName === location.locationName)
                  if (nextIndex >= 0) setActiveIndex(nextIndex)
                }}
                className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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

              {location.species && location.species.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label={`${location.locationName} 最近观察到的${topicLabel}`}>
                  {location.species.map((species) => {
                    const label =
                      species.observationCount > 1
                        ? `${species.commonName} · ${species.observationCount}次`
                        : species.commonName
                    const className =
                      "rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-xs font-medium text-emerald-900 transition-colors hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:bg-emerald-900/45"

                    if (!species.speciesSlug) {
                      return (
                        <span key={species.speciesId} className={className}>
                          {label}
                        </span>
                      )
                    }

                    return (
                      <Link
                        key={species.speciesId}
                        href={appendNatureFrom(`/nature/species/${species.speciesSlug}`, fromHref)}
                        className={className}
                      >
                        {label}
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted-foreground">这个地点暂时没有可展示的已识别{topicLabel}。</p>
              )}

              {location.latitude != null && location.longitude != null ? (
                <a
                  href={`https://uri.amap.com/marker?position=${location.longitude},${location.latitude}&name=${encodeURIComponent(location.locationName)}&src=steam-explore`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-medium text-primary hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  在高德中查看位置
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
