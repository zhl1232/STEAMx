"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { CircleMarker as LeafletCircleMarker, Map as LeafletMap, Marker as LeafletMarker } from "leaflet"

import { addDomesticTileLayer, loadLeaflet, type LeafletModule } from "@/lib/maps/domestic-leaflet"
import { reverseGeocode } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

interface DomesticMapPickerProps {
  latitude: string
  longitude: string
  onChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion?: (name: string) => void
  className?: string
  mapClassName?: string
}

function parseCoordinate(value: string, fallback: number) {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : fallback
}

function createPickerIcon(L: LeafletModule) {
  return L.divIcon({
    className: "nature-map-picker-marker",
    html: '<span class="nature-map-picker-dot" aria-hidden="true"></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

export function DomesticMapPicker({
  latitude,
  longitude,
  onChange,
  onLocationNameSuggestion,
  className,
  mapClassName,
}: DomesticMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const onChangeRef = useRef(onChange)
  const onLocationNameSuggestionRef = useRef(onLocationNameSuggestion)
  const initialPointRef = useRef({
    latitude: parseCoordinate(latitude, 39.9042),
    longitude: parseCoordinate(longitude, 116.4074),
    zoom: latitude && longitude ? 14 : 11,
  })
  const [isReady, setIsReady] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const highlightRef = useRef<LeafletCircleMarker | null>(null)
  // 触屏默认锁定地图：单指滑动滚动页面，点一下才进入拖动/选点模式。
  const [touchLocked, setTouchLocked] = useState(false)
  const isTouchRef = useRef(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onLocationNameSuggestionRef.current = onLocationNameSuggestion
  }, [onLocationNameSuggestion])

  const doReverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!onLocationNameSuggestionRef.current) return

    geocodeAbortRef.current?.abort()
    const controller = new AbortController()
    geocodeAbortRef.current = controller
    setIsGeocoding(true)

    try {
      const name = await reverseGeocode(lat, lng, controller.signal)
      if (name && !controller.signal.aborted) {
        onLocationNameSuggestionRef.current(name)
      }
    } finally {
      if (!controller.signal.aborted) setIsGeocoding(false)
    }
  }, [])

  const commitPoint = useCallback((lat: number, lng: number) => {
    onChangeRef.current({
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    })
    void doReverseGeocode(lat, lng)
  }, [doReverseGeocode])

  useEffect(() => {
    let disposed = false

    const initialize = async () => {
      const L = await loadLeaflet()
      const container = containerRef.current
      if (disposed || !container || mapRef.current) return

      const initialPoint = initialPointRef.current
      const isTouch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true
      isTouchRef.current = isTouch
      const map = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        worldCopyJump: true,
      }).setView([initialPoint.latitude, initialPoint.longitude], initialPoint.zoom)

      addDomesticTileLayer(L, map)
      L.control.zoom({
        position: "bottomleft",
        zoomInTitle: "放大",
        zoomOutTitle: "缩小",
      }).addTo(map)

      const marker = L.marker([initialPoint.latitude, initialPoint.longitude], {
        draggable: true,
        keyboard: true,
        autoPan: true,
        riseOnHover: true,
        title: "拖动选择观察地点",
        alt: "观察地点标记",
        icon: createPickerIcon(L),
      }).addTo(map)

      marker.on("dragend", () => {
        const point = marker.getLatLng()
        commitPoint(point.lat, point.lng)
      })
      if (isTouch) {
        map.dragging.disable()
        map.touchZoom.disable()
        marker.dragging?.disable()
        setTouchLocked(true)
      }
      map.on("click", (event) => {
        marker.setLatLng(event.latlng)
        commitPoint(event.latlng.lat, event.latlng.lng)
      })

      if (initialPoint.zoom === 14) {
        highlightRef.current = L.circleMarker([initialPoint.latitude, initialPoint.longitude], {
          radius: 22, color: "#16a34a", weight: 2, fillColor: "#22c55e", fillOpacity: 0.18, interactive: false,
        }).addTo(map)
      }

      leafletRef.current = L
      mapRef.current = map
      markerRef.current = marker

      const resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }))
      resizeObserver.observe(container)
      resizeObserverRef.current = resizeObserver
      window.requestAnimationFrame(() => {
        if (!disposed) map.invalidateSize({ pan: false })
      })
      setIsReady(true)
    }

    void initialize()

    return () => {
      disposed = true
      geocodeAbortRef.current?.abort()
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      highlightRef.current?.remove()
      highlightRef.current = null
      markerRef.current?.remove()
      markerRef.current = null
      if (mapRef.current) {
        mapRef.current.stop()
        mapRef.current.remove()
      }
      mapRef.current = null
      leafletRef.current = null
    }
  }, [commitPoint])

  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    const marker = markerRef.current
    if (!L || !map || !marker || !latitude || !longitude) return

    const nextLat = Number(latitude)
    const nextLng = Number(longitude)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return

    const nextPoint = L.latLng(nextLat, nextLng)
    marker.setLatLng(nextPoint)
    // 选好地点后：地图居中到该点，并加一圈高亮。
    map.setView(nextPoint, Math.max(map.getZoom(), 15), { animate: true })
    if (highlightRef.current) {
      highlightRef.current.setLatLng(nextPoint)
    } else {
      highlightRef.current = L.circleMarker(nextPoint, {
        radius: 22,
        color: "#16a34a",
        weight: 2,
        fillColor: "#22c55e",
        fillOpacity: 0.18,
        interactive: false,
        className: "nature-map-picker-highlight",
      }).addTo(map)
    }
  }, [latitude, longitude])

  const setMapInteractive = (interactive: boolean) => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map) return
    if (interactive) {
      map.dragging.enable()
      map.touchZoom.enable()
      marker?.dragging?.enable()
    } else {
      map.dragging.disable()
      map.touchZoom.disable()
      marker?.dragging?.disable()
    }
    setTouchLocked(!interactive)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative isolate">
        <div
          ref={containerRef}
          className={cn(
            "nature-leaflet-map h-72 w-full overflow-hidden rounded-md border border-border/70 [background:var(--obs-map-bg)]",
            mapClassName,
          )}
          aria-label="选择观察地点"
        />
        {isReady && touchLocked ? (
          <button
            type="button"
            onClick={() => setMapInteractive(true)}
            className="absolute inset-0 z-500 flex items-end justify-center rounded-md bg-transparent pb-4"
            style={{ touchAction: "pan-y" }}
            data-testid="map-touch-overlay"
          >
            <span className="rounded-full bg-black/65 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md dark:bg-white/85 dark:text-black">
              点击地图调整位置
            </span>
          </button>
        ) : null}
        {isReady && !touchLocked && isTouchRef.current ? (
          <button
            type="button"
            onClick={() => setMapInteractive(false)}
            className="absolute right-3 top-3 z-500 min-h-9 rounded-full bg-(--obs-accent,#16a34a) px-4 text-sm font-semibold text-white shadow-md"
            data-testid="map-touch-done"
          >
            完成
          </button>
        ) : null}
        {!isReady ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent">
            <div className="absolute inset-0 opacity-70 bg-[linear-gradient(28deg,transparent_0_44%,rgba(143,211,156,0.18)_45%_47%,transparent_48%_100%),linear-gradient(150deg,transparent_0_52%,rgba(105,181,132,0.16)_53%_55%,transparent_56%_100%),radial-gradient(circle_at_64%_42%,rgba(77,199,112,0.28),transparent_9%)]" />
            <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--obs-accent) [box-shadow:var(--obs-soft-shadow)]">
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
          </div>
        ) : null}
      </div>
      {!isReady || isGeocoding ? (
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {!isReady ? "地图加载中..." : "正在查询地点名称..."}
        </p>
      ) : null}
    </div>
  )
}
