"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, List, Map, MapPin } from "lucide-react";
import { useState } from "react";

import { DomesticMiniMap } from "@/components/features/bird-observation/domestic-mini-map";
import type { ObservationHotspotSummary } from "@/lib/api/nature-observation-data";

interface MobileHotspotsCardProps {
  hotspots: ObservationHotspotSummary[];
}

const fallbackImages = [
  "/birds/images/great-egret.jpg",
  "/projects/science_plants.webp",
  "/birds/images/passer-montanus.jpg",
  "/birds/images/alcedo-atthis.jpg",
];

function getHotspotImage(hotspot: ObservationHotspotSummary, index: number) {
  return hotspot.imageUrl || fallbackImages[index % fallbackImages.length];
}

export function MobileHotspotsCard({ hotspots }: MobileHotspotsCardProps) {
  const [view, setView] = useState<"list" | "map">("list");
  const validHotspots = hotspots.filter((hotspot) => hotspot.latitude != null && hotspot.longitude != null);

  return (
    <section className="rounded-lg border border-[#dce9df] bg-white p-4 shadow-[0_16px_42px_-34px_rgba(27,69,49,0.36)] dark:border-[#2a4735] dark:bg-[#0f1f16] dark:shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-5 w-5 shrink-0 text-[#16844b] dark:text-[#74d79a]" />
          <h2 className="truncate text-[20px] font-bold leading-7 text-[#18251f] dark:text-[#eef8ef]">本地热点观察地</h2>
        </div>
        <div className="grid h-9 shrink-0 grid-cols-2 rounded-full bg-[#eef7ef] p-1 dark:bg-[#172a1e]">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold transition-colors ${
              view === "list"
                ? "bg-white text-[#16844b] shadow-[0_8px_18px_-14px_rgba(22,132,75,0.72)] dark:bg-[#2fb76b] dark:text-[#041208]"
                : "text-[#52645b] dark:text-[#a8b8ae]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            列表
          </button>
          <button
            type="button"
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
            className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-full px-2 text-xs font-bold transition-colors ${
              view === "map"
                ? "bg-white text-[#16844b] shadow-[0_8px_18px_-14px_rgba(22,132,75,0.72)] dark:bg-[#2fb76b] dark:text-[#041208]"
                : "text-[#52645b] dark:text-[#a8b8ae]"
            }`}
          >
            <Map className="h-3.5 w-3.5" />
            地图
          </button>
        </div>
      </div>

      {view === "map" ? (
        <div className="mt-4 space-y-3">
          {validHotspots.length > 0 ? (
            <DomesticMiniMap
              markers={validHotspots.slice(0, 8).map((hotspot) => ({
                latitude: hotspot.latitude as number,
                longitude: hotspot.longitude as number,
                label: hotspot.locationName,
                observedAt: hotspot.latestObservedAt,
                weight: hotspot.observationCount,
              }))}
              heightClassName="h-48"
              enableTimeDecay
              enableDragInteractions={false}
            />
          ) : (
            <div className="flex min-h-48 items-center rounded-lg border border-dashed border-[#d7eadb] bg-[#eef8ef] px-4 text-sm leading-6 text-[#65736c] dark:border-[#31503c] dark:bg-[#15271c] dark:text-[#9fb1a6]">
              公开观察记录里还没有可用于地图展示的坐标。
            </div>
          )}
          <Link href="/nature/map" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#16844b] dark:text-[#74d79a]">
            查看完整地图
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {hotspots.slice(0, 4).map((hotspot, index) => (
            <Link key={hotspot.locationName} href="/nature/map" className="flex min-h-11 items-center gap-3">
              <div className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-lg bg-[#dbeee0] dark:bg-[#16251b]">
                <Image src={getHotspotImage(hotspot, index)} alt="" fill className="object-cover dark:brightness-[.85]" sizes="72px" />
                <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#6d7d32]/[0.86] text-[11px] font-bold text-white dark:bg-[#d18a22]/90">
                  {index + 1}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#24342c] dark:text-[#edf7ef]">{hotspot.locationName}</p>
                <p className="text-xs leading-5 text-[#77867e] dark:text-[#9fb1a6]">公开记录 {hotspot.observationCount} 条</p>
              </div>
            </Link>
          ))}
          {hotspots.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#d7eadb] px-3 py-4 text-sm text-[#65736c] dark:border-[#31503c] dark:text-[#9fb1a6]">
              暂无真实热点地点。
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
