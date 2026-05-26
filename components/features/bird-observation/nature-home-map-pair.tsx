"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Camera, Leaf, MapPin } from "lucide-react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import type { ObservationEvent } from "@/lib/mappers/types"
import { appendNatureFrom } from "@/lib/utils/nature-navigation"

interface NatureHomeMapPairProps {
  observations: ObservationEvent[]
}

const BEIJING_CENTER = { lat: 39.9042, lon: 116.4074 }

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

  useEffect(() => {
    if (!hoveredId) return
    const el = itemRefs.current.get(hoveredId)
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [hoveredId])

  return (
    <section className="surface-card overflow-hidden rounded-[var(--radius-md)] p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div>
          <p className="section-kicker">实时观察</p>
        </div>
        <Link
          href="/nature/observations"
          className="text-xs font-medium text-primary transition-colors hover:text-primary/80 md:text-sm"
        >
          查看全部 →
        </Link>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative">
          <DomesticMiniMap
            markers={markers}
            heightClassName="h-[300px] lg:h-[560px]"
            defaultCenter={BEIJING_CENTER}
            defaultZoom={10}
            fitMode="default"
            enableTimeDecay
            hoveredMarkerId={hoveredId}
            onMarkerHover={setHoveredId}
          />
        </div>
        <div className="relative max-h-[320px] overflow-y-auto border-t border-border/60 lg:max-h-[560px] lg:border-l lg:border-t-0">
          {observations.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <Leaf className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                还没有带坐标的公开观察。第一条由你来发布吧。
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {observations.map((observation) => {
                const id = String(observation.id)
                const isActive = id === hoveredId
                const title = observation.species[0]?.commonName ?? "待鉴定"
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
                        isActive ? "bg-primary/[0.08]" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted/50">
                        {observation.mediaUrls[0] ? (
                          <Image
                            src={observation.mediaUrls[0]}
                            alt={title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            sizes="80px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Camera className="h-5 w-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{observation.locationName}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDate(observation.observedAt)} ·{" "}
                          {observation.authorDisplayName || "匿名观察者"}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
