"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Camera, ChevronRight, Leaf, MapPin } from "lucide-react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationEvent } from "@/lib/mappers/types"
import { appendNatureFrom, buildNatureSubmitHref } from "@/lib/utils/nature-navigation"

interface NatureHomeMapPairProps {
  observations: ObservationEvent[]
}

const BEIJING_CENTER = { lat: 39.9042, lon: 116.4074 }
const MOBILE_OBSERVATION_LIMIT = 8

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  })
}

export function NatureHomeMapPair({ observations }: NatureHomeMapPairProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map())

  const markers = useMemo(
    () =>
      observations
        .filter((o) => o.latitude != null && o.longitude != null)
        .map((o) => ({
          id: String(o.id),
          latitude: o.latitude as number,
          longitude: o.longitude as number,
          label: o.species[0]?.commonName ?? o.locationName,
          observedAt: o.observedAt,
          imageUrl: o.mediaUrls[0] || null,
          summary: o.locationName,
          href: appendNatureFrom(`/nature/observations/${o.id}`, "/nature"),
        })),
    [observations],
  )

  const mobileObservations = observations.slice(0, MOBILE_OBSERVATION_LIMIT)
  const submitHref = buildNatureSubmitHref({ from: "/nature" })

  useEffect(() => {
    if (!hoveredId) return
    const el = itemRefs.current.get(hoveredId)
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }
  }, [hoveredId])

  return (
    <section className="nature-section-card nature-home-map-panel overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--surface-border)/0.42)] px-4 py-2 md:border-[hsl(var(--surface-border)/0.6)] md:px-5 md:py-2.5">
        <p className="section-kicker tracking-normal">最近观察</p>
        {/* h-11 + 负 margin：触控命中区扩到 44px 高且不改变行高，z-[1] 避免被地图画布抢占命中 */}
        <Link
          href="/nature/observations"
          className="nature-link relative z-1 -my-3.5 -mx-2 inline-flex h-11 shrink-0 items-center gap-0.5 px-2 text-xs md:text-sm"
        >
          查看全部
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative">
          <DomesticMiniMap
            markers={markers}
            heightClassName="h-[180px] min-[390px]:h-[200px] md:h-[300px] lg:h-[560px]"
            className="rounded-none border-0 shadow-none md:rounded-xs md:border md:border-[#cfe3d5] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:dark:border-[#274d37] md:dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            defaultCenter={BEIJING_CENTER}
            defaultZoom={10}
            fitMode="default"
            enableTimeDecay
            hoveredMarkerId={hoveredId}
            onMarkerHover={setHoveredId}
          />
        </div>
        <div className="relative overflow-hidden border-t border-[hsl(var(--surface-border)/0.42)] bg-[hsl(var(--status-info-surface)/0.24)] md:max-h-[320px] md:overflow-y-auto md:border-[hsl(var(--surface-border)/0.6)] md:bg-transparent lg:max-h-[560px] lg:border-l lg:border-t-0">
          {observations.length === 0 ? (
            <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 px-6 py-8 text-center md:min-h-[200px] md:py-10">
              <Leaf className="h-7 w-7 text-muted-foreground md:h-8 md:w-8" />
              <p className="text-sm text-muted-foreground">
                还没有带坐标的公开观察。第一条由你来发布吧。
              </p>
              <Link href={submitHref} className="nature-action-link">
                发布观察
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <ul className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 py-3 md:hidden">
                {mobileObservations.map((observation) => {
                  const id = String(observation.id)
                  const isActive = id === hoveredId
                  const speciesName = observation.species[0]?.commonName
                  const isPending = !speciesName

                  return (
                    <li key={observation.id} className="shrink-0 snap-start">
                      <Link
                        href={appendNatureFrom(`/nature/observations/${observation.id}`, "/nature")}
                        ref={(el) => {
                          if (el) itemRefs.current.set(id, el)
                          else itemRefs.current.delete(id)
                        }}
                        onMouseEnter={() => setHoveredId(id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(id)}
                        onBlur={() => setHoveredId(null)}
                        className={`group block w-[72vw] max-w-[280px] rounded-xs p-2.5 transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--surface-raised))] active:bg-[hsl(var(--status-info-surface)/0.72)] ${
                          isActive
                            ? "bg-[hsl(var(--status-info-surface)/0.82)]"
                            : "bg-[hsl(var(--surface-raised)/0.72)] hover:bg-[hsl(var(--surface-raised)/0.96)]"
                        }`}
                      >
                        <div className="relative aspect-4/3 w-full overflow-hidden rounded-xs bg-muted/50">
                          {observation.mediaUrls[0] ? (
                            <Image
                              src={observation.mediaUrls[0]}
                              alt={speciesName ?? "待鉴定观察"}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              sizes="72vw"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Camera className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="mt-2.5 min-w-0">
                          {isPending ? (
                            <span className="nature-chip">待鉴定</span>
                          ) : (
                            <p className="truncate text-sm font-bold text-[hsl(var(--foreground))]">{speciesName}</p>
                          )}
                          <p className="mt-1 flex items-center gap-1 truncate text-xs nature-text-muted">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {observation.locationName}
                          </p>
                          <p className="mt-0.5 truncate text-xs nature-text-muted">
                            发布 {formatDate(observation.createdAt)} · {observation.authorDisplayName || "匿名观察者"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <ul className="hidden md:block md:divide-y md:divide-border/40">
                {observations.map((observation) => {
                  const id = String(observation.id)
                  const isActive = id === hoveredId
                  const speciesName = observation.species[0]?.commonName
                  const isPending = !speciesName

                  return (
                    <li key={observation.id}>
                      <Link
                        href={appendNatureFrom(`/nature/observations/${observation.id}`, "/nature")}
                        ref={(el) => {
                          if (el) itemRefs.current.set(id, el)
                          else itemRefs.current.delete(id)
                        }}
                        onMouseEnter={() => setHoveredId(id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onFocus={() => setHoveredId(id)}
                        onBlur={() => setHoveredId(null)}
                        className={`group flex items-center gap-3 px-4 py-3 transition-colors ${
                          isActive ? "bg-primary/8" : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xs bg-muted/50">
                          {observation.mediaUrls[0] ? (
                            <Image
                              src={observation.mediaUrls[0]}
                              alt={speciesName ?? "待鉴定观察"}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Camera className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          {isPending ? (
                            <span className="nature-chip">待鉴定</span>
                          ) : (
                            <p className="truncate text-sm font-semibold text-foreground">{speciesName}</p>
                          )}
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {observation.locationName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            发布 {formatDate(observation.createdAt)} · {observation.authorDisplayName || "匿名观察者"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
