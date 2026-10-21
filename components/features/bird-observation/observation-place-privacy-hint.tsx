"use client"

import { useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"

import { publicAreaLabel } from "@/lib/geo/place-privacy"

type PlaceCategory = "public_place" | "private_area" | "unknown"

interface ObservationPlacePrivacyHintProps {
  latitude: string
  longitude: string
  locationName: string
  confirmedPublic: boolean
  onConfirmedPublicChange: (value: boolean) => void
}

/** 发布前说明这条记录会公开到什么程度；类型不明时允许确认是公共场所。 */
export function ObservationPlacePrivacyHint({
  latitude,
  longitude,
  locationName,
  confirmedPublic,
  onConfirmedPublicChange,
}: ObservationPlacePrivacyHintProps) {
  const [result, setResult] = useState<{ key: string; category: PlaceCategory; township: string | null; district: string | null; city: string | null } | null>(null)
  const key = latitude && longitude ? `${latitude},${longitude},${locationName.trim()}` : ""

  useEffect(() => {
    if (!key) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ lat: latitude, lng: longitude, name: locationName.trim() })
      fetch(`/api/geo/place-privacy?${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data && typeof data.category === "string") setResult({ key, category: data.category, township: data.township ?? null, district: data.district ?? null, city: data.city ?? null })
        })
        .catch(() => {})
    }, 400)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [key, latitude, longitude, locationName])

  if (!key) return null
  const current = result?.key === key ? result : null
  const category: PlaceCategory = current?.category ?? "unknown"
  const area = `「${publicAreaLabel(current)}」`

  return (
    <div
      data-testid="place-privacy-hint"
      className="rounded-xs border border-(--obs-border) bg-(--obs-subtle) px-3 py-2.5 text-xs leading-5 text-(--obs-muted)"
    >
      <p className="flex items-start gap-1.5 font-medium text-(--obs-text)">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--obs-accent)" />
        {category === "public_place"
          ? "公共场所，会公开地点名称和位置"
          : category === "private_area"
            ? `这里像是家附近，公开时只显示${area}，精确位置只有你自己能看到`
            : confirmedPublic
              ? "已确认是公共场所，会公开地点名称和位置"
              : `公开时只显示${area}，精确位置只有你自己能看到`}
      </p>
      {category === "unknown" ? (
        <label className="mt-2 flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            checked={confirmedPublic}
            onChange={(event) => onConfirmedPublicChange(event.target.checked)}
            className="h-4 w-4 accent-(--obs-accent)"
          />
          这是公园、湿地等公共场所，公开具体地点
        </label>
      ) : null}
    </div>
  )
}
