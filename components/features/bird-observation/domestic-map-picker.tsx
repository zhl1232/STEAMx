"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { reverseGeocode } from "@/lib/reverse-geocode"
import { cn } from "@/lib/utils"

type LeafletModule = typeof import("leaflet")

interface DomesticMapPickerProps {
  latitude: string
  longitude: string
  onChange: (coords: { latitude: string; longitude: string }) => void
  onLocationNameSuggestion?: (name: string) => void
  className?: string
  mapClassName?: string
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
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const markerRef = useRef<import("leaflet").Marker | null>(null)
  const leafletRef = useRef<LeafletModule | null>(null)
  const initialPointRef = useRef<{ latitude: number; longitude: number; zoom: number } | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const geocodeAbortRef = useRef<AbortController | null>(null)
  const onChangeRef = useRef(onChange)
  const doReverseGeocodeRef = useRef<(lat: number, lng: number) => void>(() => {})

  if (!initialPointRef.current) {
    initialPointRef.current = {
      latitude: latitude ? Number(latitude) : 39.9042,
      longitude: longitude ? Number(longitude) : 116.4074,
      zoom: latitude && longitude ? 14 : 11,
    }
  }

  const doReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!onLocationNameSuggestion) return

      geocodeAbortRef.current?.abort()
      const controller = new AbortController()
      geocodeAbortRef.current = controller

      setIsGeocoding(true)
      try {
        const name = await reverseGeocode(lat, lng, controller.signal)
        if (name && !controller.signal.aborted) {
          onLocationNameSuggestion(name)
        }
      } finally {
        if (!controller.signal.aborted) setIsGeocoding(false)
      }
    },
    [onLocationNameSuggestion],
  )

  // Keep refs in sync so the init effect always uses the latest callbacks
  // without needing them in the dependency array.
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  useEffect(() => {
    doReverseGeocodeRef.current = doReverseGeocode
  }, [doReverseGeocode])

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      if (!containerRef.current || mapRef.current) return
      const L = await import("leaflet")

      if (!isMounted || !containerRef.current) return

      leafletRef.current = L
      const initialPoint = initialPointRef.current ?? { latitude: 39.9042, longitude: 116.4074, zoom: 11 }

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([initialPoint.latitude, initialPoint.longitude], initialPoint.zoom)

      L.control.zoom({ position: "bottomright" }).addTo(map)

      L.tileLayer("https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}", {
        subdomains: ["1", "2", "3", "4"],
        maxZoom: 18,
        minZoom: 3,
        attribution: "高德地图",
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);cursor:grab;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
      const marker = L.marker([initialPoint.latitude, initialPoint.longitude], { draggable: true, icon: pinIcon }).addTo(map)

      marker.on("dragend", () => {
        const point = marker.getLatLng()
        const lat = point.lat.toFixed(6)
        const lng = point.lng.toFixed(6)
        onChangeRef.current({ latitude: lat, longitude: lng })
        doReverseGeocodeRef.current(point.lat, point.lng)
      })

      map.on("click", (event) => {
        marker.setLatLng(event.latlng)
        const lat = event.latlng.lat.toFixed(6)
        const lng = event.latlng.lng.toFixed(6)
        onChangeRef.current({ latitude: lat, longitude: lng })
        doReverseGeocodeRef.current(event.latlng.lat, event.latlng.lng)
      })

      mapRef.current = map
      markerRef.current = marker
      setIsReady(true)
    }

    init()

    return () => {
      isMounted = false
      geocodeAbortRef.current?.abort()
      markerRef.current?.remove()
      if (mapRef.current) {
        // Stop any in-progress zoom/pan animation before removing the map,
        // otherwise the transitionend callback fires on a destroyed pane.
        mapRef.current.stop()
        mapRef.current.remove()
      }
      markerRef.current = null
      mapRef.current = null
    }
    // Map is initialised once; callbacks are accessed via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !leafletRef.current || !latitude || !longitude) return

    const nextLat = Number(latitude)
    const nextLng = Number(longitude)
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return

    const nextPoint = leafletRef.current.latLng(nextLat, nextLng)
    markerRef.current.setLatLng(nextPoint)
    mapRef.current.setView(nextPoint, Math.max(mapRef.current.getZoom(), 14))
  }, [latitude, longitude])

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <div
          ref={containerRef}
          className={cn(
            "h-72 w-full overflow-hidden rounded-2xl border border-border/70 [background:var(--obs-map-bg)]",
            mapClassName,
          )}
        />
        {!isReady ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-transparent">
            <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(28deg,transparent_0_44%,rgba(143,211,156,0.18)_45%_47%,transparent_48%_100%),linear-gradient(150deg,transparent_0_52%,rgba(105,181,132,0.16)_53%_55%,transparent_56%_100%),radial-gradient(circle_at_64%_42%,rgba(77,199,112,0.28),transparent_9%)]" />
            <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--obs-accent)] [box-shadow:var(--obs-soft-shadow)]">
              <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
            </div>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        点击地图或拖动标记选点，选点后会自动识别地点名称。
        {!isReady && " 地图加载中..."}
        {isGeocoding && " 正在识别地点名称..."}
      </p>
    </div>
  )
}
