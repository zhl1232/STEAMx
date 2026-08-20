"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Camera, ChevronRight, Leaf, MapPin } from "lucide-react"

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map"
import { OptimizedImage } from "@/components/ui/optimized-image"
import type { ObservationEvent } from "@/lib/mappers/types"
import { appendNatureFrom, buildNatureSubmitHref } from "@/lib/utils/nature-navigation"

interface NatureHomeMapPairProps {
  observations: ObservationEvent[]
}

const BEIJING_CENTER = { lat: 39.9042, lon: 116.4074 }
const MOBILE_OBSERVATION_LIMIT = 4

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
    <>
      {/* 移动端：完全解耦为【生态足迹地图】与【最新观察 2x2 对称网格】两大独立区块 */}
      <div className="space-y-4 md:hidden">
        {/* 地图独立卡片 */}
        <section aria-labelledby="nature-mobile-map-heading" className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 id="nature-mobile-map-heading" className="text-[15px] font-bold text-foreground min-[390px]:text-[16px]">
              生态足迹地图
            </h2>
            <Link
              href="/nature/map"
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/0.85)]"
            >
              全屏地图
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.8)] shadow-xs">
            <DomesticMiniMap
              markers={markers}
              heightClassName="h-[180px] min-[390px]:h-[200px]"
              className="rounded-none border-0"
              defaultCenter={BEIJING_CENTER}
              defaultZoom={10}
              fitMode="default"
              enableTimeDecay
              hoveredMarkerId={hoveredId}
              onMarkerHover={setHoveredId}
            />
          </div>
        </section>

        {/* 最新观察独立网格 */}
        <section aria-labelledby="nature-mobile-obs-heading" className="space-y-2.5">
          <div className="px-1">
            <h2 id="nature-mobile-obs-heading" className="text-[15px] font-bold text-foreground min-[390px]:text-[16px]">
              最新观察
            </h2>
          </div>

          {observations.length === 0 ? (
            <div className="flex min-h-[140px] flex-col items-center justify-center gap-2.5 rounded-sm border border-dashed border-[hsl(var(--surface-border))] bg-[hsl(var(--surface-raised)/0.5)] px-6 py-6 text-center">
              <Leaf className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                还没有公开观察。第一条由你来发布吧。
              </p>
              <Link href={submitHref} className="nature-action-link h-9 min-h-9 px-3 text-xs">
                发布观察
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5 min-[390px]:gap-3">
                {mobileObservations.map((observation) => {
                  const speciesName = observation.species[0]?.commonName
                  const isPending = !speciesName

                  return (
                    <Link
                      key={observation.id}
                      href={appendNatureFrom(`/nature/observations/${observation.id}`, "/nature")}
                      className="group block overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.8)] bg-[hsl(var(--surface-raised))] shadow-xs transition-all duration-300 hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--surface-raised)/0.98)] hover:shadow-sm"
                    >
                      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted/40">
                        {observation.mediaUrls[0] ? (
                          <OptimizedImage
                            src={observation.mediaUrls[0]}
                            alt={speciesName ?? "待鉴定观察"}
                            fill
                            variant="card"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 48vw, 240px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Camera className="h-6 w-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        {isPending ? (
                          <div className="absolute left-2 top-2">
                            <span className="inline-flex items-center rounded-xs bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                              待鉴定
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="p-2.5 min-[390px]:p-3">
                        <h3 className="truncate text-[13px] font-bold text-foreground transition-colors group-hover:text-[hsl(var(--primary))] min-[390px]:text-[14px]">
                          {speciesName ?? "自然观察记录"}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />
                          <span className="truncate">{observation.locationName || "未知地点"}</span>
                        </p>
                        <div className="mt-1.5 flex items-center justify-between border-t border-[hsl(var(--surface-border)/0.6)] pt-1.5 text-[10px] text-muted-foreground/85 min-[390px]:mt-2 min-[390px]:pt-2">
                          <span className="truncate font-medium">{observation.authorDisplayName || "自然观察者"}</span>
                          <span className="shrink-0">{formatDate(observation.createdAt)}</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <div>
                <Link
                  href="/nature/observations"
                  className="flex min-h-10 items-center justify-center gap-1.5 rounded-sm border border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--surface-raised))] px-4 text-xs font-bold text-[hsl(var(--primary))] shadow-2xs transition-all duration-300 hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--status-info-surface)/0.5)] active:scale-[0.99]"
                >
                  查看全部观察记录
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </section>
      </div>

      {/* 桌面端：优雅的宽屏左右联动面板 */}
      <section className="nature-section-card nature-home-map-panel hidden overflow-hidden p-0 md:block">
        <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--surface-border)/0.6)] px-5 py-2.5">
          <p className="section-kicker tracking-normal">最近观察</p>
          <Link
            href="/nature/observations"
            className="nature-link relative z-1 -my-3.5 -mx-2 inline-flex h-11 shrink-0 items-center gap-0.5 px-2 text-sm"
          >
            查看全部
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-0 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="relative">
            <DomesticMiniMap
              markers={markers}
              heightClassName="h-[300px] lg:h-[560px]"
              className="rounded-xs border border-[#cfe3d5] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-[#274d37] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              defaultCenter={BEIJING_CENTER}
              defaultZoom={10}
              fitMode="default"
              enableTimeDecay
              hoveredMarkerId={hoveredId}
              onMarkerHover={setHoveredId}
            />
          </div>
          <div className="relative overflow-hidden border-t border-[hsl(var(--surface-border)/0.6)] max-h-[320px] overflow-y-auto bg-transparent lg:max-h-[560px] lg:border-l lg:border-t-0">
            {observations.length === 0 ? (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <Leaf className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  还没有带坐标的公开观察。第一条由你来发布吧。
                </p>
                <Link href={submitHref} className="nature-action-link">
                  发布观察
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {observations.map((observation) => {
                  const id = String(observation.id)
                  const isActive = id === hoveredId
                  const speciesName = observation.species[0]?.commonName

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
                        className={`group flex items-center gap-3.5 px-4 py-3 transition-all duration-200 ${
                          isActive ? "bg-[hsl(var(--status-info-surface)/0.6)] shadow-xs" : "hover:bg-[hsl(var(--surface-raised)/0.8)]"
                        }`}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-[hsl(var(--surface-border)/0.5)] bg-muted/40 shadow-2xs">
                          {observation.mediaUrls[0] ? (
                            <OptimizedImage
                              src={observation.mediaUrls[0]}
                              alt={speciesName ?? "待鉴定观察"}
                              fill
                              variant="thumbnail"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="56px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Camera className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-[hsl(var(--primary))]">
                              {speciesName ? (
                                speciesName
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="nature-chip">待鉴定</span>
                                  <span className="text-muted-foreground">观察记录</span>
                                </span>
                              )}
                            </p>
                            <span className="shrink-0 text-[11px] text-muted-foreground/75">
                              {formatDate(observation.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0 text-[hsl(var(--primary))]" />
                            <span className="truncate">{observation.locationName || "未知地点"}</span>
                            <span className="mx-1 text-muted-foreground/40">•</span>
                            <span className="truncate">{observation.authorDisplayName || "匿名观察者"}</span>
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-[hsl(var(--primary))]" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
